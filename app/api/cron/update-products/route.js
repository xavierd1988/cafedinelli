// =============================================================================
// /api/cron/update-products — endpoint POST pour pousser une liste enrichie
// =============================================================================
// Utilisé par scrape_morning.py qui tourne sur "eye" (Mac résidentiel sur
// le WiFi maison). eye scrape Amazon depuis sa vraie IP résidentielle
// (Amazon ne blacklist pas), puis POST le résultat enrichi ici.
//
// Auth via CRON_SECRET (header Authorization: Bearer xxx) — identique
// à /api/cron/generate-products. En local sans CRON_SECRET, accès libre.
//
// Le payload remplace COMPLÈTEMENT le store du jour. Le caller doit
// donc préserver les produits existants qu'il n'a pas re-scrapés (la
// logique de fusion est côté caller, pas ici — KISS).
// =============================================================================

import { getCachedDailyProducts, saveDailyProducts } from "../../../../lib/dailyProductsStore.js";

export const maxDuration = 30;

function authorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev sans CRON_SECRET → accès libre
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const products = Array.isArray(body?.products) ? body.products : null;
  if (!products || products.length === 0) {
    return Response.json({ error: "no products in body" }, { status: 400 });
  }

  // Garde le jour existant si fourni (matching avec le cron Groq qui a
  // déjà créé la liste). Sinon date du jour.
  const cached = await getCachedDailyProducts();
  const date = body.date || cached?.date || new Date().toISOString().slice(0, 10);

  // Sanitize light : on ne garde que les champs attendus + on limite
  // les longueurs pour éviter qu'un payload corrompu balaie le cache.
  const sanitized = products.slice(0, 50).map((p) => ({
    emoji: typeof p?.emoji === "string" ? p.emoji.slice(0, 8) : "✨",
    name: typeof p?.name === "string" ? p.name.slice(0, 80) : "",
    search: typeof p?.search === "string" ? p.search.slice(0, 120) : "",
    image: typeof p?.image === "string" ? p.image.slice(0, 500) : null,
    asin: typeof p?.asin === "string" ? p.asin.slice(0, 20) : null,
    // Prix au format Amazon "$24.99" (scrappé du span a-offscreen).
    price: typeof p?.price === "string" ? p.price.slice(0, 16) : null
  })).filter((p) => p.name);

  const saved = await saveDailyProducts({
    date,
    generatedAt: Date.now(),
    products: sanitized
  });

  return Response.json({
    ok: true,
    saved: !!saved,
    date,
    count: sanitized.length,
    withImage: sanitized.filter((p) => p.image).length
  });
}
