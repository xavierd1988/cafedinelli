// Récupère la photo du 1er résultat Amazon pour un mot-clé donné.
// Cache Redis 24h (clé `cafe:img:lowercase-query`). Fallback null si pas
// trouvé / erreur réseau / Amazon bloque — le client tombera sur l'emoji.

import { getRedis } from "../../../lib/redis.js";

const TTL_SEC = 24 * 3600;
// TTL court sur les échecs : si Amazon a throttle / bloqué une fois, on
// veut retenter dans 20 min, pas attendre 24h. Sinon une seule mauvaise
// vague de scrape vide la moitié des vitrines pour la journée.
const TTL_NONE_SEC = 20 * 60;

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
    if (cached === "__none__") return Response.json({ imageUrl: null, price: null });
    if (cached) {
      // Backward-compat : si la valeur en cache est juste une string URL
      // (ancienne version), on la retourne sans price ; sinon objet JSON.
      try {
        const obj = typeof cached === "string" && cached.startsWith("{")
          ? JSON.parse(cached)
          : { imageUrl: cached, price: null };
        return Response.json(obj);
      } catch {
        return Response.json({ imageUrl: cached, price: null });
      }
    }
  } catch {}

  // Fetch Amazon search page
  let imageUrl = null;
  let price = null;
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
      // Amazon expose plusieurs patterns d'<img> dans la page de search.
      // On essaie dans l'ordre du plus fiable au moins fiable.
      const patterns = [
        /class="s-image"[^>]*src="([^"]+)"/,
        /<img[^>]+class="[^"]*s-image[^"]*"[^>]+src="([^"]+)"/,
        /<img[^>]+data-image-source-density="1"[^>]+src="([^"]+)"/,
        /<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m && m[1]) { imageUrl = m[1]; break; }
      }
      if (!imageUrl) {
        const m2 = html.match(/<img[^>]+srcset="([^"]+)"/);
        if (m2) {
          const first = m2[1].split(",")[0]?.trim().split(" ")[0];
          if (first) imageUrl = first;
        }
      }
      // Prix : Amazon utilise <span class="a-price-whole">XX</span>
      // <span class="a-price-fraction">YY</span> dans son markup search.
      const pw = html.match(/class="a-price-whole">([0-9.,]+)/);
      const pf = html.match(/class="a-price-fraction">([0-9]+)/);
      if (pw) {
        const whole = pw[1].replace(/[^0-9]/g, "");
        const frac = pf ? pf[1].replace(/[^0-9]/g, "") : "00";
        price = `$${whole}.${frac.padEnd(2, "0").slice(0, 2)}`;
      } else {
        // Fallback : <span class="a-offscreen">$12.34</span>
        const po = html.match(/class="a-offscreen">\$([0-9.,]+)/);
        if (po) price = `$${po[1]}`;
      }
    }
  } catch (err) {
    console.warn("/api/product-image fetch failed for", q, err?.message || err);
  }

  // Cache : objet JSON pour stocker imageUrl + price ensemble.
  try {
    if (imageUrl || price) {
      await getRedis().set(cacheKey, JSON.stringify({ imageUrl, price }), { ex: TTL_SEC });
    } else {
      // TTL court : on veut pouvoir retenter rapidement.
      await getRedis().set(cacheKey, "__none__", { ex: TTL_NONE_SEC });
    }
  } catch {}

  return Response.json({ imageUrl, price });
}
