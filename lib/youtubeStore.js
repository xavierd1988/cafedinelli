// =============================================================================
// YOUTUBE STORE — vidéos scrapées chaque matin pour les 15 trends YouTube
// =============================================================================
// scrape_youtube.py tourne sur "eye" à 09:33 et fetch youtube.com/results
// pour chacun des 15 trends YouTube de la newsletter. Stocke ici les 5
// premières vidéos par trend (videoId, title, channel, thumbnail, durationText).
//
// Frontend lit via /api/youtube-search?q=KEYWORD — match case-insensitive,
// fallback live scrape si pas en cache.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:youtube:daily";
const TTL_SEC = 26 * 3600;

export async function getCachedYoutube() {
  try {
    const r = getRedis();
    const data = await r.get(KEY);
    if (!data) return null;
    const obj = typeof data === "string" ? JSON.parse(data) : data;
    if (!obj || typeof obj.trends !== "object" || obj.trends === null) return null;
    return obj;
  } catch (err) {
    console.warn("youtubeStore.getCachedYoutube:", err?.message || err);
    return null;
  }
}

export async function saveYoutube(payload) {
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
    console.warn("youtubeStore.saveYoutube:", err?.message || err);
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
