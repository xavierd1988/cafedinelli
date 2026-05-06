// =============================================================================
// DAILY PRODUCTS STORE — produits du jour générés par cron à 9h
// =============================================================================
// Chaque matin, le cron /api/cron/generate-products :
//   1. Lit la newsletter du jour
//   2. Demande à Groq de générer ~30 produits Amazon liés aux trends
//   3. Scrape Amazon pour récupérer ASIN + image de chaque produit
//   4. Stocke ici via saveDailyProducts()
//
// Toute la journée, /api/products lit via getDailyProducts() — cache lu en
// Redis, servi instantanément.
//
// Si Redis tombe ou si le cron a échoué : on retombe sur le POOL statique
// (productsStore.js) → l'app n'est jamais cassée, dégradation gracieuse.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:products:daily";
// 26h pour couvrir la fenêtre de génération. Le cron tourne à 9h, le store
// est valide jusqu'au lendemain 11h. Si le cron rate, on garde la liste de
// la veille tant qu'on n'en a pas une fraîche.
const TTL_SEC = 26 * 3600;

export async function getCachedDailyProducts() {
  try {
    const r = getRedis();
    const data = await r.get(KEY);
    if (!data) return null;
    const obj = typeof data === "string" ? JSON.parse(data) : data;
    if (!obj || !Array.isArray(obj.products) || obj.products.length === 0) return null;
    return obj;
  } catch (err) {
    console.warn("dailyProductsStore.getCachedDailyProducts:", err?.message || err);
    return null;
  }
}

export async function saveDailyProducts(payload) {
  try {
    const r = getRedis();
    const safe = {
      date: payload.date || new Date().toISOString().slice(0, 10),
      generatedAt: payload.generatedAt || Date.now(),
      products: Array.isArray(payload.products) ? payload.products : []
    };
    await r.set(KEY, JSON.stringify(safe), { ex: TTL_SEC });
    return safe;
  } catch (err) {
    console.warn("dailyProductsStore.saveDailyProducts:", err?.message || err);
    return null;
  }
}
