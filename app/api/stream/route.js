// =============================================================================
// SSE STREAM — temps-réel sub-seconde au lieu du polling 3s
// =============================================================================
// Edge runtime + ReadableStream :
//   1. Le client ouvre une seule connexion HTTP longue durée
//   2. Le serveur envoie un snapshot initial complet (équiv. /api/seats GET)
//   3. Toutes les ~1.2s le serveur re-lit le snapshot, compare via une
//      signature légère, et n'envoie un message SSE que si l'état a changé
//   4. Sur Vercel Hobby, la connexion se ferme à ~25s. Le navigateur
//      (EventSource natif) reconnecte tout seul, et on renvoie un nouveau
//      snapshot pour resync
//
// Côté coût Redis : 1 round-trip par tick × ~1.2s = ~50 polls/min/connexion.
// Avec 7 lectures pipelinées en parallèle (Promise.all), c'est ~350 ops/min
// par connexion. À comparer aux ~220 ops/min/onglet du polling 3s actuel.
// Pour de petits volumes c'est un break-even ; le gain principal est la
// LATENCE (1.2s vs 3s).
//
// Si le coût Redis devient un sujet, étape suivante : centraliser tout
// l'état dans une seule clé `cafe:state` (1 op au lieu de 7).
// =============================================================================

import { extractIp } from "../../../lib/presenceStore.js";
import { getCafeState, snapshotSignature } from "../../../lib/stateStore.js";

// Edge runtime : streaming long-lived, démarrage rapide, pas de
// cold-start lourd. Limite ~25s sur Hobby, mais EventSource côté client
// reconnecte de façon transparente.
export const runtime = "edge";

// Pas de cache CDN — c'est du streaming temps-réel.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Intervalle entre 2 ticks de re-lecture côté serveur. La cache
// cafe:state (1.2s) absorbe la majorité des ticks → la plupart sont
// des lectures de cache (1 op, ~10ms). Baissé à 200ms pour que les
// messages atterrissent sur le Pixoo en sub-300ms.
// Le client peut overrider via ?tick=NNN (ms) entre 100 et 1500.
const DEFAULT_TICK_MS = 200;
const MIN_TICK_MS = 100;
const MAX_TICK_MS = 1500;

// Ferme proprement la connexion avant la limite Vercel pour que le
// navigateur reconnecte cleanly. 24s de durée + reconnexion auto = pas
// de saut perceptible côté client.
const MAX_CONNECTION_MS = 24_000;

const encoder = new TextEncoder();

function sseEvent(name, data) {
  // Format SSE : event: <name>\ndata: <json>\n\n
  return encoder.encode(
    `event: ${name}\n` +
    `data: ${JSON.stringify(data)}\n\n`
  );
}

function sseComment(text) {
  // Les commentaires SSE servent de heartbeat (les proxies/CDN ne coupent
  // pas tant qu'il y a du trafic). Ligne qui démarre par ":".
  return encoder.encode(`: ${text}\n\n`);
}

export async function GET(request) {
  const ip = extractIp(request);
  // sessionId fourni par le client (sessionStorage) → permet de compter
  // 2 onglets sur la même IP comme 2 visiteurs distincts. Fallback sur
  // l'IP seule si absent (ancienne version du client).
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sid") || null;
  // ?silent=1 → ne pas compter cette connexion comme un visiteur. Utilisé
  // par le dashboard Pixoo pour ne pas polluer le compteur online.
  const silent = url.searchParams.get("silent") === "1";
  const recordPing = !silent;
  // ?tick=NNN (ms) → vitesse de polling personnalisée. Le Pixoo dashboard
  // utilise tick=150 pour un push quasi-instantané ; le navigateur reste
  // sur 200ms par défaut.
  const tickQuery = Number(url.searchParams.get("tick"));
  const TICK_MS = Number.isFinite(tickQuery)
    ? Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, tickQuery))
    : DEFAULT_TICK_MS;
  const startedAt = Date.now();
  let lastSig = "";

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Snapshot initial (avec recordPresence à la connexion)
      try {
        const initial = await getCafeState(ip, { recordPing, sessionId });
        lastSig = snapshotSignature(initial);
        controller.enqueue(sseEvent("snapshot", initial));
      } catch {
        // Si Redis est HS, on envoie au moins un snapshot vide pour que
        // le client ne reste pas bloqué.
        controller.enqueue(sseEvent("snapshot", {
          seats: [], regulars: { total: 0, recent: [] },
          mike: null, eye: null, taxi: null, online: 1, secretRoom: []
        }));
      }

      // 2. Boucle de polling
      let timer;
      const tick = async () => {
        // Sortie propre avant la limite Vercel (le client reconnecte)
        if (Date.now() - startedAt > MAX_CONNECTION_MS) {
          try {
            controller.enqueue(sseEvent("bye", { reason: "rotate" }));
            controller.close();
          } catch { /* ignore */ }
          return;
        }

        try {
          // Pas de recordPresence à chaque tick : on l'a fait à la
          // connexion, et la fenêtre de présence est de 15s alors que les
          // reconnexions SSE sont ~24s → on remet le ping dans le tick
          // pour rester "online" pendant la connexion longue.
          const state = await getCafeState(ip, { recordPing, sessionId });
          const sig = snapshotSignature(state);
          if (sig !== lastSig) {
            lastSig = sig;
            controller.enqueue(sseEvent("state", state));
          } else {
            // État inchangé → on envoie juste un commentaire heartbeat
            // pour garder la connexion vivante (proxies, CDN, mobile)
            controller.enqueue(sseComment("hb"));
          }
        } catch {
          // Erreur isolée (ex: Redis quota dépassé) — on continue,
          // le prochain tick re-essaiera.
          controller.enqueue(sseComment("err"));
        }

        timer = setTimeout(tick, TICK_MS);
      };
      timer = setTimeout(tick, TICK_MS);

      // 3. Cleanup quand le client se déconnecte
      request.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        try { controller.close(); } catch { /* ignore */ }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // CORS/identification — innocuous mais utile en debug
      "X-Accel-Buffering": "no"
    }
  });
}
