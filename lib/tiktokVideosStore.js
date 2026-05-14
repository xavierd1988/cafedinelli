// =============================================================================
// TIKTOK VIDEOS STORE — vidéos scrapées chaque matin pour les 15 trends TikTok
// =============================================================================
// Le scraper Playwright tourne sur "eye" (Mac résidentiel, IP perso) avec
// un compte TikTok loggué. Une fois par jour à 09:40, il fetch
// tiktok.com/search?q=... pour chacun des 15 trends TikTok de la
// newsletter et stocke les 3 premières vidéos.
//
// Structure :
//   {
//     date: "2026-05-13",
//     generatedAt: <unix ms>,
//     trends: {
//       "Mike Tyson": [{author, handle, avatar, thumbnail, desc, url, likes, plays}, ...],
//       ...
//     }
//   }
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:tiktok:videos:daily";
const TTL_SEC = 26 * 3600;

export async function getCachedTikTokVideos() {
  try {
    const r = getRedis();
    const data = await r.get(KEY);
    if (!data) return null;
    const obj = typeof data === "string" ? JSON.parse(data) : data;
    if (!obj || typeof obj.trends !== "object" || obj.trends === null) return null;
    return obj;
  } catch (err) {
    console.warn("tiktokVideosStore.getCachedTikTokVideos:", err?.message || err);
    return null;
  }
}

export async function saveTikTokVideos(payload) {
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
    console.warn("tiktokVideosStore.saveTikTokVideos:", err?.message || err);
    return null;
  }
}

export function findVideosForKeyword(store, keyword) {
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
