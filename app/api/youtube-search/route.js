// =============================================================================
// /api/youtube-search?q=keyword
// =============================================================================
// Cherche la première vidéo YouTube pour un keyword. Pas d'API key —
// on scrape la page youtube.com/results et on extrait le premier
// videoRenderer du JSON `var ytInitialData = {...};` injecté dans le HTML.
//
// Retourne : { videoId, title, channel, thumbnail, durationText }
//
// Utilisé par YouTubePopup : quand on clique une rangée YouTube dans
// la newsletter, on fetch ici puis on affiche l'iframe embed officiel.
// =============================================================================

export const revalidate = 1800; // 30 min cache CDN

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
           "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

// Trouve le premier vidéoRenderer dans un arbre JSON YouTube (récursif).
// Le path peut varier — on cherche la 1ère clé "videoRenderer" qui a un
// videoId valide (11 chars alphanum + - + _).
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
  // Prend la plus large
  let best = thumbs[0];
  for (const t of thumbs) {
    if ((t?.width || 0) > (best?.width || 0)) best = t;
  }
  return best?.url || null;
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

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
    if (!r.ok) {
      return Response.json({ error: `http ${r.status}`, items: [] }, { status: 200 });
    }
    html = await r.text();
  } catch (e) {
    return Response.json({ error: e?.message || "fetch failed", items: [] }, { status: 200 });
  }

  // Le JSON est injecté juste après `var ytInitialData = `. Le bloc
  // se termine par `};</script>` (ou `};` + ws). On extrait jusqu'au
  // `};` non escapé.
  const startMarker = "var ytInitialData = ";
  const idx = html.indexOf(startMarker);
  if (idx < 0) {
    return Response.json({ error: "no ytInitialData", items: [] }, { status: 200 });
  }
  const after = html.slice(idx + startMarker.length);
  // Trouve la fin du JSON : `};` suivi de </script> ou nouvelle ligne
  const endMatch = after.match(/};\s*<\/script>|};\s*\n/);
  if (!endMatch) {
    return Response.json({ error: "ytInitialData unterminated", items: [] }, { status: 200 });
  }
  const jsonStr = after.slice(0, endMatch.index + 1);

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    return Response.json({ error: "json parse: " + e.message, items: [] }, { status: 200 });
  }

  const found = { value: null };
  findFirstVideo(data, found);
  if (!found.value) {
    return Response.json({ query: q, items: [] });
  }

  const v = found.value;
  const item = {
    videoId: v.videoId,
    title: textFromRuns(v.title),
    channel: textFromRuns(v.ownerText) || textFromRuns(v.longBylineText) || "",
    thumbnail: bestThumb(v),
    durationText: textFromRuns(v.lengthText) || "",
    publishedText: textFromRuns(v.publishedTimeText) || "",
    viewsText: textFromRuns(v.shortViewCountText) || textFromRuns(v.viewCountText) || ""
  };

  return Response.json({ query: q, items: [item] });
}
