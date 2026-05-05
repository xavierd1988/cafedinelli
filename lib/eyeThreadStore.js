// =============================================================================
// EYE / GATEKEEPER THREAD STORE — Conversation avec le doorman, résiliente
// =============================================================================
// Même schéma que mikeThreadStore mais sur une clé séparée pour ne pas
// mélanger les deux personnages. Thread partagé en Redis avec fallback
// mémoire pour ne jamais bloquer le Gatekeeper si Redis tombe.
// =============================================================================

import { getRedis } from "./redis.js";

const KEY = "cafe:eye:thread";
export const THREAD_TTL_MS = 30_000;

let memThread = null;

function readMem() {
  if (!memThread) return null;
  if (typeof memThread.expiresAt !== "number" || memThread.expiresAt < Date.now()) {
    memThread = null;
    return null;
  }
  return memThread;
}

export async function getEyeThread() {
  try {
    const r = getRedis();
    const t = await r.get(KEY);
    if (!t) return readMem();
    if (typeof t.expiresAt !== "number" || t.expiresAt < Date.now()) {
      return null;
    }
    return t;
  } catch (err) {
    console.warn("eyeThreadStore.getEyeThread: fallback mem", err?.message);
    return readMem();
  }
}

export async function clearEyeThread() {
  memThread = null;
  try {
    await getRedis().del(KEY);
  } catch (err) {
    console.warn("eyeThreadStore.clearEyeThread: Redis indispo", err?.message);
  }
}

export async function appendEyeTurn(role, payload, ownerIp = null, ttlMs = THREAD_TTL_MS) {
  const now = Date.now();
  let thread = await getEyeThread();
  if (!thread) {
    thread = {
      id: `eye-${now}`,
      ownerIp: ownerIp || null,
      startedAt: now,
      expiresAt: now + ttlMs,
      turns: []
    };
  } else {
    thread.expiresAt = now + ttlMs;
  }
  thread.turns.push({ role, ...payload, timestamp: now });

  try {
    const r = getRedis();
    await r.set(KEY, thread, { ex: Math.ceil(ttlMs / 1000) + 5 });
  } catch (err) {
    console.warn("eyeThreadStore.appendEyeTurn: fallback mem", err?.message);
  }

  memThread = thread;
  return thread;
}
