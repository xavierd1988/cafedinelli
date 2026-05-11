// =============================================================================
// TELEGRAM PUSH — Notification iPhone via bot Telegram
// =============================================================================
// Push beaucoup plus rapide que ntfy.sh (300-500ms ressentis vs 1-3s)
// parce que Telegram maintient une socket persistante avec l'app iOS
// (MTProto) au lieu de passer par APNs (Apple Push Notification Service).
//
// Setup :
//   1. @BotFather sur Telegram → /newbot → récup le bot token
//   2. Démarrer une conversation avec ton bot (/start)
//   3. Récupérer ton chat_id via getUpdates
//   4. Configurer TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans Vercel env vars
//
// Le helper respecte le mute partagé (cafe:ntfy:muted) — même toggle '00'
// sur la caisse coupe les 2 canaux d'un coup. On peut séparer plus tard
// si besoin.
//
// Fire-and-forget avec timeout court : si Telegram lent, on n'attend pas.
// =============================================================================

import { getRedis } from "./redis.js";

const TIMEOUT_MS = 3000;
const MUTE_KEY = "cafe:ntfy:muted";

async function isMuted() {
  try {
    const v = await getRedis().get(MUTE_KEY);
    return v === 1 || v === true || v === "1";
  } catch {
    return false;
  }
}

/**
 * Envoie un message Telegram via le bot configuré.
 * Non-bloquant, no-op silencieux si :
 *   - TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquent
 *   - Le mute Redis est actif
 *   - L'API Telegram timeout
 *
 * @param {object} opts
 * @param {string} opts.title  Titre (en bold dans le message)
 * @param {string} opts.body   Corps du message
 * @param {string} [opts.icon] Emoji optionnel (ex: "🔔") affiché en préfixe
 */
export async function telegramPush({ title, body, icon = "" }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  if (await isMuted()) return false;

  // Markdown V2 pour le bold. On échappe les caractères spéciaux.
  const escape = (s) =>
    String(s || "").replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");

  const text = `${icon ? icon + " " : ""}*${escape(title)}*\n${escape(body)}`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "MarkdownV2",
          disable_notification: false,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
