// =============================================================================
// CRON : génération quotidienne des produits du jour
// =============================================================================
// Déclenché par Vercel chaque matin à 9h UTC (vercel.json).
//
// Étapes :
//   1. Lit la newsletter du jour (Redis "newsletter:latest")
//   2. Demande à Groq de proposer 30 produits Amazon liés aux trends
//      → JSON [{ emoji, name, search }, ...]
//   3. Pour chaque produit, scrape Amazon (page recherche) pour récupérer
//      ASIN + image principale
//   4. Sauvegarde le tout dans dailyProductsStore (Redis 26h TTL)
//
// Sécurité : Vercel inclut `Authorization: Bearer <CRON_SECRET>` quand
// configuré. On vérifie ce header en prod pour éviter qu'un attaquant
// déclenche le cron à la main et fasse exploser nos appels Groq.
//
// Manuel : on peut aussi le déclencher avec un GET classique pour tester
// (?force=1 pour bypasser le check d'âge).
// =============================================================================

import { askGroq } from "../../../../lib/groqClient.js";
import { getLatestNewsletter } from "../../../../lib/newsletterStore.js";
import { saveDailyProducts, getCachedDailyProducts } from "../../../../lib/dailyProductsStore.js";

// On limite la durée totale à ~50s : Vercel cron timeout généreux mais
// garde de la marge. 30 produits × 1.5s scraping = 45s.
export const maxDuration = 60;

const TARGET_COUNT = 30;
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

function htmlToText(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?!\s*<)/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

const SYSTEM_PROMPT = `You are a curator for Dinelli's Café, a morning internet café that serves a daily news digest.

You will be given today's newsletter (the "morning digest"). Your job: propose ${TARGET_COUNT} Amazon-shoppable products that connect to the trends, stories, and themes of the digest.

REQUIREMENTS
- Exactly ${TARGET_COUNT} items. Not more, not less.
- VARIED categories: food, beauty, home, books, gadgets, kids, fashion, kitchen, wellness, etc. Don't pile up 10 mugs.
- Each item must be a REAL, mainstream, currently-on-Amazon product (not invented brand names).
- Tie each item to a thread in the digest when possible (e.g. Met Gala → fascinators, allergy peak → Claritin, Mother's Day → pop-up cards).
- Some can be timeless cozy-café staples (notebook, candle, mug) for the rest of the catalog.

OUTPUT FORMAT — STRICT JSON, no prose, no markdown fences:
[
  { "emoji": "🌸", "name": "Mother's Day pop-up card", "search": "mothers day pop up card 3D" },
  { "emoji": "🪖", "name": "Big derby fascinator hat", "search": "kentucky derby fascinator hat women" },
  ...
]

emoji: a single, fitting emoji for the product
name:  short, displayable name (max 40 chars)
search: 3-7 keywords joined by spaces (NOT plus signs), specific enough that Amazon's first result is the right product

OUTPUT ONLY THE JSON ARRAY. No explanation, no preamble, no closing words.`;

async function generateProducts(newsletter) {
  const newsText = newsletter ? htmlToText(newsletter.html).slice(0, 3500) : "";
  const userPrompt = newsText
    ? `Today's digest:\n\n---\n${newsletter?.subject ? `Subject: ${newsletter.subject}\n` : ""}${newsText}\n---\n\nGenerate the ${TARGET_COUNT} products now.`
    : `No newsletter available today. Generate ${TARGET_COUNT} timeless cozy-café products instead.`;

  const raw = await askGroq({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 3500,
    temperature: 0.85
  });

  // Tente d'extraire le JSON même si le modèle ajoute des fences
  let jsonText = raw.trim();
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) jsonText = fence[1];
  const firstBracket = jsonText.indexOf("[");
  const lastBracket = jsonText.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    jsonText = jsonText.slice(firstBracket, lastBracket + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Groq returned invalid JSON: ${e.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Groq output is not an array");
  }
  return parsed
    .filter((p) => p && typeof p.name === "string" && typeof p.search === "string")
    .slice(0, TARGET_COUNT)
    .map((p) => ({
      emoji: typeof p.emoji === "string" ? p.emoji : "✨",
      name: p.name.slice(0, 60),
      search: p.search
        .replace(/[^A-Za-z0-9 ]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80)
    }));
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

  // Évite les doubles-runs : si on a déjà généré aujourd'hui, on no-op
  // sauf ?force=1.
  if (!force) {
    const cached = await getCachedDailyProducts();
    const today = new Date().toISOString().slice(0, 10);
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
  const newsletter = await getLatestNewsletter().catch(() => null);

  // 1. Génération via Groq
  let proposals;
  try {
    proposals = await generateProducts(newsletter);
  } catch (err) {
    console.error("cron/generate-products: groq failed:", err?.message);
    return Response.json({ error: "groq failed", detail: err?.message }, { status: 500 });
  }

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

  // 3. Sauvegarde — avec garde-fou : si Amazon a tout bloqué (0 image
  //    extraite), on NE SAUVEGARDE PAS pour éviter d'écraser un cache
  //    précédent qui avait des images valides.
  //
  // EXCEPTION ?force=1 : on sauve toujours, même sans images. Sert quand
  // on veut juste régénérer la liste Groq (avec les bons `search`) et
  // déléguer le scraping à un worker externe (scrape_morning.py sur eye,
  // IP résidentielle = pas blocked par Amazon).
  const today = new Date().toISOString().slice(0, 10);
  const withImage = enriched.filter((p) => p.image).length;
  const MIN_IMAGES_TO_SAVE = 5;

  let saved = null;
  let skippedSave = false;
  if (!force && withImage < MIN_IMAGES_TO_SAVE) {
    skippedSave = true;
    console.warn(
      `cron/generate-products: only ${withImage}/${enriched.length} images scraped — ` +
      `Amazon likely rate-limited. Keeping previous cache instead of overwriting.`
    );
  } else {
    saved = await saveDailyProducts({
      date: today,
      generatedAt: Date.now(),
      products: enriched
    });
  }

  const durationMs = Date.now() - startedAt;
  return Response.json({
    ok: true,
    date: today,
    count: enriched.length,
    withImage,
    withoutImage: enriched.length - withImage,
    durationMs,
    saved: !!saved,
    skippedSave,
    skippedReason: skippedSave
      ? `only ${withImage} images scraped, kept previous cache`
      : null
  });
}
