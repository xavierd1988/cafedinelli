// Récupère la photo du 1er résultat Amazon pour un mot-clé donné, avec
// fallback automatique sur loremflickr.com quand Amazon refuse.
//
// Cache Redis :
//   - hit Amazon valide        → 24h
//   - fallback loremflickr     → 2h  (on retentera Amazon ensuite)
//   - robot-check / impossible → 1 min (transitoire)
//
// Query params :
//   ?q=<keyword>   (required)
//   ?force=1       bypasse le cache et re-scrape Amazon
//
// Pourquoi un fallback ? Amazon block ~30-50% des scrapes depuis les IPs
// datacenter AWS où tourne Vercel. Avant, ces produits restaient sur
// l'emoji et la vitrine était à moitié vide. Maintenant on tape une
// vraie photo Flickr CC matchée sur les mots-clés du produit — pas la
// photo Amazon exacte mais visuellement c'est un produit cohérent.

import { getRedis } from "../../../lib/redis.js";

const TTL_AMAZON_SEC   = 24 * 3600;
const TTL_FALLBACK_SEC = 2 * 3600;
const TTL_ROBOT_SEC    = 60;

const UA_POOL = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
];

function pickUA(q) {
  let h = 0;
  for (let i = 0; i < q.length; i++) h = ((h << 5) - h + q.charCodeAt(i)) | 0;
  return UA_POOL[Math.abs(h) % UA_POOL.length];
}

// Une URL valide produit doit pointer vers le CDN images Amazon — sinon
// c'était un sprite, logo de nav, GIF placeholder, etc.
function isAmazonImage(u) {
  if (!u || typeof u !== "string") return false;
  return /^https?:\/\/(m\.media-amazon\.com|images-[a-z0-9-]+\.ssl-images-amazon\.com)\//i.test(u);
}
function isLoremflickr(u) {
  return typeof u === "string" && /^https?:\/\/loremflickr\.com\//i.test(u);
}

// Détecte une page de robot-check / captcha / 503.
function looksLikeRobotCheck(html) {
  if (!html || typeof html !== "string") return false;
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes("/errors/validatecaptcha") ||
    head.includes("type the characters you see") ||
    head.includes("enter the characters you see below") ||
    head.includes("api-services-support@amazon.com") ||
    head.includes("automated access to amazon data")
  );
}

// Construit une URL loremflickr déterministe pour une query donnée.
// On extrait les mots les plus distinctifs (longueur ≥ 4) comme tags
// Flickr, et on lock le hash de la query pour qu'un même produit ait
// toujours la même photo (cohérence visuelle entre rechargements).
function loremflickrUrl(q) {
  const STOP = new Set([
    "with", "the", "and", "for", "from", "into", "your",
    "this", "that", "best", "new"
  ]);
  const tags = q
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.length >= 4 && !STOP.has(w))
    .slice(0, 3);
  const tagPath = tags.length ? tags.join(",") : encodeURIComponent(q.toLowerCase());
  let h = 0;
  for (let i = 0; i < q.length; i++) h = ((h << 5) - h + q.charCodeAt(i)) | 0;
  const lock = Math.abs(h) || 1;
  return `https://loremflickr.com/480/480/${tagPath}?lock=${lock}`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const force = url.searchParams.get("force") === "1";
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });

  const cacheKey = `cafe:img:${q.toLowerCase()}`;

  // Cache hit (sauf si ?force=1)
  if (!force) {
    try {
      const cached = await getRedis().get(cacheKey);
      if (cached === "__none__") {
        // Anciennes entrées __none__ : on retourne le fallback
        // immédiatement plutôt que rien — c'est mieux qu'un emoji.
        return Response.json({ imageUrl: loremflickrUrl(q), price: null, fallback: true });
      }
      if (cached) {
        try {
          const obj = typeof cached === "string" && cached.startsWith("{")
            ? JSON.parse(cached)
            : { imageUrl: cached, price: null };
          // URL non-Amazon ET non-loremflickr → résidu de l'ancienne version,
          // on invalide et on re-scrape.
          if (obj?.imageUrl && !isAmazonImage(obj.imageUrl) && !isLoremflickr(obj.imageUrl)) {
            // tombe dans le scrape ci-dessous
          } else {
            return Response.json(obj);
          }
        } catch {
          return Response.json({ imageUrl: cached, price: null });
        }
      }
    } catch {}
  }

  // Fetch Amazon search page
  let imageUrl = null;
  let price = null;
  let robotCheck = false;
  try {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": pickUA(q),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const html = await res.text();
      robotCheck = looksLikeRobotCheck(html);
      if (!robotCheck) {
        const patterns = [
          /class="s-image"[^>]*src="([^"]+)"/,
          /<img[^>]+class="[^"]*s-image[^"]*"[^>]+src="([^"]+)"/,
          /<img[^>]+data-image-source-density="1"[^>]+src="([^"]+)"/,
          /<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/
        ];
        for (const re of patterns) {
          const m = html.match(re);
          if (m && m[1] && isAmazonImage(m[1])) { imageUrl = m[1]; break; }
        }
        if (!imageUrl) {
          const m2 = html.match(/<img[^>]+srcset="([^"]+)"/);
          if (m2) {
            const first = m2[1].split(",")[0]?.trim().split(" ")[0];
            if (first && isAmazonImage(first)) imageUrl = first;
          }
        }
        // Prix
        const pw = html.match(/class="a-price-whole">([0-9.,]+)/);
        const pf = html.match(/class="a-price-fraction">([0-9]+)/);
        if (pw) {
          const whole = pw[1].replace(/[^0-9]/g, "");
          const frac = pf ? pf[1].replace(/[^0-9]/g, "") : "00";
          price = `$${whole}.${frac.padEnd(2, "0").slice(0, 2)}`;
        } else {
          const po = html.match(/class="a-offscreen">\$([0-9.,]+)/);
          if (po) price = `$${po[1]}`;
        }
      }
    }
  } catch (err) {
    console.warn("/api/product-image fetch failed for", q, err?.message || err);
  }

  // Décision finale + cache.
  // - Hit Amazon  → cache 24h
  // - Sinon       → fallback loremflickr, cache 2h pour retenter Amazon
  // - Robot-check → fallback loremflickr, cache 1 min pour retry très vite
  let response;
  if (imageUrl) {
    response = { imageUrl, price };
    try {
      await getRedis().set(cacheKey, JSON.stringify(response), { ex: TTL_AMAZON_SEC });
    } catch {}
  } else {
    const fallbackUrl = loremflickrUrl(q);
    response = { imageUrl: fallbackUrl, price, fallback: true };
    try {
      await getRedis().set(
        cacheKey,
        JSON.stringify(response),
        { ex: robotCheck ? TTL_ROBOT_SEC : TTL_FALLBACK_SEC }
      );
    } catch {}
  }

  return Response.json(response);
}
