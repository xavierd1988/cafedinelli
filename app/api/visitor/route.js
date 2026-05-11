// =============================================================================
// VISITOR — ping côté Node runtime pour notifications "nouveau visiteur"
// =============================================================================
// Le SSE /api/stream tourne en edge runtime → certains fetchs externes
// (Telegram, ntfy) s'avèrent peu fiables en pratique : le cooldown lock
// se pose mais le push ne part jamais. Symptôme : tu vois passer un
// visiteur sur le site mais pas de notif Telegram.
//
// Solution : le client appelle CE endpoint UNE fois au load de la page.
// Tourne en Node.js runtime → fetch Telegram fonctionne normalement.
// Comportement identique à recordPresence côté SSE, mais notif fiable.
// =============================================================================

import { extractIp, recordPresence } from "../../../lib/presenceStore.js";
import { notifyNewOnline } from "../../../lib/onlineNotifier.js";

export const runtime = "nodejs";

export async function POST(request) {
  const ip = extractIp(request);
  let sessionId = null;
  try {
    const body = await request.json();
    sessionId = body?.sid || null;
  } catch { /* ignore */ }

  let notified = false;
  try {
    const isNew = await recordPresence(ip, sessionId);
    if (isNew) {
      notified = await notifyNewOnline();
    }
    return Response.json({ ok: true, isNew, notified });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
