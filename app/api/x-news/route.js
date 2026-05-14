// =============================================================================
// /api/x-news?q=keyword
// =============================================================================
// 5 derniers tweets/threads indexés par Google sur twitter.com / x.com
// pour un mot-clé donné. Source : RSS Google News avec filtre
// site:twitter.com OR site:x.com.
//
// Pas d'API X officielle (payante depuis fin 2023) — on s'appuie sur
// l'indexation Google. Les résultats sont des tweets viraux / threads
// repérés par Google, pas du live. Décalage typique : qq heures à 1-2j.
// =============================================================================

export const revalidate = 600;

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

// Extrait le @handle Twitter d'une URL : https://twitter.com/elonmusk/status/...
function extractHandle(url) {
  try {
    const u = new URL(url);
    if (!/(twitter|x)\.com$/i.test(u.hostname)) return null;
    const seg = u.pathname.split("/").filter(Boolean);
    if (!seg.length) return null;
    // Filtre les chemins système (/search, /home, /hashtag, etc.)
    if (/^(search|home|notifications|messages|i|explore|hashtag|compose|settings)$/i.test(seg[0])) {
      return null;
    }
    return seg[0];
  } catch {
    return null;
  }
}

async function fetchRss(query) {
  const rssUrl =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=en-US&gl=US&ceid=US:en`;
  const r = await fetch(rssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
    },
    signal: AbortSignal.timeout(7000)
  });
  if (!r.ok) return [];
  const xml = await r.text();
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < 10) {
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

  // 2 tentatives : d'abord stricte (site:twitter.com OR site:x.com), puis
  // élargie ("KEYWORD twitter") si la 1ère ne renvoie rien.
  let items = [];
  try {
    items = await fetchRss(`site:twitter.com OR site:x.com "${q}"`);
  } catch {}
  if (items.length === 0) {
    try {
      items = await fetchRss(`${q} twitter OR x.com`);
    } catch {}
  }

  // Enrichir : extrait le @handle quand possible
  const enriched = items.slice(0, 5).map((it) => {
    const handle = extractHandle(it.link);
    return { ...it, handle };
  });

  return Response.json({ query: q, items: enriched });
}
