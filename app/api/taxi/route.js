// Taxi NYC partagé : un visiteur clique sur CornerCurve2 → POST ici
// stocke le timestamp dans Redis avec un TTL court. Tous les autres
// visiteurs récupèrent ce timestamp via /api/seats au prochain poll
// (max 3s de latence) et déclenchent leur animation locale.

import { getRedis } from "../../../lib/redis.js";

const KEY = "cafe:taxi:summonedAt";
const TTL_SEC = 10; // un peu plus long que l'anim (6s) pour latence poll

export async function POST() {
  const now = Date.now();
  await getRedis().set(KEY, String(now), { ex: TTL_SEC });
  return Response.json({ summonedAt: now });
}

export async function GET() {
  const v = await getRedis().get(KEY);
  const ts = v ? Number(v) : null;
  return Response.json({ summonedAt: Number.isFinite(ts) ? ts : null });
}
