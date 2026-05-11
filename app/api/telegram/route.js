// Endpoint debug : test direct du push Telegram depuis Vercel.
// GET pour vérifier que les env vars sont là + que telegramPush marche.
import { telegramPush } from "../../../lib/telegramPush.js";

export async function GET() {
  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasChat = !!process.env.TELEGRAM_CHAT_ID;
  const tokenLen = (process.env.TELEGRAM_BOT_TOKEN || "").length;
  const chatLen = (process.env.TELEGRAM_CHAT_ID || "").length;

  const startedAt = Date.now();
  const success = await telegramPush({
    title: "Vercel debug",
    body: "Si tu vois ça, Vercel → Telegram marche.",
    icon: "🧪",
  });
  const duration = Date.now() - startedAt;

  return Response.json({
    hasToken,
    hasChat,
    tokenLen,
    chatLen,
    success,
    duration,
  });
}
