// =============================================================================
// X TWEETS STORE — tweets scrapés chaque matin pour les 15 trends X
// =============================================================================
// Le scraper Playwright tourne sur "eye" (Mac résidentiel, IP perso) avec
// un compte X loggué. Une fois par jour à 09:35, il fetch x.com/search
// pour chacun des 15 trends X de la newsletter et stocke les 5 premiers
// tweets ici. Structure :
//
//   {
//     date: "2026-05-13",
//     generatedAt: <unix ms>,
//     trends: {
//       "Mike Tyson": [{handle, name, avatar, text, date, url, likes}, ...],
//       "OpenAI": [...]
//     }
//   }
//
// Frontend lit via /api/x-tweets?q=KEYWORD — match case-insensitive.
// TTL 26h : si le scrape rate, on garde les tweets de la veille.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:x:tweets:daily";
const TTL_SEC = 26 * 3600;

export async function getCachedXTweets() {
  try {
    const r = getRedis();
    const data = await r.get(KEY);
    if (!data) return null;
    const obj = typeof data === "string" ? JSON.parse(data) : data;
    if (!obj || typeof obj.trends !== "object" || obj.trends === null) return null;
    return obj;
  } catch (err) {
    console.warn("xTweetsStore.getCachedXTweets:", err?.message || err);
    return null;
  }
}

export async function saveXTweets(payload) {
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
    console.warn("xTweetsStore.saveXTweets:", err?.message || err);
    return null;
  }
}

// Recherche case-insensitive du keyword dans le store.
// Retourne le tableau de tweets ou null si rien.
export function findTweetsForKeyword(store, keyword) {
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
