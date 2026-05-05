// =============================================================================
// MIKE THREAD STORE — Conversation partagée avec Mike, résiliente
// =============================================================================
// Thread Mike partagé en Redis : une seule conversation active à la fois,
// visible de tous les visiteurs. TTL 30s (Redis EX) — Redis nettoie tout seul.
//
// RÉSILIENCE :
// Si Redis throw (env vars manquantes / token expiré / réseau), on bascule
// sur un fallback en mémoire par-process. Conséquence : la conversation
// n'est plus partagée entre visiteurs (chaque instance de serverless a son
// propre thread), MAIS Mike continue de répondre. Sans ce fallback, une
// panne Redis cassait totalement Mike.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:mike:thread";
export const THREAD_TTL_MS = 30_000;

// Fallback en mémoire (par process). Quand Redis est inaccessible, on
// stocke ici. Reset à chaque cold start serverless mais permet au moins
// au visiteur courant d'avoir une conversation continue dans la fenêtre
// de TTL.
let memThread = null;

function readMem() {
  if (!memThread) return null;
  if (typeof memThread.expiresAt !== "number" || memThread.expiresAt < Date.now()) {
    memThread = null;
    return null;
  }
  return memThread;
}

export async function getMikeThread() {
  try {
    const r = getRedis();
    const t = await r.get(KEY);
    if (!t) return readMem();
    if (typeof t.expiresAt !== "number" || t.expiresAt < Date.now()) {
      return null;
    }
    return t;
  } catch (err) {
    console.warn("mikeThreadStore.getMikeThread: fallback mem", err?.message);
    return readMem();
  }
}

export async function clearMikeThread() {
  memThread = null;
  try {
    await getRedis().del(KEY);
  } catch (err) {
    console.warn("mikeThreadStore.clearMikeThread: Redis indispo", err?.message);
  }
}

export async function appendMikeTurn(role, payload, ownerIp = null) {
  const now = Date.now();
  let thread = await getMikeThread();
  if (!thread) {
    thread = {
      id: `mike-${now}`,
      ownerIp: ownerIp || null,
      startedAt: now,
      expiresAt: now + THREAD_TTL_MS,
      turns: []
    };
  } else {
    thread.expiresAt = now + THREAD_TTL_MS;
  }
  thread.turns.push({ role, ...payload, timestamp: now });

  // 1. tente d'écrire dans Redis (multi-user persistent)
  try {
    const r = getRedis();
    await r.set(KEY, thread, { ex: Math.ceil(THREAD_TTL_MS / 1000) + 5 });
  } catch (err) {
    console.warn("mikeThreadStore.appendMikeTurn: fallback mem", err?.message);
  }

  // 2. on stocke aussi en mémoire (utilisé en fallback si Redis tombe
  //    avant le prochain GET).
  memThread = thread;
  return thread;
}
