import { recordSeatMessage, getActiveSeats, findActiveSeatForIp, markSeatReleased, leaveSeatForIp } from "../../../lib/seatStore.js";
import { recordRegular, getRegulars } from "../../../lib/regularsStore.js";
import { getMikeThread } from "../../../lib/mikeThreadStore.js";
import { getEyeThread } from "../../../lib/eyeThreadStore.js";
import { recordPresence, getOnlineCount, extractIp } from "../../../lib/presenceStore.js";
import { getSecretRoomSeats } from "../../../lib/secretRoomStore.js";
import { invalidateCafeState, refreshCafeState } from "../../../lib/stateStore.js";
import { getRedis } from "../../../lib/redis.js";
import { ntfyPush } from "../../../lib/ntfyPush.js";
import { telegramPush } from "../../../lib/telegramPush.js";

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
  // Le client SSE/polling envoie un sessionId stable par onglet ; on
  // l'utilise comme partie de la clé présence pour distinguer 2 onglets
  // qui partagent la même IP (NAT, partage de WiFi, etc.).
  const sid = new URL(request.url).searchParams.get("sid") || null;
  // Record this poll as a presence ping AVANT de lire le compteur,
  // pour que le visiteur en cours soit déjà compté dans sa propre réponse.
  const isNew = await recordPresence(ip, sid);
  if (isNew) {
    try { invalidateCafeState(); } catch {}
  }

  // Helper résilient : si une promesse rejette (ex: Redis throttle),
  // on remplace par une valeur sûre plutôt que de faire planter
  // /api/seats au complet (HTTP 500). Chaque sous-store a son propre
  // try/catch interne, mais cette ceinture+bretelles couvre le cas
  // d'un getRedis().get() inline (taxi).
  const safe = (p, fallback = null) => p.then((v) => v).catch(() => fallback);
  const [seats, regulars, mikeRaw, eyeRaw, taxiRaw, online, secretRoom, pixooMutedRaw] = await Promise.all([
    safe(getActiveSeats(), []),
    safe(getRegulars(), { total: 0, recent: [] }),
    safe(getMikeThread(), null),
    safe(getEyeThread(), null),
    safe(getRedis().get("cafe:taxi:summonedAt"), null),
    safe(getOnlineCount(), 1),
    safe(getSecretRoomSeats(), []),
    safe(getRedis().get("cafe:pixoo:muted"), 0)
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
  const pixooMuted = pixooMutedRaw === 1 || pixooMutedRaw === true || pixooMutedRaw === "1";
  return Response.json({ seats, regulars, mike, eye, taxi, online, secretRoom, pixooMuted });
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

  // Si le visiteur change de siège, on ne SUPPRIME PAS son ancien
  // message — on le marque juste "released" pour libérer le verrou IP.
  // L'entrée garde son timestamp + son message, donc les autres
  // visiteurs continuent de voir ce qu'il a dit pendant les ~120s
  // restants avant expiration naturelle. Permet au visiteur de poster
  // sur un nouveau siège sans 409 ET sans effacer ses messages déjà dits.
  const existing = await findActiveSeatForIp(ip);
  if (existing && existing.id !== id) {
    await markSeatReleased(existing.id);
  }

  const entry = await recordSeatMessage({ id, ip, nickname, message, persona });
  const regulars = await recordRegular({ id, nickname, message });
  // Hot rebuild : on remplit la cache snapshot AVANT que le SSE tick
  // s'en rende compte → le prochain tick push direct au Pixoo (~30ms
  // cache read) sans reconstruire le snapshot lui-même (~150ms).
  await refreshCafeState();
  // Push iPhone via ntfy.sh — directement depuis Vercel, plus rapide
  // que de passer par le dashboard Pixoo local. Fire-and-forget mais
  // on l'await pour que le serverless function ne se termine pas avant
  // la fin de la requête vers ntfy.sh (~150ms).
  // Telegram push : ~300-500ms ressenti vs 1-3s pour ntfy.sh+APNs.
  // En parallèle, ntfy reste actif comme fallback (no-op si pas configuré).
  const safeNickname = (nickname || "anonymous").slice(0, 30);
  await Promise.all([
    telegramPush({
      title: `AU BAR — ${safeNickname}`,
      body: message,
      icon: "🔔",
    }),
    ntfyPush({
      title: `AU BAR — ${safeNickname}`,
      body: message,
      priority: 5,
      tags: ["bell"],
    }),
  ]);
  return Response.json({ ok: true, entry, regulars });
}

// DELETE = "I'm leaving my bar seat". Hard-delete l'entrée Redis pour
// que les autres visiteurs voient le siège libre IMMÉDIATEMENT — pas de
// délai 120s. Déclenché par le clic sur la silhouette côté client.
export async function DELETE(request) {
  const ip = getIp(request);
  const left = await leaveSeatForIp(ip);
  if (left) {
    await refreshCafeState();
  }
  return Response.json({ ok: true, left });
}
