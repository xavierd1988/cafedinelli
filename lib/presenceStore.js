// Compteur de visiteurs "online" basé sur le polling /api/seats. Chaque
// IP qui poll est insérée dans un sorted set Redis avec son timestamp.
// Les entrées plus anciennes que ONLINE_WINDOW_MS sont nettoyées au
// passage. ZCARD donne le nombre d'IPs uniques actives sur la fenêtre.

import { getRedis } from "./redis.js";

const KEY = "cafe:presence";
// Fenêtre de 15s : au-delà on considère le visiteur déconnecté. Avec un
// poll côté client toutes les 3s, ça laisse 5 polls de marge avant qu'on
// retire une IP. Suffisant pour absorber un onglet en background ou une
// micro-coupure réseau.
const ONLINE_WINDOW_MS = 15_000;

export async function recordPresence(ip) {
  if (!ip) return;
  const r = getRedis();
  const now = Date.now();
  // ZADD : on update le score (= timestamp) pour cette IP. Si elle existe
  // déjà, son score est juste rafraîchi.
  await r.zadd(KEY, { score: now, member: ip });
  // Nettoyage : on retire toutes les IPs qui n'ont pas pollé depuis
  // ONLINE_WINDOW_MS. Économise de l'espace + garde le compte exact.
  await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
}

export async function getOnlineCount() {
  const r = getRedis();
  const now = Date.now();
  // Au cas où aucun GET récent n'a fait le cleanup, on le refait ici
  // avant de compter pour ne pas inclure des IPs obsolètes.
  await r.zremrangebyscore(KEY, 0, now - ONLINE_WINDOW_MS);
  const count = await r.zcard(KEY);
  return count || 0;
}
