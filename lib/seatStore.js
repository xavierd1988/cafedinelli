// État partagé des seats (qui parle, qui est assis) dans Upstash Redis.
// Hash unique "cafe:seats" : champ = seat id, valeur = { id, nickname, message, timestamp }.
// L'expiration "personne assise" est calculée au lecture-time côté serveur
// (pas de TTL par champ, on filtre par âge).

import { getRedis } from "./redis.js";

const KEY = "cafe:seats";
// Doit matcher PERSON_MS dans Seat.jsx — siège verrouillé 2 minutes par IP,
// puis la silhouette/bulle disparaît côté tous les clients.
const MAX_AGE_MS = 120_000;

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

export async function recordSeatMessage({ id, ip, nickname, message }) {
  const entry = {
    id,
    ip,
    nickname: (nickname || "anonymous").slice(0, 40),
    message: (message || "").slice(0, 140),
    timestamp: Date.now()
  };
  await getRedis().hset(KEY, { [String(id)]: entry });
  // On expose tout sauf l'IP au client.
  // eslint-disable-next-line no-unused-vars
  const { ip: _ip, ...publicEntry } = entry;
  return publicEntry;
}

export async function getActiveSeats() {
  const all = await loadAllRaw();
  // L'IP est privée — on la retire avant exposition.
  return all.map(({ ip: _ip, ...rest }) => rest);
}

// Renvoie le siège actuellement occupé par cette IP (ou null). Utilisé pour
// empêcher une même IP de s'asseoir à plusieurs sièges en même temps.
export async function findActiveSeatForIp(ip) {
  const all = await loadAllRaw();
  return all.find((s) => s.ip === ip) || null;
}
