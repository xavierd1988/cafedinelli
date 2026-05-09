// =============================================================================
// ENDPOINT — re-scrape Amazon sans repasser par Groq
// =============================================================================
// Réutilise les 30 produits déjà cachés (cafe:products:daily) et relance
// uniquement le scraping Amazon. Sert à 2 cas d'usage :
//
//   1. Multi-run merge : on enchaîne plusieurs runs depuis des IPs
//      différentes (rotation VPN). Par défaut, ce route ne re-scrape QUE
//      les produits qui n'ont PAS encore d'image — chaque run s'attaque
//      uniquement aux misses du précédent. Hits préservés, gaspillage
//      minimum côté Amazon. Voir scripts/morning-multirun.mjs.
//
//   2. Debug : comparer hit-rate dans des conditions réseau différentes
//      (avec/sans VPN, depuis un serveur vs résidentiel, etc.) sans
//      dépenser un appel Groq.
//
// Query params :
//   ?all=1     → rescrape TOUS les produits (force, pas seulement misses).
//                Utile pour mesurer le hit-rate brut d'une IP donnée.
//   ?dry=1     → calcule les hits mais ne sauvegarde pas dans Redis.
//                Par défaut, on sauvegarde si on a plus d'images qu'avant.
// =============================================================================

import { getCachedDailyProducts, saveDailyProducts } from "../../../../lib/dailyProductsStore.js";

export const maxDuration = 60;

const SCRAPE_CONCURRENCY = 4;
const SCRAPE_DELAY_MS = 250;

const UA_POOL = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
];
function pickUA(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return UA_POOL[Math.abs(h) % UA_POOL.length];
}

function isAmazonImage(u) {
  return typeof u === "string" &&
    /^https?:\/\/(m\.media-amazon\.com|images-[a-z0-9-]+\.ssl-images-amazon\.com)\//i.test(u);
}

function looksLikeRobotCheck(html) {
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes("/errors/validatecaptcha") ||
    head.includes("type the characters you see") ||
    head.includes("api-services-support@amazon.com") ||
    head.includes("automated access to amazon data")
  );
}

async function scrapeAmazonForImage(product) {
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(product.search)}`;
  let imageUrl = null;
  let asin = null;
  let status = "ok";
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": pickUA(product.search),
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) {
      status = `http-${res.status}`;
      return { imageUrl: null, asin: null, status };
    }
    const html = await res.text();
    if (looksLikeRobotCheck(html)) {
      status = "robot-check";
      return { imageUrl: null, asin: null, status };
    }
    const asinMatch = html.match(/data-asin="(B0[0-9A-Z]{8})"[^>]*>/);
    if (asinMatch) asin = asinMatch[1];
    const patterns = [
      /class="s-image"[^>]*src="([^"]+)"/,
      /<img[^>]+class="[^"]*s-image[^"]*"[^>]+src="([^"]+)"/,
      /<img[^>]+data-image-source-density="1"[^>]+src="([^"]+)"/,
      /<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && isAmazonImage(m[1])) { imageUrl = m[1]; break; }
    }
    if (!imageUrl) status = "no-image-found";
  } catch (err) {
    status = `error:${err?.name || "unknown"}`;
  }
  return { imageUrl, asin, status };
}

export async function GET(request) {
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const all = url.searchParams.get("all") === "1";

  const cached = await getCachedDailyProducts();
  if (!cached || !Array.isArray(cached.products) || cached.products.length === 0) {
    return Response.json({ error: "no cached products to rescrape" }, { status: 400 });
  }

  // Détermine quels indices on attaque dans cette passe :
  //   - all=1 : tous les 30 (force scrape complet)
  //   - sinon : seulement les indices sans image (les "misses" à rattraper)
  const targetIndices = all
    ? cached.products.map((_, idx) => idx)
    : cached.products.map((_, idx) => idx).filter((idx) => !cached.products[idx].image);

  const startedAt = Date.now();
  // On part d'une copie complète des produits cachés — on ne touchera que
  // les indices visés. Les hits déjà présents passent intacts.
  const enriched = cached.products.map((p) => ({ ...p }));
  const statuses = {};
  let cursor = 0;
  async function worker() {
    while (cursor < targetIndices.length) {
      const idx = targetIndices[cursor++];
      const p = cached.products[idx];
      const { imageUrl, asin, status } = await scrapeAmazonForImage(p);
      enriched[idx] = {
        ...p,
        // Si on retrouve une nouvelle image on remplace, sinon on garde
        // l'image d'avant (lossless).
        image: imageUrl || p.image || null,
        asin: asin || p.asin || null
      };
      statuses[status] = (statuses[status] || 0) + 1;
      if (SCRAPE_DELAY_MS > 0) await new Promise((r) => setTimeout(r, SCRAPE_DELAY_MS));
    }
  }
  await Promise.all(Array.from({ length: SCRAPE_CONCURRENCY }, () => worker()));

  const newImages = enriched.filter((p) => p.image).length;
  const previousImages = cached.products.filter((p) => p.image).length;
  const newlyFound = enriched.filter((p, idx) => p.image && !cached.products[idx]?.image).length;
  const lost = enriched.filter((p, idx) => !p.image && cached.products[idx]?.image).length;

  let saved = false;
  if (!dry && newImages > previousImages) {
    const result = await saveDailyProducts({
      date: cached.date,
      generatedAt: Date.now(),
      products: enriched
    });
    saved = !!result;
  }

  return Response.json({
    ok: true,
    mode: all ? "all" : "misses-only",
    durationMs: Date.now() - startedAt,
    count: enriched.length,
    attempted: targetIndices.length,
    previousImages,
    newImages,
    newlyFound,
    lost,
    statuses,
    saved,
    dry
  });
}
