import { getRedis } from "../../../lib/redis.js";

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
  return Response.json({ muted: next === "1" });
}
