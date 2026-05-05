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
  const raw = await getRedis().hgetall(KEY);
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

export async function takeSecretSeat({ seatId, ip, nickname, persona }) {
  const entry = {
    seatId: String(seatId).slice(0, 16),
    ip,
    nickname: (nickname || "anonymous").slice(0, 40),
    persona: sanitizePersona(persona),
    timestamp: Date.now()
  };
  await getRedis().hset(KEY, { [entry.seatId]: entry });
  // eslint-disable-next-line no-unused-vars
  const { ip: _ip, ...publicEntry } = entry;
  return publicEntry;
}

export async function leaveSecretSeat(seatId) {
  await getRedis().hdel(KEY, String(seatId));
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

export async function findSecretSeatForIp(ip) {
  const all = await loadAllRaw();
  return all.find((s) => s.ip === ip) || null;
}
