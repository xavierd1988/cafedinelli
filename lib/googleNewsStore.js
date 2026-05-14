// =============================================================================
// GOOGLE NEWS STORE — articles scrapés chaque matin pour les 25 trends Google
// =============================================================================
// scrape_google.py tourne sur "eye" à 09:32 et fetch Google News RSS
// pour chacun des 25 trends Google de la newsletter. Stocke ici les 5
// premiers articles par trend. Structure :
//
//   {
//     date: "2026-05-14",
//     generatedAt: <unix ms>,
//     trends: {
//       "Mike Tyson": [{title, link, source, pubDate}, ...],
//       "OpenAI": [...]
//     }
//   }
//
// Frontend lit via /api/google-news?q=KEYWORD — match case-insensitive,
// fallback RSS live si pas en cache.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:google:news:daily";
const TTL_SEC = 26 * 3600;

export async function getCachedGoogleNews() {
  try {
    const r = getRedis();
    const data = await r.get(KEY);
    if (!data) return null;
    const obj = typeof data === "string" ? JSON.parse(data) : data;
    if (!obj || typeof obj.trends !== "object" || obj.trends === null) return null;
    return obj;
  } catch (err) {
    console.warn("googleNewsStore.getCachedGoogleNews:", err?.message || err);
    return null;
  }
}

export async function saveGoogleNews(payload) {
  try {
    const r = getRedis();
    const safe = {
      date: payload.date || new Date().toISOString().slice(0, 10),
      generatedAt: payload.generatedAt || Date.now(),
      trends: payload.trends && typeof payload.trends === "object" ? payload.trends : {}
    };
    await r.set(KEY, JSON.stringify(safe), { ex: TTL_SEC });
    return safe;
  } catch (err) {
    console.warn("googleNewsStore.saveGoogleNews:", err?.message || err);
    return null;
  }
}

export function findNewsForKeyword(store, keyword) {
  if (!store || !store.trends) return null;
  const needle = String(keyword || "").trim().toLowerCase();
  if (!needle) return null;
  for (const [k, v] of Object.entries(store.trends)) {
    if (String(k).trim().toLowerCase() === needle) {
      return Array.isArray(v) ? v : null;
    }
  }
  return null;
}
