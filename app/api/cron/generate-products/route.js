// =============================================================================
// CRON : génération quotidienne des produits du jour
// =============================================================================
// Déclenché par Vercel à 14h et 15h UTC ; seule l'exécution de 10h
// America/New_York travaille, pour suivre les changements d'heure.
//
// Étapes :
//   1. Lit la newsletter du jour (Redis "newsletter:latest")
//   2. Extrait au maximum 30 noms des sections Amazon de la newsletter
//      → aucun remplissage généré si la liste est partielle ou absente
//   3. Pour chaque produit, scrape Amazon (page recherche) pour récupérer
//      ASIN + image principale
//   4. Sauvegarde le tout dans dailyProductsStore (Redis 26h TTL)
//
// Sécurité : Vercel inclut `Authorization: Bearer <CRON_SECRET>` quand
// configuré. On vérifie ce header en prod pour éviter qu'un attaquant
// déclenche le cron à la main et multiplie les requêtes Amazon.
//
// Manuel : on peut aussi le déclencher avec un GET classique pour tester
// (?force=1 pour régénérer, sans contourner la date ou la source du jour).
// =============================================================================

import { getLatestNewsletter } from "../../../../lib/newsletterStore.js";
import { saveDailyProducts, getCachedDailyProducts } from "../../../../lib/dailyProductsStore.js";
import { getAmazonNewsletterNames } from "../../../../lib/newsletterParse.js";

// On limite la durée totale à ~50s : Vercel cron timeout généreux mais
// garde de la marge. 30 produits × 1.5s scraping = 45s.
export const maxDuration = 60;

const TARGET_COUNT = 30;
const SCRAPE_CONCURRENCY = 4;
const SCRAPE_DELAY_MS = 250;

const newYorkClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23"
});

