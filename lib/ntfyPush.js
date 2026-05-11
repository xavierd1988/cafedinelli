// =============================================================================
// NTFY PUSH — Notification iPhone via ntfy.sh (gratuit, sans inscription)
// =============================================================================
// Helper réutilisable pour envoyer des push notifications iPhone depuis
// les API routes Vercel (POST /api/seats, /api/secret-room, etc.).
//
// Pourquoi côté Vercel (et pas le dashboard Pixoo) :
//   - Plus rapide : 1 hop direct (Vercel → ntfy.sh) au lieu de
//     2 (Vercel → SSE → dashboard.py → ntfy.sh)
//   - Plus fiable : marche même si le Mac est éteint
//   - Pas de dépendance sur le firmware Pixoo capricieux
//
// Config :
//   - process.env.NTFY_TOPIC : nom du topic ntfy.sh (à mettre dans
//     Vercel dashboard Settings → Environment Variables)
//   - Redis key `cafe:ntfy:muted` : si "1", on skip silencieusement
//
// Fire-and-forget avec timeout 3s : si ntfy.sh est lent, on n'attend pas.
// =============================================================================

import { getRedis } from "./redis.js";

const NTFY_BASE = "https://ntfy.sh";
const TIMEOUT_MS = 3000;
const MUTE_KEY = "cafe:ntfy:muted";

async function isMuted() {
  try {
    const v = await getRedis().get(MUTE_KEY);
    return v === 1 || v === true || v === "1";
  } catch {
    return false; // si Redis HS, on push quand même
  }
}

/**
 * Envoie une push notif iPhone via ntfy.sh.
 * Non-bloquant : si l'env n'est pas configurée ou si le topic est muté,
 * retourne false en silencieux. Pas d'exception remontée au caller.
 *
 * @param {object} opts
 * @param {string} opts.title    Titre de la notif (ex: "AU BAR — Xavier")
 * @param {string} opts.body     Corps du message
 * @param {number} [opts.priority=4]  1 (min) à 5 (max). 4 = son fort iPhone.
 * @param {string[]} [opts.tags]  ex: ["bell"] → icône cloche
 */
export async function ntfyPush({ title, body, priority = 4, tags = [] }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  if (await isMuted()) return false;

  const headers = {
    "Title": title,
    "Priority": String(priority),
  };
  if (tags && tags.length) headers["Tags"] = tags.join(",");

  try {
    const res = await fetch(`${NTFY_BASE}/${topic}`, {
      method: "POST",
      headers,
      body: body || "",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    // ntfy.sh down ou réseau lent : on n'a pas envie de bloquer la
    // réponse de l'API du café pour autant.
    return false;
  }
}
