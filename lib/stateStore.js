// =============================================================================
// CAFE STATE STORE — un seul snapshot pour SSE
// =============================================================================
// Lit l'état complet du café en 1 round-trip Redis (pipeline) et le retourne
// sous forme d'objet plat — c'est ce qui est broadcasté aux clients SSE.
//
// Stratégie : on garde les stores individuels (seatStore, mikeThreadStore,
// etc.) pour les writes (pas de refacto invasive). Pour les reads, on
// pipeline tout en parallèle. Chaque tick SSE = 1 round-trip réseau, et
// même si ça reste plusieurs commandes Redis comptées, c'est plus rapide
// que les 7 calls séquentiels.
//
// Pour scaler encore : à terme, on pourra migrer vers une seule clé
// `cafe:state` JSON mise à jour atomiquement par chaque writer. C'est une
// optimisation v2 si le coût devient un sujet.
// =============================================================================

import { getActiveSeats } from "./seatStore.js";
import { getRegulars } from "./regularsStore.js";
import { getMikeThread } from "./mikeThreadStore.js";
import { getEyeThread } from "./eyeThreadStore.js";
import { getOnlineCount, recordPresence } from "./presenceStore.js";
import { getSecretRoomSeats } from "./secretRoomStore.js";
import { getRedis } from "./redis.js";

// Helper résilient : si une promesse rejette, on retombe sur un fallback
// au lieu de faire crasher le snapshot complet.
function safe(promise, fallback) {
  return promise.then((v) => v).catch(() => fallback);
}

// Clé Redis qui agrège tout l'état dans un seul JSON. TTL 1.2s →
// régénéré max 1× par seconde, partagé entre toutes les connexions SSE.
// Stocke la version BRUTE de mike/eye (avec ownerIp) pour pouvoir
// recalculer isYours par client.
const CACHE_KEY = "cafe:state";
const CACHE_TTL_MS = 1200;

async function buildRawSnapshot() {
  const [seats, regulars, mikeRaw, eyeRaw, taxiRaw, online, secretRoom, pixooMutedRaw] =
    await Promise.all([
      safe(getActiveSeats(), []),
      safe(getRegulars(), { total: 0, recent: [] }),
      safe(getMikeThread(), null),
      safe(getEyeThread(), null),
      safe(getRedis().get("cafe:taxi:summonedAt"), null),
      safe(getOnlineCount(), 1),
      safe(getSecretRoomSeats(), []),
      safe(getRedis().get("cafe:pixoo:muted"), "0")
    ]);
  const taxiTs = taxiRaw ? Number(taxiRaw) : null;
  return {
    seats,
    regulars,
    mike: mikeRaw, // garde ownerIp pour le calcul isYours par client
    eye: eyeRaw,
    taxi: Number.isFinite(taxiTs) ? { summonedAt: taxiTs } : null,
    online,
    secretRoom,
    pixooMuted: pixooMutedRaw === 1 || pixooMutedRaw === true || pixooMutedRaw === "1",
    builtAt: Date.now()
  };
}

async function getOrBuildSnapshot() {
  // 1. Lire la cache Redis. Si elle existe et n'est pas expirée, on
  //    s'en sert (1 op au lieu de 11). C'est le steady state.
  try {
    const cached = await getRedis().get(CACHE_KEY);
    if (cached && typeof cached.builtAt === "number") {
      if (Date.now() - cached.builtAt < CACHE_TTL_MS) {
        return cached;
      }
    }
  } catch {
    /* cache miss → on rebuild */
  }

  // 2. Cache miss / expirée : on regénère (7-8 reads en parallèle).
  const snap = await buildRawSnapshot();
  // 3. On stocke la nouvelle cache (TTL un poil plus long que CACHE_TTL_MS
  //    en secondes pour que Redis n'expire pas avant nous).
  try {
    await getRedis().set(CACHE_KEY, snap, { ex: 5 });
  } catch {
    /* cache write fail → tant pis, on continuera à rebuild */
  }
  return snap;
}

