// =============================================================================
// PRESENCE STORE — Compteur "live" des visiteurs uniques connectés
// =============================================================================
// Chaque IP qui poll /api/seats est insérée dans un sorted set Redis avec son
// timestamp comme score. Une fois par fenêtre de 15s, on retire les IPs qui
// n'ont pas pollé. Le ZCARD donne le nombre d'IPs uniques actives.
//
// Module ISOLÉ et RÉSILIENT :
// - Try/catch autour de tous les appels Redis : si Redis tombe, on retourne
//   au moins 1 (le visiteur courant) plutôt que 0, le compteur ne plante pas.
// - extractIp() couvre les principaux schémas de proxy (Vercel, Cloudflare,
//   nginx) : cf-connecting-ip > true-client-ip > x-real-ip > x-forwarded-for
//   (premier IP de la chaîne). Garantit que chaque connexion réelle compte.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:presence";

// Fenêtre de présence : un visiteur est "online" tant qu'il a pollé dans
// les 15 dernières secondes. Avec un poll toutes les 3s côté client, ça
// laisse 5 polls de marge avant qu'on retire une IP — assez pour absorber
// un onglet en background ou une micro-coupure réseau.
const ONLINE_WINDOW_MS = 15_000;

// Détection d'IP robuste : tente plusieurs headers dans l'ordre. Vercel
// fournit `x-forwarded-for` et `x-real-ip` ; Cloudflare expose
// `cf-connecting-ip` et `true-client-ip` ; en local on tombe sur 127.0.0.1.
// L'ordre est : le plus spécifique → le plus générique.
export function extractIp(request) {
  if (!request?.headers) return "unknown";
  const get = (name) => {
    try { return request.headers.get(name); } catch { return null; }
  };
  const candidates = [
    get("cf-connecting-ip"),
    get("true-client-ip"),
    get("x-real-ip"),
    // x-vercel-forwarded-for : header spécifique Vercel quand
    // x-forwarded-for est masqué.
    get("x-vercel-forwarded-for"),
    // x-forwarded-for : peut être une chaîne `client, proxy1, proxy2…`.
    // On prend le premier (= IP cliente réelle).
    (get("x-forwarded-for") || "").split(",")[0].trim()
  ];
  for (const ip of candidates) {
    if (ip && typeof ip === "string" && ip.length >= 3) return ip;
  }
  return "127.0.0.1";
}

// Construit la clé "membre" stockée dans le sorted set Redis. Si un
// sessionId est fourni, on combine `ip|sid` → 2 onglets sur le même WiFi
// (donc même IP) comptent quand même comme 2 visiteurs distincts. Sinon
// on retombe sur l'IP seule (mode polling /api/seats sans session).
function buildMember(ip, sessionId) {
  if (sessionId && typeof sessionId === "string") {
    return `${ip}|${sessionId}`;
  }
  return String(ip);
}

/**
 * Enregistre la présence d'un visiteur. Retourne `true` si c'est une
 * NOUVELLE entrée (jamais vue dans la fenêtre online), `false` si on a
 * juste rafraîchi le timestamp d'une entrée existante. Le caller peut
 * utiliser ça pour invalider le snapshot cache quand quelqu'un arrive.
 */
export async function recordPresence(ip, sessionId = null) {
  if (!ip || ip === "unknown") return false;
  const member = buildMember(ip, sessionId);
  try {
    const r = getRedis();
    const now = Date.now();
    // ZADD avec retour du nombre d'éléments AJOUTÉS (pas updatés). Sur
    // Upstash REST, zadd renvoie le nombre d'inserts.
    const added = await r.zadd(KEY, { score: now, member });
    await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
    return Number(added) > 0;
  } catch (err) {
    console.warn("presenceStore.recordPresence: Redis indisponible", err?.message);
    return false;
  }
}

export async function getOnlineCount() {
  try {
    const r = getRedis();
    const now = Date.now();
    // Cleanup avant compte au cas où aucun GET récent n'a fait le tri.
    await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
    // Compteur public : 1 IP = 1 personne. Plusieurs onglets sur la
    // même IP comptent comme un seul visiteur (signal d'ambiance, pas
    // un decompte technique). On filtre aussi localhost (::1 /
    // 127.0.0.1) — du bruit dev qui partage le Redis avec la prod.
    // Note : on continue à stocker `ip|sid` dans le sorted set pour
    // le debug + la résolution fine côté /api/presence/peers, mais
    // ICI on dédupe par IP avant de compter.
    const items = await r.zrange(KEY, 0, -1);
    const uniqueIps = new Set();
    for (const m of items) {
      const member = String(m || "");
      const sep = member.indexOf("|");
      const ip = sep >= 0 ? member.slice(0, sep) : member;
      if (!ip) continue;
      if (ip === "::1" || ip === "127.0.0.1") continue;
      uniqueIps.add(ip);
    }
    return uniqueIps.size;
  } catch (err) {
    // Redis HS : on retourne au moins 1 (ce visiteur), jamais 0. Le
    // compteur "live" ne tombera pas à 0 sur une glitche de Redis.
    console.warn("presenceStore.getOnlineCount: fallback à 1", err?.message);
    return 1;
  }
}

// Optionnel pour debug / outils admin : liste les IPs actives + leur
// dernier ping. Pas appelé par /api/seats.
export async function getOnlinePeers() {
  try {
    const r = getRedis();
    const now = Date.now();
    await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
    // ZRANGE WITHSCORES : on récupère [member, score, member, score, …]
    const items = await r.zrange(KEY, 0, -1, { withScores: true });
    const peers = [];
    for (let i = 0; i < items.length; i += 2) {
      const member = String(items[i] || "");
      // member peut être au format "ip|sid" ou "ip" pour le legacy
      // polling. On expose les deux pour clarté côté debug endpoint.
      const sep = member.indexOf("|");
      const ip = sep >= 0 ? member.slice(0, sep) : member;
      const sessionId = sep >= 0 ? member.slice(sep + 1) : null;
      peers.push({
        member,
        ip,
        sessionId,
        lastSeen: Number(items[i + 1])
      });
    }
    return peers;
  } catch {
    return [];
  }
}