function getNewYorkClock(now) {
  const parts = Object.fromEntries(
    newYorkClock.formatToParts(now).map(({ type, value }) => [type, value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

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

// =============================================================================
// EXTRACTION directe des produits Amazon depuis la newsletter HTML.
// =============================================================================
// La newsletter contient déjà 30 produits dans les sections AMAZON BEST
// SELLERS — TOP 15 et AMAZON MOVERS & SHAKERS — TOP 15. Les frontend
// (CafeScene, PaperPanel) matchent par nom contre ce store ; il FAUT
// donc que les noms du store soient EXACTEMENT ceux de la newsletter
// — sinon mismatch et la vitrine reste vide.
//
// Cette fonction lit les rangées de tableaux ou de cartes de chaque
// section Amazon et retourne les noms. Si la newsletter est introuvable ou
// n'a pas de section AMAZON, on retourne [] et la collecte est ignorée.
// Ces noms proviennent du digest ; leur présence ne certifie pas sa source.
// =============================================================================

function extractAmazonItemsFromNewsletter(html) {
  return getAmazonNewsletterNames(html, TARGET_COUNT);
}

// Devine un emoji simple à partir du nom du produit. Si rien ne match,
// retourne 🛒 (caddie). Liste alignée avec scrape_morning.py (eye).
function emojiForName(name) {
  const n = (name || "").toLowerCase();
  const rules = [
    [/airpod|earbud|headphone|beats|airpods/, "🎧"],
    [/iphone|phone|samsung galaxy/, "📱"],
    [/watch|garmin|apple watch/, "⌚"],
    [/mug|tumbler|stanley|hydro|quencher|bottle|cup/, "☕"],
    [/lotion|oil|serum|cream|moisturiz|olaplex|mielle|eos|kitsch/, "🧴"],
    [/patch|cosmetic|toner|skincare|medicube/, "💄"],
    [/ice maker|silonn|appliance/, "🧊"],
    [/duvet|bedding|sheet|pillow|bedsure/, "🛏️"],
    [/lego|toy|squishy|needoh|game/, "🧩"],
    [/sunscreen|spf|neutrogena|banana boat/, "☀️"],
    [/fan|cooling|dreo|tower|air purifier|levoit/, "🌀"],
    [/vacuum|shark|bissell/, "🧹"],
    [/crocs|clog|shoe|boot|sneaker/, "👟"],
    [/card|greeting|pop.?up/, "💌"],
    [/claritin|allergy|gummies|vitamin|supplement/, "💊"],
    [/planner|notebook|journal/, "📒"],
    [/scarf|silk|top|shirt|tank/, "👚"],
    [/hat|fascinator|derby/, "🎩"],
    [/roller|jade|gua sha/, "🪞"],
    [/stove|fire|patio/, "🔥"],
    [/bicycle|bike|tire/, "🚲"],
    [/airfryer|fryer|ninja|cuisinart|toaster|crock|blender|coffee maker/, "🍳"],
    [/mask|led mask/, "😷"],
    [/projector|lamp|light/, "💡"],
    [/sock|compression/, "🧦"],
    [/selfie|monitor|vlog|mic|maybesta/, "📷"],
    [/airtag|tracker/, "📍"],
    [/lavalier|microphone/, "🎙️"],
    [/tv|fire tv|chromecast|roku/, "📺"],
    [/luggage|spinner|suitcase/, "🧳"],
    [/power bank|charger|cable/, "🔋"],
    [/tent|camping|coleman/, "⛺"],
    [/kindle|book|reader/, "📖"],
    [/mother/, "💝"]
  ];
  for (const [r, e] of rules) if (r.test(n)) return e;
  return "🛒";
}

// Construit un search query Amazon à partir d'un nom : strip ponctuation,
// max 80 chars (limite Amazon URL safe).
function searchFromName(name) {
  return String(name || "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function scrapeAmazonForImage(product) {
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(product.search)}`;
  let imageUrl = null;
  let asin = null;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": pickUA(product.search),
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return { imageUrl: null, asin: null };
    const html = await res.text();
    if (looksLikeRobotCheck(html)) return { imageUrl: null, asin: null };

    // ASIN du 1er résultat — Amazon embed l'ASIN dans le data-asin
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
  } catch {
    // silencieux : on retourne null, le client affichera l'emoji
  }
  return { imageUrl, asin };
}

function authorized(request) {
  // En prod, Vercel envoie Authorization: Bearer <CRON_SECRET>
  // (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // pas configuré → on accepte (dev)
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function GET(request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const { date: today, hour } = getNewYorkClock(new Date());
  const scheduled = (request.headers.get("user-agent") || "").startsWith("vercel-cron/");

  // Vercel programme en UTC. Les deux candidats couvrent EST et EDT ;
  // ignorer l'autre heure sans toucher aux déclenchements manuels.
  if (!force && scheduled && hour !== 10) {
    return Response.json({ skipped: true, reason: "outside 10 AM America/New_York", date: today });
  }

  const newsletter = await getLatestNewsletter().catch(() => null);
  if (newsletter?.date !== today || typeof newsletter?.html !== "string" || !newsletter.html.trim()) {
    return Response.json({
      skipped: true,
      reason: "today's newsletter is not available",
      date: today,
      newsletterDate: newsletter?.date || null
    });
  }

  // Évite les doubles-runs : si on a déjà généré aujourd'hui, on no-op
  // sauf ?force=1.
  if (!force) {
    const cached = await getCachedDailyProducts();
    if (cached && cached.date === today) {
      return Response.json({
        skipped: true,
        reason: "already generated today",
        date: cached.date,
        count: cached.products.length
      });
    }
  }

  const startedAt = Date.now();

  // Utiliser uniquement les noms présents dans le digest du jour.
  // Une liste partielle reste partielle ; une source absente ne crée aucun produit.
  const sourceUsed = "newsletter-extract";
  const extracted = extractAmazonItemsFromNewsletter(newsletter.html);
  if (extracted.length === 0) {
    return Response.json({
      skipped: true, saved: false, reason: "no Amazon products in today's newsletter", date: today
    });
  }
  const proposals = extracted.map((name) => ({
    emoji: emojiForName(name), name, search: searchFromName(name)
  }));

  // 2. Scrape Amazon en concurrence limitée
  const enriched = [];
  let i = 0;
  async function worker() {
    while (i < proposals.length) {
      const idx = i++;
      const p = proposals[idx];
      const { imageUrl, asin } = await scrapeAmazonForImage(p);
      enriched[idx] = { ...p, image: imageUrl, asin };
      if (SCRAPE_DELAY_MS > 0) await new Promise((r) => setTimeout(r, SCRAPE_DELAY_MS));
    }
  }
  await Promise.all(Array.from({ length: SCRAPE_CONCURRENCY }, () => worker()));

  const publishDate = getNewYorkClock(new Date()).date;
  if (publishDate !== today) {
    return Response.json({
      skipped: true, saved: false, reason: "New York date changed during collection", date: publishDate
    });
  }

  // 3. Sauvegarde — avec garde-fou : si Amazon a tout bloqué (0 image
  //    extraite), on NE SAUVEGARDE PAS pour éviter d'écraser un cache
  //    précédent qui avait des images valides.
  //
  // EXCEPTION ?force=1 : on sauve toujours, même sans images. Sert quand
  // on veut régénérer les noms du digest (avec les bons `search`) et
  // déléguer le scraping à un worker externe (scrape_morning.py sur eye,
  // IP résidentielle = pas blocked par Amazon).
  const withImage = enriched.filter((p) => p.image).length;
  const MIN_IMAGES_TO_SAVE = Math.min(5, enriched.length);

  let saved = null;
  let skippedSave = false;
  if (!force && withImage < MIN_IMAGES_TO_SAVE) {
    skippedSave = true;
    console.warn(
      `cron/generate-products: only ${withImage}/${enriched.length} images scraped — ` +
      `Amazon likely rate-limited. Keeping previous cache instead of overwriting.`
    );
  } else {
    try {
      saved = await saveDailyProducts({
        date: today,
        generatedAt: Date.now(),
        products: enriched
      });
    } catch {
      return Response.json({ ok: false, saved: false, error: "persistence unavailable" }, { status: 503 });
    }
    if (!saved) {
      return Response.json({ ok: false, saved: false, error: "persistence unavailable" }, { status: 503 });
    }
  }

  const durationMs = Date.now() - startedAt;
  return Response.json({
    ok: !skippedSave,
    skipped: skippedSave,
    date: today,
    count: enriched.length,
    withImage,
    withoutImage: enriched.length - withImage,
    durationMs,
    saved: !!saved,
    skippedSave,
    skippedReason: skippedSave
      ? `only ${withImage} images scraped, kept previous cache`
      : null,
    sourceUsed
  });
}
