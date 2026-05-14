// =============================================================================
// /api/cron/update-tiktok-videos — POST endpoint pour pousser les vidéos
// =============================================================================
// Utilisé par scrape_tiktok.py qui tourne sur "eye" avec un compte TikTok
// loggué. Auth via CRON_SECRET (Authorization: Bearer xxx).
// =============================================================================

import { saveTikTokVideos } from "../../../../lib/tiktokVideosStore.js";

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
    author: typeof v.author === "string" ? v.author.slice(0, 60) : "",
    handle: typeof v.handle === "string" ? v.handle.slice(0, 30) : "",
    avatar: typeof v.avatar === "string" ? v.avatar.slice(0, 500) : null,
    thumbnail: typeof v.thumbnail === "string" ? v.thumbnail.slice(0, 500) : null,
    desc: typeof v.desc === "string" ? v.desc.slice(0, 400) : "",
    url: typeof v.url === "string" ? v.url.slice(0, 300) : "",
    likes: typeof v.likes === "string" ? v.likes.slice(0, 12) : null,
    plays: typeof v.plays === "string" ? v.plays.slice(0, 12) : null,
    comments: typeof v.comments === "string" ? v.comments.slice(0, 12) : null
  };
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

  const trendsIn = body?.trends;
  if (!trendsIn || typeof trendsIn !== "object") {
    return Response.json({ error: "missing trends object" }, { status: 400 });
  }

  const trends = {};
  let kwCount = 0;
  for (const [keyword, videos] of Object.entries(trendsIn)) {
    if (kwCount >= 30) break;
    if (typeof keyword !== "string" || !Array.isArray(videos)) continue;
    const cleanKw = keyword.slice(0, 100).trim();
    if (!cleanKw) continue;
    const cleanVids = videos
      .slice(0, 5)
      .map(sanitizeVideo)
      .filter((v) => v && (v.url || v.desc));
    if (cleanVids.length > 0) {
      trends[cleanKw] = cleanVids;
      kwCount++;
    }
  }

  if (Object.keys(trends).length === 0) {
    return Response.json({ error: "no valid videos" }, { status: 400 });
  }

  const date = body.date || new Date().toISOString().slice(0, 10);
  const saved = await saveTikTokVideos({
    date,
    generatedAt: Date.now(),
    trends
  });

  return Response.json({
    ok: true,
    saved: !!saved,
    date,
    keywords: Object.keys(trends).length,
    totalVideos: Object.values(trends).reduce((s, a) => s + a.length, 0)
  });
}
