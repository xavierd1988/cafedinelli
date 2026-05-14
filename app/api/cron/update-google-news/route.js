// =============================================================================
// /api/cron/update-google-news — endpoint POST pour pousser les news scrapées
// =============================================================================
// scrape_google.py tourne sur "eye" à 09:32, fetch Google News RSS pour
// les 25 trends Google de la newsletter, et POST le résultat ici.
// Auth via CRON_SECRET (header Authorization: Bearer xxx).
// =============================================================================

import { saveGoogleNews } from "../../../../lib/googleNewsStore.js";

export const maxDuration = 30;

function authorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function sanitizeItem(it) {
  if (!it || typeof it !== "object") return null;
  return {
    title: typeof it.title === "string" ? it.title.slice(0, 300) : "",
    link: typeof it.link === "string" ? it.link.slice(0, 800) : "",
    source: typeof it.source === "string" ? it.source.slice(0, 100) : "",
    pubDate: typeof it.pubDate === "string" ? it.pubDate.slice(0, 60) : ""
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
  for (const [keyword, items] of Object.entries(trendsIn)) {
    if (kwCount >= 30) break;
    if (typeof keyword !== "string" || !Array.isArray(items)) continue;
    const cleanKw = keyword.slice(0, 120).trim();
    if (!cleanKw) continue;
    const cleanItems = items.slice(0, 8).map(sanitizeItem).filter((i) => i && i.title && i.link);
    if (cleanItems.length > 0) {
      trends[cleanKw] = cleanItems;
      kwCount++;
    }
  }

  if (Object.keys(trends).length === 0) {
    return Response.json({ error: "no valid items" }, { status: 400 });
  }

  const date = body.date || new Date().toISOString().slice(0, 10);
  const saved = await saveGoogleNews({ date, generatedAt: Date.now(), trends });

  return Response.json({
    ok: true,
    saved: !!saved,
    date,
    keywords: Object.keys(trends).length,
    totalItems: Object.values(trends).reduce((s, a) => s + a.length, 0)
  });
}
