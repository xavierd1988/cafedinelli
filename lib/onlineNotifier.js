// =============================================================================
// ONLINE NOTIFIER — push iPhone quand un nouveau visiteur arrive au café
// =============================================================================
// Quand recordPresence retourne isNew=true (visiteur jamais vu dans la
// fenêtre online de 15s), on push une notif via Telegram + ntfy.
//
// COOLDOWN 30s côté Redis pour éviter le spam :
//   - quelqu'un qui recharge la page = un seul ping
//   - 5 personnes qui arrivent en 10s = un seul ping
// Le cooldown est partagé (un seul timestamp pour tous les visiteurs),
// donc une rafale est compactée en une notif unique.
//
// Pour distinguer push messages (priority forte) et online (priority
// douce), les notifs online ont une icône différente et un body plus
// court.
// =============================================================================

import { getRedis } from "./redis.js";
import { telegramPush } from "./telegramPush.js";
import { ntfyPush } from "./ntfyPush.js";
import { getOnlineCount } from "./presenceStore.js";

const COOLDOWN_KEY = "cafe:online:lastnotif";
const COOLDOWN_MS = 30_000;

/**
 * À appeler quand recordPresence retourne isNew=true.
 * Fire-and-forget : si Redis / Telegram fail, on n'embête pas le caller.
 */
export async function notifyNewOnline() {
  try {
    const redis = getRedis();
    const last = await redis.get(COOLDOWN_KEY);
    const now = Date.now();
    const lastMs = parseInt(last, 10);
    if (Number.isFinite(lastMs) && now - lastMs < COOLDOWN_MS) {
      // Cooldown encore actif → skip
      return false;
    }
    // Lock : on pose le timestamp AVANT d'envoyer. Si plusieurs calls
    // simultanés arrivent ici, le 1er gagne, les autres voient le lock.
    await redis.set(COOLDOWN_KEY, now, { ex: 60 });

    const onlineCount = await getOnlineCount().catch(() => null);
    const body = onlineCount
      ? `${onlineCount} personnes en ligne`
      : "Un visiteur vient d'arriver";

    await Promise.all([
      telegramPush({
        title: "Nouveau visiteur",
        body,
        icon: "👤",
      }),
      ntfyPush({
        title: "Nouveau visiteur",
        body,
        priority: 3,
        tags: ["wave"],
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
