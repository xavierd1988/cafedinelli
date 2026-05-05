// Récupère la photo du 1er résultat Amazon pour un mot-clé donné.
// Cache Redis :
//   - hit valide  → 24h
//   - miss        → 5 min  (on retente vite si Amazon a flaqué)
//   - robot-check → 1 min  (transitoire, retry très rapide)
// Le client tombe sur l'emoji si imageUrl est null.
//
// Query params :
//   ?q=<keyword>   (required)
//   ?force=1       bypasse le cache et re-scrape Amazon
//
// Validation : on n'accepte une imageUrl que si elle vient des CDN
// d'images Amazon — sinon on tombait régulièrement sur des sprites,
// logos ou pixels génériques, qu'on cachait 24h comme un "hit".

import { getRedis } from "../../../lib/redis.js";

const TTL_SEC       = 24 * 3600;
const TTL_NONE_SEC  = 5 * 60;
const TTL_ROBOT_SEC = 60;

// Pool de User-Agents : on en pick un déterministe par query pour
// répartir un peu si Amazon flag un UA spécifique.
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

// Une URL valide doit pointer vers le CDN images Amazon — sinon on
// rejette (sprite, logo de la nav, GIF placeholder, etc.).
function isAmazonImage(u) {
  if (!u || typeof u !== "string") return false;
  return /^https?:\/\/(m\.media-amazon\.com|images-[a-z0-9-]+\.ssl-images-amazon\.com)\//i.test(u);
}

// Détecte une page de robot-check / captcha / 503. Dans ce cas on
// veut TTL très court : c'est transitoire, retry vite.
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
  const force = url.searchParams.get("force") === "1";
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });

  const cacheKey = `cafe:img:${q.toLowerCase()}`;

  // Cache hit (sauf si ?force=1)
  if (!force) {
    try {
      const cached = await getRedis().get(cacheKey);
      if (cached === "__none__") return Response.json({ imageUrl: null, price: null });
      if (cached) {
        try {
          const obj = typeof cached === "string" && cached.startsWith("{")
            ? JSON.parse(cached)
            : { imageUrl: cached, price: null };
          // Si le cache contient une URL non-Amazon (résidu de l'ancienne
          // version qui ne validait pas), on l'invalide silencieusement.
          if (obj?.imageUrl && !isAmazonImage(obj.imageUrl)) {
            // tombera dans le scrape ci-dessous
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
        // Patterns ordonnés du plus fiable au moins fiable.
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
        // Fallback srcset
        if (!imageUrl) {
          const m2 = html.match(/<img[^>]+srcset="([^"]+)"/);
          if (m2) {
            const first = m2[1].split(",")[0]?.trim().split(" ")[0];
            if (first && isAmazonImage(first)) imageUrl = first;
          }
        }
        // Prix : Amazon utilise <span class="a-price-whole">XX</span>
        // <span class="a-price-fraction">YY</span> dans son markup search.
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

  // Cache : on choisit le TTL en fonction de ce qu'on a obtenu.
  try {
    if (imageUrl || price) {
      await getRedis().set(cacheKey, JSON.stringify({ imageUrl, price }), { ex: TTL_SEC });
    } else if (robotCheck) {
      // Robot-check : TTL ultra-court — on retente la prochaine
      // requête sans saturer Amazon.
      await getRedis().set(cacheKey, "__none__", { ex: TTL_ROBOT_SEC });
    } else {
      await getRedis().set(cacheKey, "__none__", { ex: TTL_NONE_SEC });
    }
  } catch {}

  return Response.json({ imageUrl, price });
}
