// =============================================================================
// /api/cron/update-x-tweets — endpoint POST pour pousser les tweets scrapés
// =============================================================================
// Utilisé par scrape_x.py qui tourne sur "eye" (Mac résidentiel, IP perso)
// avec un compte X loggué dans un profil Playwright dédié. Le scraper
// fetch x.com/search?q=KEYWORD&f=live pour les 15 trends X de la
// newsletter, parse les 5 premiers tweets, et POST le résultat ici.
//
// Auth via CRON_SECRET (header Authorization: Bearer xxx).
// =============================================================================

import { saveXTweets } from "../../../../lib/xTweetsStore.js";

export const maxDuration = 30;

function authorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function sanitizeTweet(t) {
  if (!t || typeof t !== "object") return null;
  return {
    handle: typeof t.handle === "string" ? t.handle.slice(0, 30) : "",
    name: typeof t.name === "string" ? t.name.slice(0, 60) : "",
    avatar: typeof t.avatar === "string" ? t.avatar.slice(0, 500) : null,
    text: typeof t.text === "string" ? t.text.slice(0, 600) : "",
    date: typeof t.date === "string" ? t.date.slice(0, 40) : "",
    url: typeof t.url === "string" ? t.url.slice(0, 300) : "",
    likes: typeof t.likes === "string" ? t.likes.slice(0, 12) : null,
    replies: typeof t.replies === "string" ? t.replies.slice(0, 12) : null,
    reposts: typeof t.reposts === "string" ? t.reposts.slice(0, 12) : null
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

  // Sanitize : on garde max 30 keywords, max 8 tweets par keyword.
  const trends = {};
  let kwCount = 0;
  for (const [keyword, tweets] of Object.entries(trendsIn)) {
    if (kwCount >= 30) break;
    if (typeof keyword !== "string" || !Array.isArray(tweets)) continue;
    const cleanKw = keyword.slice(0, 100).trim();
    if (!cleanKw) continue;
    const cleanTweets = tweets
      .slice(0, 8)
      .map(sanitizeTweet)
      .filter((t) => t && t.text);
    if (cleanTweets.length > 0) {
      trends[cleanKw] = cleanTweets;
      kwCount++;
    }
  }

  if (Object.keys(trends).length === 0) {
    return Response.json({ error: "no valid tweets" }, { status: 400 });
  }

  const date = body.date || new Date().toISOString().slice(0, 10);
  const saved = await saveXTweets({
    date,
    generatedAt: Date.now(),
    trends
  });

  return Response.json({
    ok: true,
    saved: !!saved,
    date,
    keywords: Object.keys(trends).length,
    totalTweets: Object.values(trends).reduce((s, a) => s + a.length, 0)
  });
}
