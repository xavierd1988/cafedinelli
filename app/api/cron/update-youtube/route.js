// =============================================================================
// /api/cron/update-youtube — endpoint POST pour pousser les vidéos scrapées
// =============================================================================
// scrape_youtube.py tourne sur "eye" à 09:33, scrape youtube.com/results
// pour les 15 trends YouTube de la newsletter, et POST 5 vidéos par trend.
// =============================================================================

import { saveYoutube } from "../../../../lib/youtubeStore.js";

export const maxDuration = 30;

function authorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function sanitizeVideo(v) {
  if (!v || typeof v !== "object") return null;
  return {
    videoId: typeof v.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(v.videoId)
      ? v.videoId : "",
    title: typeof v.title === "string" ? v.title.slice(0, 250) : "",
    channel: typeof v.channel === "string" ? v.channel.slice(0, 100) : "",
    thumbnail: typeof v.thumbnail === "string" ? v.thumbnail.slice(0, 500) : null,
    durationText: typeof v.durationText === "string" ? v.durationText.slice(0, 16) : null,
    publishedText: typeof v.publishedText === "string" ? v.publishedText.slice(0, 40) : null,
    viewCountText: typeof v.viewCountText === "string" ? v.viewCountText.slice(0, 40) : null
  };
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  const trendsIn = body?.trends;
  if (!trendsIn || typeof trendsIn !== "object") {
    return Response.json({ error: "missing trends object" }, { status: 400 });
  }

  const trends = {};
  let kwCount = 0;
  for (const [keyword, videos] of Object.entries(trendsIn)) {
    if (kwCount >= 30) break;
    if (typeof keyword !== "string" || !Array.isArray(videos)) continue;
    const cleanKw = keyword.slice(0, 120).trim();
    if (!cleanKw) continue;
    // On ne garde qu'une vidéo par trend — la popup n'affiche que la 1ère.
    const cleanVids = videos.slice(0, 1).map(sanitizeVideo).filter((v) => v && v.videoId && v.title);
    if (cleanVids.length > 0) {
      trends[cleanKw] = cleanVids;
      kwCount++;
    }
  }

  if (Object.keys(trends).length === 0) {
    return Response.json({ error: "no valid videos" }, { status: 400 });
  }

  const date = body.date || new Date().toISOString().slice(0, 10);
  const saved = await saveYoutube({ date, generatedAt: Date.now(), trends });

  return Response.json({
    ok: true,
    saved: !!saved,
    date,
    keywords: Object.keys(trends).length,
    totalVideos: Object.values(trends).reduce((s, a) => s + a.length, 0)
  });
}
