// Récupère la photo du 1er résultat Amazon pour un mot-clé donné.
// Cache Redis 24h (clé `cafe:img:lowercase-query`). Fallback null si pas
// trouvé / erreur réseau / Amazon bloque — le client tombera sur l'emoji.

import { getRedis } from "../../../lib/redis.js";

const TTL_SEC = 24 * 3600;

// User-Agent type navigateur — Amazon renvoie de la HTML JSless si le UA
// n'est pas reconnu. On en met un récent et standard.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });

  const cacheKey = `cafe:img:${q.toLowerCase()}`;

  // Cache hit ?
  try {
    const cached = await getRedis().get(cacheKey);
    if (cached === "__none__") return Response.json({ imageUrl: null });
    if (cached) return Response.json({ imageUrl: cached });
  } catch {}

  // Fetch Amazon search page
  let imageUrl = null;
  try {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9"
      },
      // Timeout court pour ne pas bloquer la grille produits si Amazon
      // est lent à répondre.
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const html = await res.text();
      // Le 1er résultat de recherche a une <img class="s-image" ...>.
      // On capture le src de la 1re occurrence.
      const m = html.match(/class="s-image"[^>]*src="([^"]+)"/);
      if (m && m[1]) imageUrl = m[1];
      // Variante alternative : data-image-latency / data-image-source
      if (!imageUrl) {
        const m2 = html.match(/<img[^>]+srcset="([^"]+)"/);
        if (m2) {
          const first = m2[1].split(",")[0]?.trim().split(" ")[0];
          if (first) imageUrl = first;
        }
      }
    }
  } catch (err) {
    // timeout / network / Amazon block — on log et on fallback null.
    console.warn("/api/product-image fetch failed for", q, err?.message || err);
  }

  // Cache même les "introuvables" pour ne pas re-tenter en boucle.
  try {
    await getRedis().set(cacheKey, imageUrl || "__none__", { ex: TTL_SEC });
  } catch {}

  return Response.json({ imageUrl });
}
