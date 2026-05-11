// État partagé des sièges de la pièce secrète, dans le même hash Redis
// pattern que seatStore.js. Une seule IP active par siège, expiration
// après 120s d'inactivité.

import { getRedis } from "./redis.js";

const KEY = "cafe:secret-seats";
const MAX_AGE_MS = 120_000;

function sanitizePersona(p) {
  if (!p || typeof p !== "object") return null;
  const gender = p.gender === "w" ? "w" : "m";
  function clamp(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(4, Math.round(n)));
  }
  return {
    gender,
    wig:    clamp(p.wig),
    jacket: clamp(p.jacket),
    pants:  clamp(p.pants),
    shoes:  clamp(p.shoes)
  };
}

async function loadAllRaw() {
  let raw;
  try {
    raw = await getRedis().hgetall(KEY);
  } catch (err) {
    console.warn("secretRoomStore.loadAllRaw: Redis indispo", err?.message);
    return [];
  }
  if (!raw) return [];
  const now = Date.now();
  const out = [];
  for (const value of Object.values(raw)) {
    const e = typeof value === "string" ? JSON.parse(value) : value;
    if (e && typeof e.timestamp === "number" && now - e.timestamp < MAX_AGE_MS) {
      out.push(e);
    }
  }
  return out;
}

export async function takeSecretSeat({ seatId, ip, sessionId, nickname, message, persona }) {
  const entry = {
    seatId: String(seatId).slice(0, 16),
    ip,
    sessionId: typeof sessionId === "string" ? sessionId.slice(0, 80) : null,
    nickname: (nickname || "anonymous").slice(0, 40),
    message: (message || "").slice(0, 140),
    persona: sanitizePersona(persona),
    timestamp: Date.now()
  };
  try {
    await getRedis().hset(KEY, { [entry.seatId]: entry });
  } catch (err) {
    console.warn("secretRoomStore.takeSecretSeat: Redis indispo", err?.message);
  }
  // eslint-disable-next-line no-unused-vars
  const { ip: _ip, ...publicEntry } = entry;
  return publicEntry;
}

export async function leaveSecretSeat(seatId) {
  try {
    await getRedis().hdel(KEY, String(seatId));
  } catch (err) {
    console.warn("secretRoomStore.leaveSecretSeat: Redis indispo", err?.message);
  }
}

export async function leaveSecretSeatForIp(ip) {
  if (!ip) return;
  const all = await loadAllRaw();
  const mine = all.find((s) => s.ip === ip);
  if (mine) await leaveSecretSeat(mine.seatId);
}

export async function getSecretRoomSeats() {
  const all = await loadAllRaw();
  return all.map(({ ip: _ip, ...rest }) => rest);
}

// Renvoie le siège ACTIF (= non-released) occupé par cette IP. Mêmes
// sémantiques que findActiveSeatForIp côté bar : une entrée marquée
// releasedAt n'est plus un verrou IP — le visiteur peut prendre un
// autre siège pendant que son ancien message reste visible aux autres
// jusqu'à expiration naturelle.
export async function findSecretSeatForIp(ip) {
  const all = await loadAllRaw();
  return all.find((s) => s.ip === ip && !s.releasedAt) || null;
}

// Verrou par session browser — parallèle à findActiveSeatForSession côté bar.
export async function findSecretSeatForSession(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return null;
  const all = await loadAllRaw();
  return all.find((s) => s.sessionId === sessionId && !s.releasedAt) || null;
}

// Marque le siège comme "released" sans l'effacer. L'entrée garde son
// timestamp et son message → les autres visiteurs continuent de la voir
// dans la liste secretRoom jusqu'à expiration naturelle. Strictement
// parallèle à seatStore.markSeatReleased côté bar.
export async function markSecretSeatReleased(seatId) {
  if (seatId === null || seatId === undefined) return;
  try {
    const r = getRedis();
    const key = String(seatId);
    const raw = await r.hget(KEY, key);
    if (!raw) return;
    const entry = typeof raw === "string" ? JSON.parse(raw) : raw;
    entry.releasedAt = Date.now();
    await r.hset(KEY, { [key]: entry });
  } catch (err) {
    console.warn("secretRoomStore.markSecretSeatReleased: Redis indispo", err?.message);
  }
}
