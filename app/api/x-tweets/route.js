// =============================================================================
// /api/x-tweets?q=keyword — lit les tweets scrapés par "eye"
// =============================================================================
// Retourne les 5 (max 8) derniers tweets pour un keyword. Les tweets
// sont scrapés une fois par jour par scrape_x.py sur "eye" et stockés
// dans Redis via /api/cron/update-x-tweets.
//
// Format réponse :
//   { query, items: [{handle, name, avatar, text, date, url, ...}], stale }
// =============================================================================

import { getCachedXTweets, findTweetsForKeyword } from "../../../lib/xTweetsStore.js";

export const revalidate = 300; // 5 min cache CDN

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

  const store = await getCachedXTweets();
  if (!store) {
    return Response.json({ query: q, items: [], stale: false, generatedAt: null });
  }

  const items = findTweetsForKeyword(store, q) || [];

  // Calcule un flag "stale" si le scrape date de plus de 30h.
  const stale = store.generatedAt
    ? (Date.now() - store.generatedAt) > 30 * 3600 * 1000
    : false;

  return Response.json({
    query: q,
    items: items.slice(0, 5),
    date: store.date,
    generatedAt: store.generatedAt,
    stale
  });
}