/**
 * Lit le snapshot complet de l'état du café côté serveur, avec cache
 * partagée Redis (1.2s). Renvoie un objet prêt à broadcaster côté SSE.
 *
 * @param {string} ip   IP du visiteur courant (pour calculer isYours sur
 *                      les threads Mike/eye et pour recordPresence).
 * @param {boolean} recordPing  Si true, enregistre la présence.
 */
export async function getCafeState(ip, { recordPing = true, sessionId = null } = {}) {
  if (recordPing && ip) {
    // On AWAIT la présence pour 2 raisons :
    //   1. Si c'est une nouvelle entrée, on doit invalider le snapshot
    //      cache AVANT de le lire — sinon on retourne l'ancien count.
    //   2. ZADD chez Upstash REST est de toute façon ~5-15ms, c'est
    //      rapide et ça évite la race condition.
    try {
      const isNew = await recordPresence(ip, sessionId);
      if (isNew) {
        // Nouveau visiteur dans la fenêtre 15s → on force le rebuild
        // du snapshot pour que le prochain getOrBuildSnapshot voie le
        // bon ZCARD. Sinon il reste sur la valeur cachée jusqu'à 1.2s.
        await invalidateCafeState();
      }
    } catch {
      /* ne bloque pas le snapshot si la présence échoue */
    }
  }

  const snap = await getOrBuildSnapshot();

  // On enrichit mike/eye avec isYours, sans muter la cache partagée.
  let mike = null;
  if (snap.mike) {
    // eslint-disable-next-line no-unused-vars
    const { ownerIp, ...rest } = snap.mike;
    mike = { ...rest, isYours: ownerIp ? ownerIp === ip : true };
  }
  let eye = null;
  if (snap.eye) {
    // eslint-disable-next-line no-unused-vars
    const { ownerIp, ...rest } = snap.eye;
    eye = { ...rest, isYours: ownerIp ? ownerIp === ip : true };
  }
  return {
    seats: snap.seats,
    regulars: snap.regulars,
    mike,
    eye,
    taxi: snap.taxi,
    online: snap.online,
    secretRoom: snap.secretRoom,
    pixooMuted: snap.pixooMuted
  };
}

/**
 * Force l'invalidation de la cache. Appelé par les writers (POST /api/seats,
 * /api/taxi, /api/secret-room, etc.) pour que le prochain tick SSE
 * récupère immédiatement le changement au lieu d'attendre 1.2s.
 */
export async function invalidateCafeState() {
  try {
    await getRedis().del(CACHE_KEY);
  } catch {
    /* tant pis, le TTL fait le job dans 1.2s */
  }
}

/**
 * Calcule un hash léger d'un snapshot pour détecter rapidement si l'état
 * a changé entre 2 ticks SSE. Évite de re-pousser un payload identique.
 */
export function snapshotSignature(state) {
  if (!state) return "";
  // Concat des champs les plus volatiles seulement — pas besoin de tout
  // hasher tant que c'est déterministe pour un état donné.
  const seatsSig = (state.seats || [])
    .map((s) => `${s.id}:${s.timestamp || 0}`)
    .join(",");
  const secretSig = (state.secretRoom || [])
    .map((s) => `${s.seatId}:${s.timestamp || 0}`)
    .join(",");
  const mikeSig = state.mike?.id || "";
  const mikeTurns = state.mike?.turns?.length || 0;
  const eyeSig = state.eye?.id || "";
  const eyeTurns = state.eye?.turns?.length || 0;
  const taxiTs = state.taxi?.summonedAt || 0;
  const online = state.online || 0;
  const total = state.regulars?.total || 0;
  return [
    seatsSig,
    secretSig,
    `m:${mikeSig}:${mikeTurns}`,
    `e:${eyeSig}:${eyeTurns}`,
    `t:${taxiTs}`,
    `o:${online}`,
    `r:${total}`,
    `p:${state.pixooMuted ? 1 : 0}`
  ].join("|");
}
