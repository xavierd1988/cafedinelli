// Script one-shot : scrape Amazon une fois pour les 62 produits du POOL,
// imprime un mapping { name → imageUrl } à coller dans productsStore.js
// comme `image: "..."` à côté de chaque produit.
//
// USAGE :
//   node scripts/cache-product-images.js
//   node scripts/cache-product-images.js --concurrency=5 --delay=1500
//
// Tips :
//   - Lance-le depuis ta connexion résidentielle, pas un serveur Vercel
//     (Amazon block beaucoup moins les IPs maison).
//   - Si Amazon te robot-check, augmente --delay (ms entre requêtes).
//   - Tu peux relancer plusieurs fois : il imprime "MISS" pour les
//     produits non trouvés, tu peux compléter manuellement.
//
// Output :
//   {
//     "Stoneware mug":         "https://m.media-amazon.com/images/I/61abc.jpg",
//     "Wildflower honey":      "https://m.media-amazon.com/images/I/71xyz.jpg",
//     "Brass desk lamp":       null,
//     ...
//   }

import { POOL } from "../lib/productsStore.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function isAmazonImage(u) {
  return (
    typeof u === "string" &&
    /^https?:\/\/(m\.media-amazon\.com|images-[a-z0-9-]+\.ssl-images-amazon\.com)\//i.test(u)
  );
}

function looksLikeRobotCheck(html) {
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes("/errors/validatecaptcha") ||
    head.includes("type the characters you see") ||
    head.includes("enter the characters you see below") ||
    head.includes("api-services-support@amazon.com") ||
    head.includes("automated access to amazon data")
  );
}

function extractFromSearchPage(html) {
  const patterns = [
    /class="s-image"[^>]*src="([^"]+)"/,
    /<img[^>]+class="[^"]*s-image[^"]*"[^>]+src="([^"]+)"/,
    /<img[^>]+data-image-source-density="1"[^>]+src="([^"]+)"/,
    /<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && isAmazonImage(m[1])) return m[1];
  }
  const m2 = html.match(/<img[^>]+srcset="([^"]+)"/);
  if (m2) {
    const first = m2[1].split(",")[0]?.trim().split(" ")[0];
    if (first && isAmazonImage(first)) return first;
  }
  return null;
}

function extractFromProductPage(html) {
  const lp = html.match(/id="landingImage"[^>]+src="([^"]+)"/i);
  if (lp && isAmazonImage(lp[1])) return lp[1];
  const hi = html.match(/data-old-hires="([^"]+)"/);
  if (hi && isAmazonImage(hi[1])) return hi[1];
  const dyn = html.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
  if (dyn && isAmazonImage(dyn[1])) return dyn[1];
  const m = html.match(/<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
  if (m && isAmazonImage(m[1])) return m[1];
  return null;
}

async function fetchImage(product) {
  const useAsin = !!product.asin;
  const targetUrl = useAsin
    ? `https://www.amazon.com/dp/${product.asin}`
    : `https://www.amazon.com/s?k=${product.search}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
    const html = await res.text();
    if (looksLikeRobotCheck(html)) {
      return { ok: false, reason: "robot check" };
    }
    const image = useAsin
      ? extractFromProductPage(html)
      : extractFromSearchPage(html);
    if (!image) return { ok: false, reason: "no image found" };
    return { ok: true, image };
  } catch (err) {
    return { ok: false, reason: err?.message || "network" };
  }
}

function parseArgs(argv) {
  const args = { concurrency: 3, delay: 800 };
  for (const a of argv.slice(2)) {
    const m = a.match(/^--(\w+)=(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "concurrency") args.concurrency = Math.max(1, parseInt(v, 10));
    if (k === "delay") args.delay = Math.max(0, parseInt(v, 10));
  }
  return args;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { concurrency, delay } = parseArgs(process.argv);
  console.error(
    `Scraping ${POOL.length} products (concurrency=${concurrency}, delay=${delay}ms)…\n`
  );

  const results = {};
  let i = 0;
  let done = 0;

  async function worker() {
    while (i < POOL.length) {
      const p = POOL[i++];
      const r = await fetchImage(p);
      done += 1;
      if (r.ok) {
        results[p.name] = r.image;
        console.error(`✓ [${done}/${POOL.length}] ${p.name}`);
      } else {
        results[p.name] = null;
        console.error(`✗ [${done}/${POOL.length}] ${p.name}  (${r.reason})`);
      }
      if (delay > 0) await sleep(delay);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Imprime sur stdout (pas stderr) pour pouvoir rediriger > images.json
  console.log(JSON.stringify(results, null, 2));

  // Petit récap stderr
  const hits = Object.values(results).filter(Boolean).length;
  const misses = POOL.length - hits;
  console.error(`\nDone. ${hits} hits / ${misses} misses out of ${POOL.length}.`);
  if (misses > 0) {
    console.error(
      `Tip: relance le script (cache Redis n'est pas utilisé ici) ou\n` +
        `complète manuellement les "null" en cherchant l'image sur Amazon.`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
