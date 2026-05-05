// Sièges partagés de la pièce secrète. Pattern identique à /api/seats
// mais limité à un set de seatId arbitraires (e1, e2, …) plutôt qu'à
// 1..6.

import {
  takeSecretSeat,
  leaveSecretSeat,
  leaveSecretSeatForIp,
  getSecretRoomSeats,
  findSecretSeatForIp
} from "../../../lib/secretRoomStore.js";

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
  const seatId = typeof body?.seatId === "string" ? body.seatId.trim() : "";
  if (!seatId) {
    return Response.json({ error: "bad seat id" }, { status: 400 });
  }
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const persona = body?.persona && typeof body.persona === "object" ? body.persona : null;

  // Une seule IP active à la fois → si elle change de siège, on libère
  // l'ancien automatiquement avant d'en prendre un nouveau.
  const existing = await findSecretSeatForIp(ip);
  if (existing && existing.seatId !== seatId) {
    await leaveSecretSeat(existing.seatId);
  }

  const entry = await takeSecretSeat({ seatId, ip, nickname, message, persona });
  return Response.json({ ok: true, entry });
}

export async function DELETE(request) {
  const ip = getIp(request);
  await leaveSecretSeatForIp(ip);
  return Response.json({ ok: true });
}
