// Thread du Gatekeeper (silhouette c) partagé en Redis : une seule
// conversation active à la fois, visible de tous les visiteurs. Même schéma
// que mikeThreadStore mais sur une clé séparée pour ne pas mélanger les
// deux personnages.

import { getRedis } from "./redis.js";

const KEY = "cafe:eye:thread";
// Conversation auto-clôturée 30s après le dernier turn — comme Mike.
export const THREAD_TTL_MS = 30_000;

export async function getEyeThread() {
  const t = await getRedis().get(KEY);
  if (!t) return null;
  if (typeof t.expiresAt !== "number" || t.expiresAt < Date.now()) {
    return null;
  }
  return t;
}

export async function clearEyeThread() {
  await getRedis().del(KEY);
}

export async function appendEyeTurn(role, payload, ownerIp = null) {
  const r = getRedis();
  const now = Date.now();
  let thread = await getEyeThread();
  if (!thread) {
    thread = {
      id: `eye-${now}`,
      // L'IP qui démarre la conversation est la seule autorisée à la fermer.
      ownerIp: ownerIp || null,
      startedAt: now,
      expiresAt: now + THREAD_TTL_MS,
      turns: []
    };
  } else {
    thread.expiresAt = now + THREAD_TTL_MS;
  }
  thread.turns.push({ role, ...payload, timestamp: now });
  await r.set(KEY, thread, { ex: Math.ceil(THREAD_TTL_MS / 1000) + 5 });
  return thread;
}
