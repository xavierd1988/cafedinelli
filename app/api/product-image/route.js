// Récupère la photo du 1er résultat Amazon pour un mot-clé donné.
//
// Comportement :
//   - Amazon répond avec une URL CDN valide  → on cache 24h
//   - Amazon block / robot-check / aucun img → on renvoie imageUrl:null
//     et on cache "no image" pour 2h (on retentera ensuite). Le client
//     affiche l'emoji qui est TOUJOURS correct, plutôt qu'une fausse
//     photo qui ne correspond pas au produit.
//
// Anciennement on tombait sur loremflickr en fallback, mais ses photos
// CC ne matchent que loosely les mots-clés → on voyait des photos aléa-
// toires qui ne correspondaient pas au produit. Mieux vaut un emoji
// précis qu'une photo trompeuse.
//
// Query params :
//   ?q=<keyword>   (required)
//   ?force=1       bypasse le cache et re-scrape Amazon

import { getRedis } from "../../../lib/redis.js";

const TTL_AMAZON_SEC   = 24 * 3600;
// "No image" cache : on accepte de ne pas avoir de photo pour 2h
// avant de retenter Amazon. Préférable à servir une fausse photo.
const TTL_NO_IMAGE_SEC = 2 * 3600;
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

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const asin = (url.searchParams.get("asin") || "").trim().toUpperCase();
  const force = url.searchParams.get("force") === "1";
  if (!q && !asin) return Response.json({ error: "missing q or asin" }, { status: 400 });

  // Cache key : ASIN > query. Permet de partager le cache entre tous les
  // requêtes qui ciblent le même produit, peu importe le mot-clé tapé.
  const cacheKey = asin ? `cafe:img:asin:${asin}` : `cafe:img:${q.toLowerCase()}`;

  // Cache hit (sauf si ?force=1)
  if (!force) {
    try {
      const cached = await getRedis().get(cacheKey);
      if (cached === "__none__") {
        // Anciennes entrées sentinelle : on renvoie pas d'image.
        return Response.json({ imageUrl: null, price: null });
      }
      if (cached) {
        try {
          const obj = typeof cached === "string" && cached.startsWith("{")
            ? JSON.parse(cached)
            : { imageUrl: cached, price: null };
          // URL non-Amazon → résidu de l'ancienne version (loremflickr),
          // on invalide et on re-scrape Amazon.
          if (obj?.imageUrl && !isAmazonImage(obj.imageUrl)) {
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

  // Fetch Amazon. Deux modes :
  // - mode ASIN (préféré) : on tape directement /dp/{ASIN}, qui retourne
  //   la fiche produit. Une seule image principale, pas d'ambiguïté de
  //   "premier résultat de recherche aléatoire". Beaucoup plus précis.
  // - mode RECHERCHE (fallback) : /s?k={query}, on prend la 1re vignette.
  let imageUrl = null;
  let price = null;
  let robotCheck = false;
  try {
    const targetUrl = asin
      ? `https://www.amazon.com/dp/${encodeURIComponent(asin)}`
      : `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
    const seed = asin || q;
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": pickUA(seed),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const html = await res.text();
      robotCheck = looksLikeRobotCheck(html);
      if (!robotCheck) {
        if (asin) {
          // === Page produit : extraction ciblée ===
          // 1. landingImage (l'élément officiel du carousel principal)
          const lp = html.match(/id="landingImage"[^>]+src="([^"]+)"/i);
          if (lp && isAmazonImage(lp[1])) imageUrl = lp[1];
          if (!imageUrl) {
            // 2. data-old-hires (URL haute résolution stockée par Amazon)
            const hi = html.match(/data-old-hires="([^"]+)"/);
            if (hi && isAmazonImage(hi[1])) imageUrl = hi[1];
          }
          if (!imageUrl) {
            // 3. dynamic image data (objet JSON inline)
            const dyn = html.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
            if (dyn && isAmazonImage(dyn[1])) imageUrl = dyn[1];
          }
          if (!imageUrl) {
            // 4. fallback : 1er <img src> sur le CDN Amazon
            const m = html.match(/<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
            if (m && isAmazonImage(m[1])) imageUrl = m[1];
          }
        } else {
          // === Page recherche : 1re vignette s-image ===
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
        }
        // Prix (même extraction pour les 2 modes)
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
    console.warn("/api/product-image fetch failed for", asin || q, err?.message || err);
  }

  // Décision finale + cache.
  // - Hit Amazon  → cache 24h, on renvoie la vraie photo
  // - Robot-check → cache 1 min (transitoire), on renvoie null pour
  //                 que le client affiche l'emoji et on retente vite
  // - Aucun img   → cache 2h, on renvoie null. Préférable à une fausse
  //                 photo qui ne correspond pas au produit.
  let response;
  if (imageUrl) {
    response = { imageUrl, price };
    try {
      await getRedis().set(cacheKey, JSON.stringify(response), { ex: TTL_AMAZON_SEC });
    } catch {}
  } else {
    response = { imageUrl: null, price, fallback: true };
    try {
      await getRedis().set(
        cacheKey,
        JSON.stringify(response),
        { ex: robotCheck ? TTL_ROBOT_SEC : TTL_NO_IMAGE_SEC }
      );
    } catch {}
  }

  return Response.json(response);
}
