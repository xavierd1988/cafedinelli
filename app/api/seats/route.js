import { recordSeatMessage, getActiveSeats, findActiveSeatForIp } from "../../../lib/seatStore.js";
import { recordRegular, getRegulars } from "../../../lib/regularsStore.js";
import { getMikeThread } from "../../../lib/mikeThreadStore.js";
import { getEyeThread } from "../../../lib/eyeThreadStore.js";
import { recordPresence, getOnlineCount, extractIp } from "../../../lib/presenceStore.js";
import { getSecretRoomSeats } from "../../../lib/secretRoomStore.js";
import { invalidateCafeState } from "../../../lib/stateStore.js";
import { getRedis } from "../../../lib/redis.js";

// Détection d'IP centralisée dans presenceStore : couvre cf-connecting-ip,
// true-client-ip, x-real-ip, x-vercel-forwarded-for et x-forwarded-for
// (premier IP de la chaîne). Plus robuste que l'ancienne version locale
// qui ne regardait que 2 headers.
function getIp(request) {
  return extractIp(request);
}

// Anti-spam basique : 1 message / seconde par IP.
const lastPost = new Map();
const COOLDOWN_MS = 1000;

export async function GET(request) {
  const ip = getIp(request);
  // Record this poll as a presence ping AVANT de lire le compteur,
  // pour que le visiteur en cours soit déjà compté dans sa propre réponse.
  await recordPresence(ip);

  // Helper résilient : si une promesse rejette (ex: Redis throttle),
  // on remplace par une valeur sûre plutôt que de faire planter
  // /api/seats au complet (HTTP 500). Chaque sous-store a son propre
  // try/catch interne, mais cette ceinture+bretelles couvre le cas
  // d'un getRedis().get() inline (taxi).
  const safe = (p, fallback = null) => p.then((v) => v).catch(() => fallback);
  const [seats, regulars, mikeRaw, eyeRaw, taxiRaw, online, secretRoom] = await Promise.all([
    safe(getActiveSeats(), []),
    safe(getRegulars(), { total: 0, recent: [] }),
    safe(getMikeThread(), null),
    safe(getEyeThread(), null),
    safe(getRedis().get("cafe:taxi:summonedAt"), null),
    safe(getOnlineCount(), 1),
    safe(getSecretRoomSeats(), [])
  ]);
  let mike = null;
  if (mikeRaw) {
    // On expose isYours au client ; on ne renvoie pas l'IP brute.
    const { ownerIp, ...rest } = mikeRaw;
    mike = { ...rest, isYours: ownerIp ? ownerIp === ip : true };
  }
  let eye = null;
  if (eyeRaw) {
    const { ownerIp, ...rest } = eyeRaw;
    eye = { ...rest, isYours: ownerIp ? ownerIp === ip : true };
  }
  // taxi : timestamp du dernier "summon-taxi" partagé (TTL 10s côté Redis).
  const taxiTs = taxiRaw ? Number(taxiRaw) : null;
  const taxi = Number.isFinite(taxiTs) ? { summonedAt: taxiTs } : null;
  return Response.json({ seats, regulars, mike, eye, taxi, online, secretRoom });
}

export async function POST(request) {
  const ip = getIp(request);
  const now = Date.now();
  if (now - (lastPost.get(ip) || 0) < COOLDOWN_MS) {
    return Response.json({ error: "slow down" }, { status: 429 });
  }
  lastPost.set(ip, now);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id < 1 || id > 6) {
    return Response.json({ error: "bad seat id" }, { status: 400 });
  }
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  // Persona du visiteur (gender + wardrobe). Optionnel — sera sanitizé
  // côté seatStore. Permet à chaque client de rendre la silhouette assise
  // avec les habits de la personne qui parle, pas du visiteur qui regarde.
  const persona = body?.persona && typeof body.persona === "object"
    ? body.persona
    : null;
  if (!message) {
    return Response.json({ error: "empty message" }, { status: 400 });
  }

  // Une seule silhouette active par IP : si cette IP est déjà à un autre
  // siège (encore "actif" = posté il y a < 60s), on refuse le nouveau post.
  const existing = await findActiveSeatForIp(ip);
  if (existing && existing.id !== id) {
    return Response.json(
      { error: "already seated", seatId: existing.id },
      { status: 409 }
    );
  }

  const entry = await recordSeatMessage({ id, ip, nickname, message, persona });
  const regulars = await recordRegular({ id, nickname, message });
  // Invalide la cache snapshot pour que le prochain tick SSE voie ce
  // nouveau message tout de suite (latence ressentie : <300ms).
  invalidateCafeState();
  return Response.json({ ok: true, entry, regulars });
}
