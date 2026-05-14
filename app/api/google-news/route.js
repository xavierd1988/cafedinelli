// =============================================================================
// /api/google-news?q=keyword
// =============================================================================
// Retourne les 5 derniers articles Google News pour un mot-clé.
//
// 1. Lit d'abord le cache Redis alimenté par scrape_google.py sur "eye"
//    (cron 09:32). Si trouvé → renvoie instantanément.
// 2. Fallback live : fetch RSS Google News si pas en cache (premier jour,
//    scrape échoué, ou keyword absent du cache).
// =============================================================================

import { getCachedGoogleNews, findNewsForKeyword } from "../../../lib/googleNewsStore.js";

export const revalidate = 300; // 5 min cache CDN

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

async function fetchLiveRss(q) {
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
    if (!r.ok) return [];
    xml = await r.text();
  } catch {
    return [];
  }

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
  return items;
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: "missing q" }, { status: 400 });
  }

  // 1) Cache Redis : alimenté chaque matin par scrape_google.py sur eye.
  try {
    const store = await getCachedGoogleNews();
    if (store) {
      const cached = findNewsForKeyword(store, q);
      if (cached && cached.length > 0) {
        return Response.json({
          query: q,
          items: cached.slice(0, 5),
          source: "cache",
          generatedAt: store.generatedAt
        });
      }
    }
  } catch (err) {
    console.warn("google-news cache read:", err?.message || err);
  }

  // 2) Fallback live : RSS Google News.
  const items = await fetchLiveRss(q);
  return Response.json({ query: q, items, source: "live" });
}
