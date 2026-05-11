// Liste quotidienne des 30 produits "On the shelf".
//
// Source de vérité, par ordre de priorité :
//   1. Cache Redis "cafe:products:daily" — généré chaque matin par le
//      cron /api/cron/generate-products. Produits liés aux trends de la
//      newsletter du jour, photos Amazon scrapées une fois pour toutes.
//   2. Fallback sur le POOL statique (lib/productsStore.js) — pool
//      café/cosy fixe avec rotation déterministe par date. Servi quand
//      le cron n'a pas tourné, Redis est down, ou en local sans
//      Upstash configuré.
//
// Aucune génération live ici : tout est déjà préparé en amont, on lit.

import { getDailyProducts as getStaticDailyProducts, getProductsDateKey } from "../../../lib/productsStore.js";
import { getCachedDailyProducts } from "../../../lib/dailyProductsStore.js";

export async function GET() {
  const today = getProductsDateKey();

  // 1. Tente le cache "live" généré par le cron
  const cached = await getCachedDailyProducts();
  if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
    // On normalise le format pour matcher ce qu'attend le client
    // (id, emoji, name, image, asin, amazonUrl).
    const products = cached.products.map((p, i) => ({
      id: `${cached.date}-${i}`,
      emoji: p.emoji || "✨",
      name: p.name,
      // search exposé pour que les workers externes (scrape_morning.py
      // sur eye) puissent re-scraper avec les bons keywords. Non utilisé
      // par le rendu client, donc inoffensif.
      search: p.search || "",
      image: p.image || null,
      asin: p.asin || null,
      amazonUrl: p.asin
        ? `https://www.amazon.com/dp/${p.asin}`
        : `https://www.amazon.com/s?k=${encodeURIComponent(p.search || p.name)}`
    }));
    return Response.json({
      date: cached.date,
      generatedAt: cached.generatedAt,
      source: "cron",
      products
    });
  }

  // 2. Fallback : le pool statique
  return Response.json({
    date: today,
    source: "static-pool",
    products: getStaticDailyProducts(30)
  });
}
