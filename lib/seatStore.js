// État partagé des seats (qui parle, qui est assis) dans Upstash Redis.
// Hash unique "cafe:seats" : champ = seat id, valeur = { id, nickname, message, timestamp }.
// L'expiration "personne assise" est calculée au lecture-time côté serveur
// (pas de TTL par champ, on filtre par âge).

import { getRedis } from "./redis.js";

const KEY = "cafe:seats";
// Doit matcher PERSON_MS dans Seat.jsx — au-delà la silhouette doit disparaître.
const MAX_AGE_MS = 60_000;

export async function recordSeatMessage({ id, nickname, message }) {
  const entry = {
    id,
    nickname: (nickname || "anonymous").slice(0, 40),
    message: (message || "").slice(0, 140),
    timestamp: Date.now()
  };
  await getRedis().hset(KEY, { [String(id)]: entry });
  return entry;
}

export async function getActiveSeats() {
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
