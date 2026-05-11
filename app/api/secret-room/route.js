// Sièges partagés de la pièce secrète. Architecturalement, ce sont les
// 7e et 8e sièges du café — même pattern que /api/seats (POST + GET +
// DELETE, soft-release sur changement de siège), simplement séparés
// dans un autre hash Redis pour ne pas mélanger les rendus visuels.

import {
  takeSecretSeat,
  leaveSecretSeatForIp,
  getSecretRoomSeats,
  findSecretSeatForIp,
  findSecretSeatForSession,
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

// Anti-DDOS basique : 1 message / seconde par IP. Le vrai verrou est
// au niveau session (cf. POST plus bas).
const lastPost = new Map();
const COOLDOWN_MS = 1000;

export async function GET() {
  const seats = await getSecretRoomSeats();
  return Response.json({ seats });
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
  const rawSeatId = body?.seatId;
  const seatId = (rawSeatId !== undefined && rawSeatId !== null)
    ? String(rawSeatId).trim()
    : "";
  if (!seatId) {
    return Response.json({ error: "bad seat id" }, { status: 400 });
  }
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim().slice(0, 80) : "";
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const persona = body?.persona && typeof body.persona === "object" ? body.persona : null;

  // Verrou par session browser : refresh ne libère pas le seat. Seule
  // une nouvelle session (nouvel onglet) permet de changer.
  if (sessionId) {
    const sessionSeat = await findSecretSeatForSession(sessionId);
    if (sessionSeat && sessionSeat.seatId !== seatId) {
      return Response.json({
        error: "already_seated",
        message: `Tu es déjà au salon (siège ${sessionSeat.seatId}). Ouvre un nouvel onglet pour changer.`,
        seatId: sessionSeat.seatId
      }, { status: 409 });
    }
  }

  // Soft-release sur l'IP (autre session de la même IP qui voudrait reseat).
  const existing = await findSecretSeatForIp(ip);
  if (existing && existing.seatId !== seatId) {
    await markSecretSeatReleased(existing.seatId);
  }

  const entry = await takeSecretSeat({ seatId, ip, sessionId, nickname, message, persona });
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
