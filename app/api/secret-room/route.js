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

function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

const lastPost = new Map();
const COOLDOWN_MS = 800;

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
    await ntfyPush({
      title: `SALON — ${(nickname || "anonymous").slice(0, 30)}`,
      body: message,
      priority: 5,           // urgent : bypass certains DND iOS, +rapide
      tags: ["bell"],
    });
  }
  return Response.json({ ok: true, entry });
}

export async function DELETE(request) {
  const ip = getIp(request);
  await leaveSecretSeatForIp(ip);
  invalidateCafeState();
  return Response.json({ ok: true });
}
