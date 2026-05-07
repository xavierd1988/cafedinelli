import { getRedis } from "../../../lib/redis.js";
import { invalidateCafeState } from "../../../lib/stateStore.js";

const KEY = "cafe:pixoo:muted";

export async function GET() {
  const redis = getRedis();
  const val = await redis.get(KEY);
  return Response.json({ muted: val === "1" });
}

export async function POST() {
  const redis = getRedis();
  const val = await redis.get(KEY);
  const next = val === "1" ? "0" : "1";
  await redis.set(KEY, next);
  // Invalide le snapshot SSE → tous les clients voient le changement
  // au prochain tick (~1.2s) sans polling séparé.
  try { await invalidateCafeState(); } catch {}
  return Response.json({ muted: next === "1" });
}
