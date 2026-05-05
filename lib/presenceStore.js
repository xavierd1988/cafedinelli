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

export async function recordPresence(ip) {
  if (!ip || ip === "unknown") return;
  try {
    const r = getRedis();
    const now = Date.now();
    // ZADD : update le score (= timestamp) pour cette IP. Si elle existe
    // déjà, son score est juste rafraîchi (= elle reste online).
    await r.zadd(KEY, { score: now, member: ip });
    // Cleanup en passant : retire les IPs trop anciennes pour garder un
    // ZCARD précis et économiser l'espace.
    await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
  } catch (err) {
    // Redis indisponible : on swallow pour ne pas faire crasher
    // /api/seats. Le visiteur sera juste invisible ce tour-ci.
    console.warn("presenceStore.recordPresence: Redis indisponible", err?.message);
  }
}

export async function getOnlineCount() {
  try {
    const r = getRedis();
    const now = Date.now();
    // Cleanup avant compte au cas où aucun GET récent n'a fait le tri.
    await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
    const count = await r.zcard(KEY);
    return Number(count) || 0;
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
      peers.push({ ip: items[i], lastSeen: Number(items[i + 1]) });
    }
    return peers;
  } catch {
    return [];
  }
}
