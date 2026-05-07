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
  let raw;
  try {
    raw = await getRedis().hgetall(KEY);
  } catch (err) {
    // Redis indispo : on retourne une liste vide plutôt que de faire
    // remonter une exception qui casserait /api/seats entier.
    console.warn("seatStore.loadAllRaw: Redis indispo", err?.message);
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

// Sanitize un payload persona reçu du client → ne stocke que des champs
// connus, dans des plages valides. Évite qu'un client malicieux n'écrive
// n'importe quoi dans le hash et casse le rendu.
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

export async function recordSeatMessage({ id, ip, nickname, message, persona }) {
  const entry = {
    id,
    ip,
    nickname: (nickname || "anonymous").slice(0, 40),
    message: (message || "").slice(0, 140),
    persona: sanitizePersona(persona),
    timestamp: Date.now()
  };
  try {
    await getRedis().hset(KEY, { [String(id)]: entry });
  } catch (err) {
    // Redis indispo : on log mais on retourne quand même l'entry au
    // client pour qu'il voie son post local. Pas de partage multi-user
    // mais Mike/seat continue de tourner.
    console.warn("seatStore.recordSeatMessage: Redis indispo", err?.message);
  }
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

// Renvoie le siège ACTIF (= non-released) occupé par cette IP. Si une
// entrée existe mais avec releasedAt set, on l'ignore — c'est un message
// que le visiteur a "laissé derrière lui" en changeant de siège, qui reste
// visible aux autres jusqu'à expiration naturelle (120s).
export async function findActiveSeatForIp(ip) {
  const all = await loadAllRaw();
  return all.find((s) => s.ip === ip && !s.releasedAt) || null;
}

// Marque un siège comme "released" sans l'effacer. L'entrée garde son
// timestamp et son message — les autres visiteurs continuent de la voir
// dans la liste seats jusqu'à expiration naturelle. Ne libère QUE le
// verrou IP côté findActiveSeatForIp, donc le visiteur peut immédiatement
// poster sur un autre siège sans 409.
export async function markSeatReleased(id) {
  if (id === null || id === undefined) return;
  try {
    const r = getRedis();
    const raw = await r.hget(KEY, String(id));
    if (!raw) return;
    const entry = typeof raw === "string" ? JSON.parse(raw) : raw;
    entry.releasedAt = Date.now();
    await r.hset(KEY, { [String(id)]: entry });
  } catch (err) {
    console.warn("seatStore.markSeatReleased: Redis indispo", err?.message);
  }
}
