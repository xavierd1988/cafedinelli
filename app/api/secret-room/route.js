// Sièges partagés de la pièce secrète. Architecturalement, ce sont les
// 7e et 8e sièges du café — même pattern que /api/seats (POST + GET +
// DELETE, soft-release sur changement de siège), simplement séparés
// dans un autre hash Redis pour ne pas mélanger les rendus visuels.

import {
  takeSecretSeat,
  leaveSecretSeatForIp,
  getSecretRoomSeats,
  findSecretSeatForIp,
  markSecretSeatReleased
} from "../../../lib/secretRoomStore.js";
import { invalidateCafeState, refreshCafeState } from "../../../lib/stateStore.js";
import { ntfyPush } from "../../../lib/ntfyPush.js";
import { telegramPush } from "../../../lib/telegramPush.js";

function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

// Anti-spam à 2 niveaux : cooldown 15s par IP + max 5 msg / 10 min.
// Identique à /api/seats — voir là-bas pour les détails.
const lastPost = new Map();
const recentPosts = new Map();
const COOLDOWN_MS = 15 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const last = lastPost.get(ip) || 0;
  if (now - last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return { ok: false, reason: `slow down — wait ${wait}s` };
  }
  const recent = (recentPosts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    const oldest = recent[0];
    const wait = Math.ceil((WINDOW_MS - (now - oldest)) / 60_000);
    return { ok: false, reason: `too many messages — wait ${wait}min` };
  }
  return { ok: true, now, recent };
}

function recordPost(ip, now, recent) {
  lastPost.set(ip, now);
  recentPosts.set(ip, [...recent, now]);
}

export async function GET() {
  const seats = await getSecretRoomSeats();
  return Response.json({ seats });
}

export async function POST(request) {
  const ip = getIp(request);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return Response.json({ error: rate.reason }, { status: 429 });
  }
  recordPost(ip, rate.now, rate.recent);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  // seatId accepté en string ou number — normalize en string pour Redis.
  // Frontend envoie maintenant 7 / 8 (numérique) pour matcher l'archi
  // unifiée avec le bar (sièges 1-6 + 7-8).
  const rawSeatId = body?.seatId;
  const seatId = (rawSeatId !== undefined && rawSeatId !== null)
    ? String(rawSeatId).trim()
    : "";
  if (!seatId) {
    return Response.json({ error: "bad seat id" }, { status: 400 });
  }
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const persona = body?.persona && typeof body.persona === "object" ? body.persona : null;

  // Soft-release : si l'IP change de siège (7 → 8 ou bar → secret),
  // on marque l'ancien comme released SANS l'effacer. L'entrée garde
  // son timestamp + son message → les autres visiteurs continuent de
  // voir ce qu'il a dit pendant les ~120s restants. Identique au bar.
  const existing = await findSecretSeatForIp(ip);
  if (existing && existing.seatId !== seatId) {
    await markSecretSeatReleased(existing.seatId);
  }

  const entry = await takeSecretSeat({ seatId, ip, nickname, message, persona });
  // Hot rebuild : on remplit la cache snapshot AVANT que le SSE tick
  // s'en rende compte → le prochain tick (~150ms) push direct au Pixoo
  // sans avoir à reconstruire le snapshot lui-même.
  await refreshCafeState();
  // Push iPhone via ntfy.sh — direct depuis Vercel. Pas de message
  // vide (le seat-claim sans texte ne déclenche rien).
  if (message) {
    const safeNickname = (nickname || "anonymous").slice(0, 30);
    await Promise.all([
      telegramPush({
        title: `SALON — ${safeNickname}`,
        body: message,
        icon: "🔔",
      }),
      ntfyPush({
        title: `SALON — ${safeNickname}`,
        body: message,
        priority: 5,
        tags: ["bell"],
      }),
    ]);
  }
  return Response.json({ ok: true, entry });
}

export async function DELETE(request) {
  const ip = getIp(request);
  await leaveSecretSeatForIp(ip);
  invalidateCafeState();
  return Response.json({ ok: true });
}
