// =============================================================================
// /api/google-news?q=keyword
// =============================================================================
// Récupère les 5 derniers articles Google News pour un mot-clé.
// Source : flux RSS Google News (gratuit, pas d'API key).
// Format : `https://news.google.com/rss/search?q=...&hl=en-US&gl=US`
//
// Utilisé par GoogleTrendsPopup : quand on clique sur une rangée
// Google Trends dans la newsletter, on affiche les 5 derniers articles
// liés au trend avec leurs liens directs.
// =============================================================================

export const revalidate = 600; // cache 10 min côté Vercel

function decodeHtmlEntities(s) {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripCdata(s) {
  if (!s) return "";
  return s.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

function pickTag(itemXml, tag) {
  const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeHtmlEntities(stripCdata(m[1])) : "";
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

  const rssUrl =
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
    `&hl=en-US&gl=US&ceid=US:en`;

  let xml;
  try {
    const r = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!r.ok) {
      return Response.json({ items: [], error: `rss http ${r.status}` }, { status: 200 });
    }
    xml = await r.text();
  } catch (e) {
    return Response.json({ items: [], error: e?.message || "fetch failed" }, { status: 200 });
  }

  // Parse les <item> du RSS — max 5
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < 5) {
    const itemXml = m[1];
    const title = pickTag(itemXml, "title");
    const link = pickTag(itemXml, "link");
    const source = pickTag(itemXml, "source");
    const pubDate = pickTag(itemXml, "pubDate");
    if (title && link) {
      items.push({ title, link, source, pubDate });
    }
  }

  return Response.json({ query: q, items });
}
