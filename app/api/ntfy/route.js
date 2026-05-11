import { getRedis } from "../../../lib/redis.js";
import { invalidateCafeState } from "../../../lib/stateStore.js";

// Mute des notifications ntfy.sh (push iPhone) pour les messages et
// nouveaux online. Stocké en Redis, lu par le dashboard pixoo-dashboard
// via SSE — si muté, le dashboard ne fait pas de POST à ntfy.sh.
//
// Indépendant du mute Pixoo : tu peux couper les push iPhone sans
// couper le buzz physique du Pixoo, et inversement.
const KEY = "cafe:ntfy:muted";

function isMuted(val) {
  return val === 1 || val === true || val === "1";
}

export async function GET() {
  try {
    const redis = getRedis();
    const v = await redis.get(KEY);
    return Response.json({ muted: isMuted(v) });
  } catch {
    return Response.json({ muted: false });
  }
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    // ?set=1 → force mute ON, ?set=0 → force mute OFF.
    // Sans ?set → toggle (comportement historique).
    const setParam = url.searchParams.get("set");
    const redis = getRedis();
    let nextMuted;
    if (setParam === "1") {
      nextMuted = true;
    } else if (setParam === "0") {
      nextMuted = false;
    } else {
      const v = await redis.get(KEY);
      nextMuted = !isMuted(v);
    }
    await redis.set(KEY, nextMuted ? 1 : 0);
    try { await invalidateCafeState(); } catch {}
    return Response.json({ muted: nextMuted });
  } catch (e) {
    return Response.json({ error: "redis failed", detail: e?.message }, { status: 500 });
  }
}
