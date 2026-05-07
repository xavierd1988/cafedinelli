import { getRedis } from "../../../lib/redis.js";
import { invalidateCafeState } from "../../../lib/stateStore.js";

const KEY = "cafe:pixoo:muted";

// Upstash REST client retourne les strings numériques comme numbers après
// JSON.parse (ex: redis.set(key,"1") → redis.get(key) retourne 1, pas "1").
// On compare donc avec === 1 (number) partout.
function isMuted(val) {
  return val === 1 || val === true || val === "1";
}

export async function GET() {
  const redis = getRedis();
  const val = await redis.get(KEY);
  return Response.json({ muted: isMuted(val) });
}

export async function POST() {
  const redis = getRedis();
  const val = await redis.get(KEY);
  const nextMuted = !isMuted(val);
  await redis.set(KEY, nextMuted ? 1 : 0);
  try { await invalidateCafeState(); } catch {}
  return Response.json({ muted: nextMuted });
}
