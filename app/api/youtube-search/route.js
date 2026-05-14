// =============================================================================
// /api/youtube-search?q=keyword
// =============================================================================
// 1. Lit d'abord le cache Redis (alimenté par scrape_youtube.py sur eye,
//    cron 09:33). Si trouvé → renvoie jusqu'à 5 vidéos.
// 2. Fallback live : scrape youtube.com/results et extrait la 1ère vidéo.
//
// Retourne : { query, items: [{videoId, title, channel, thumbnail, ...}] }
// =============================================================================

import { getCachedYoutube, findVideosForKeyword } from "../../../lib/youtubeStore.js";

export const revalidate = 600; // 10 min cache CDN

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
           "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function findFirstVideo(node, found) {
  if (!node || typeof node !== "object" || found.value) return;
  if (Array.isArray(node)) {
    for (const x of node) {
      findFirstVideo(x, found);
      if (found.value) return;
    }
    return;
  }
  if (node.videoRenderer && typeof node.videoRenderer === "object") {
    const v = node.videoRenderer;
    const id = v.videoId;
    if (typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      found.value = v;
      return;
    }
  }
  for (const k of Object.keys(node)) {
    findFirstVideo(node[k], found);
    if (found.value) return;
  }
}

function textFromRuns(obj) {
  if (!obj || typeof obj !== "object") return "";
  if (typeof obj.simpleText === "string") return obj.simpleText;
  if (Array.isArray(obj.runs)) return obj.runs.map((r) => r?.text || "").join("");
  return "";
}

function bestThumb(v) {
  const thumbs = v?.thumbnail?.thumbnails;
  if (!Array.isArray(thumbs) || thumbs.length === 0) return null;
  let best = thumbs[0];
  for (const t of thumbs) {
    if ((t?.width || 0) > (best?.width || 0)) best = t;
  }
  return best?.url || null;
}

async function fetchLiveFirst(q) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  let html;
  try {
    const r = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return [];
    html = await r.text();
  } catch {
    return [];
  }

  const startMarker = "var ytInitialData = ";
  const idx = html.indexOf(startMarker);
  if (idx < 0) return [];
  const after = html.slice(idx + startMarker.length);
  const endMatch = after.match(/};\s*<\/script>|};\s*\n/);
  if (!endMatch) return [];
  const jsonStr = after.slice(0, endMatch.index + 1);

  let data;
  try { data = JSON.parse(jsonStr); }
  catch { return []; }

  const found = { value: null };
  findFirstVideo(data, found);
  if (!found.value) return [];

  const v = found.value;
  return [{
    videoId: v.videoId,
    title: textFromRuns(v.title),
    channel: textFromRuns(v.ownerText) || textFromRuns(v.longBylineText) || "",
    thumbnail: bestThumb(v),
    durationText: textFromRuns(v.lengthText) || "",
    publishedText: textFromRuns(v.publishedTimeText) || "",
    viewsText: textFromRuns(v.shortViewCountText) || textFromRuns(v.viewCountText) || ""
  }];
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

  // 1) Cache Redis : alimenté chaque matin par scrape_youtube.py sur eye.
  try {
    const store = await getCachedYoutube();
    if (store) {
      const cached = findVideosForKeyword(store, q);
      if (cached && cached.length > 0) {
        return Response.json({
          query: q,
          items: cached.slice(0, 1),
          source: "cache",
          generatedAt: store.generatedAt
        });
      }
    }
  } catch (err) {
    console.warn("youtube-search cache read:", err?.message || err);
  }

  // 2) Fallback live.
  const items = await fetchLiveFirst(q);
  return Response.json({ query: q, items, source: "live" });
}
