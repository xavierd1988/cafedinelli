// Endpoint debug : test direct du push Telegram depuis Vercel.
// GET pour vérifier que les env vars sont là + que telegramPush marche.
import { telegramPush } from "../../../lib/telegramPush.js";
import { notifyNewOnline } from "../../../lib/onlineNotifier.js";
import { getRedis } from "../../../lib/redis.js";

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "simple";
  const startedAt = Date.now();

  if (mode === "online") {
    // Clear cooldown puis appeler notifyNewOnline pour test
    try { await getRedis().del("cafe:online:lastnotif"); } catch {}
    const success = await notifyNewOnline();
    return Response.json({
      mode: "online",
      success,
      duration: Date.now() - startedAt,
    });
  }

  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasChat = !!process.env.TELEGRAM_CHAT_ID;
  const success = await telegramPush({
    title: "Vercel debug",
    body: "Si tu vois ça, Vercel → Telegram marche.",
    icon: "🧪",
  });

  return Response.json({
    mode: "simple",
    hasToken,
    hasChat,
    success,
    duration: Date.now() - startedAt,
  });
}
