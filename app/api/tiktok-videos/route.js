// =============================================================================
// /api/tiktok-videos?q=keyword — lit les vidéos scrapées par "eye"
// =============================================================================
// Retourne les 3 (max 5) dernières vidéos TikTok pour un keyword.
// =============================================================================

import { getCachedTikTokVideos, findVideosForKeyword } from "../../../lib/tiktokVideosStore.js";

export const revalidate = 300;

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

  const store = await getCachedTikTokVideos();
  if (!store) {
    return Response.json({ query: q, items: [], stale: false, generatedAt: null });
  }

  const items = findVideosForKeyword(store, q) || [];

  const stale = store.generatedAt
    ? (Date.now() - store.generatedAt) > 30 * 3600 * 1000
    : false;

  return Response.json({
    query: q,
    items: items.slice(0, 3),
    date: store.date,
    generatedAt: store.generatedAt,
    stale
  });
}
