import { getRedis } from "../../../../lib/redis.js";
import { invalidateCafeState } from "../../../../lib/stateStore.js";

// Niveau brightness Pixoo (0-100). Stocké dans Redis pour persister entre
// reload de l'app et lectures par le dashboard Pixoo via SSE.
//
// Le dashboard pixoo-dashboard reçoit cette valeur dans les snapshots
// state, compare au précédent, et appelle Channel/SetBrightness sur le
// Pixoo physique uniquement quand la valeur change.
const KEY = "cafe:pixoo:brightness";
const DEFAULT_LEVEL = 100;

function parseLevel(val) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const redis = getRedis();
    const v = await redis.get(KEY);
    const level = parseLevel(v);
    return Response.json({ level: level !== null ? level : DEFAULT_LEVEL });
  } catch {
    return Response.json({ level: DEFAULT_LEVEL });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const level = parseLevel(body?.level);
  if (level === null || level < 0 || level > 100) {
    return Response.json({ error: "level must be an integer 0-100" }, { status: 400 });
  }
  try {
    const redis = getRedis();
    await redis.set(KEY, level);
    try { await invalidateCafeState(); } catch {}
    return Response.json({ level });
  } catch (e) {
    return Response.json({ error: "redis failed", detail: e?.message }, { status: 500 });
  }
}
