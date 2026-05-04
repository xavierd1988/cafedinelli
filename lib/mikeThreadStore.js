// Thread Mike partagé en Redis : une seule conversation active à la fois,
// visible de tous les visiteurs. TTL 60s (Redis EX) — Redis nettoie tout seul,
// et on revérifie expiresAt côté lecture pour gérer le cas où Redis n'a pas
// encore expiré la clé.

import { getRedis } from "./redis.js";

const KEY = "cafe:mike:thread";
// Conversation auto-clôturée 30s après le dernier turn.
export const THREAD_TTL_MS = 30_000;

export async function getMikeThread() {
  const t = await getRedis().get(KEY);
  if (!t) return null;
  if (typeof t.expiresAt !== "number" || t.expiresAt < Date.now()) {
    return null;
  }
  return t;
}

export async function clearMikeThread() {
  await getRedis().del(KEY);
}

export async function appendMikeTurn(role, payload, ownerIp = null) {
  const r = getRedis();
  const now = Date.now();
  let thread = await getMikeThread();
  if (!thread) {
    thread = {
      id: `mike-${now}`,
      // L'IP qui démarre la conversation est la seule autorisée à la fermer.
      ownerIp: ownerIp || null,
      startedAt: now,
      expiresAt: now + THREAD_TTL_MS,
      turns: []
    };
  } else {
    // Chaque nouveau turn rallonge la conversation de 60s.
    thread.expiresAt = now + THREAD_TTL_MS;
  }
  thread.turns.push({ role, ...payload, timestamp: now });
  // EX = TTL Redis en secondes (+5s de marge pour le cleanup)
  await r.set(KEY, thread, { ex: Math.ceil(THREAD_TTL_MS / 1000) + 5 });
  return thread;
}
