"use client";

import { useEffect } from "react";

// =============================================================================
// REAL-TIME STATE BUS — SSE-first, polling fallback
// =============================================================================
// Source de vérité unique pour tout l'état partagé du café :
//   1. On essaie d'ouvrir une connexion SSE persistante (/api/stream).
//      Le serveur push les changements en sub-seconde, sans polling client.
//   2. Si SSE échoue (réseau, proxy qui coupe, env qui supporte mal SSE),
//      on retombe automatiquement sur le polling /api/seats toutes les Xs.
//   3. EventSource (natif browser) gère la reconnexion automatique quand
//      Vercel ferme la connexion à ~25s — invisible côté UX.
//
// L'API publique reste identique : on dispatche `seats-remote-update` sur
// window, donc tous les composants existants (Seat, Mike, Gatekeeper,
// LeftBuilding, ShelfPanel, SecretRoom, Taxi, etc.) continuent de marcher
// sans aucune modif.
// =============================================================================

const FALLBACK_POLL_INTERVAL_MS = 6000;
// Si on n'a pas reçu un seul message SSE depuis ce délai, on considère que
// la connexion est foireuse et on bascule en polling fallback.
const SSE_HEALTH_TIMEOUT_MS = 35_000;

// Identifiant stable de l'onglet courant. Stocké en sessionStorage
// (donc UNIQUE par onglet et persistant à travers les reconnexions
// SSE / le refresh du même onglet). Sert au compteur "online" pour
// distinguer 2 onglets sur la même IP comme 2 visiteurs distincts —
// sinon le NAT (WiFi maison + smartphone) collapse le compte.
function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const KEY = "cafe-session-id";
    let sid = window.sessionStorage.getItem(KEY);
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

function dispatchPayload(data) {
  if (!data || typeof data !== "object") return;
  const payload = {
    seats: Array.isArray(data.seats) ? data.seats : [],
    regulars:
      data.regulars && typeof data.regulars === "object"
        ? data.regulars
        : { total: 0, recent: [] },
    mike: data.mike && typeof data.mike === "object" ? data.mike : null,
    eye: data.eye && typeof data.eye === "object" ? data.eye : null,
    taxi: data.taxi && typeof data.taxi === "object" ? data.taxi : null,
    online: typeof data.online === "number" ? data.online : 0,
    secretRoom: Array.isArray(data.secretRoom) ? data.secretRoom : [],
    pixooMuted: typeof data.pixooMuted === "boolean" ? data.pixooMuted : false
  };
  window.dispatchEvent(
    new CustomEvent("seats-remote-update", { detail: payload })
  );
}

export default function SeatsPoller() {
  useEffect(() => {
    let cancelled = false;
    let es = null;
    let pollTimer = null;
    let healthTimer = null;
    let lastMessageAt = Date.now();

    function startFallbackPolling() {
      // Plan B : polling /api/seats. Plus lent, plus cher en Redis, mais
      // ça marche partout. On augmente l'intervalle pour économiser.
      const sid = getOrCreateSessionId();
      const url = sid ? `/api/seats?sid=${encodeURIComponent(sid)}` : "/api/seats";
      async function tick() {
        if (cancelled) return;
        try {
          const res = await fetch(url, { cache: "no-store" });
          const data = await res.json();
          if (!cancelled) dispatchPayload(data);
        } catch {
          // silencieux : reseau temporairement HS
        }
        if (!cancelled) pollTimer = setTimeout(tick, FALLBACK_POLL_INTERVAL_MS);
      }
      tick();
    }

    function startSSE() {
      try {
        const sid = getOrCreateSessionId();
        const url = sid ? `/api/stream?sid=${encodeURIComponent(sid)}` : "/api/stream";
        es = new EventSource(url);
      } catch {
        // EventSource non supporté (très vieux browser) → fallback direct
        startFallbackPolling();
        return;
      }

      es.addEventListener("snapshot", (e) => {
        lastMessageAt = Date.now();
        try { dispatchPayload(JSON.parse(e.data)); } catch { /* ignore */ }
      });

      es.addEventListener("state", (e) => {
        lastMessageAt = Date.now();
        try { dispatchPayload(JSON.parse(e.data)); } catch { /* ignore */ }
      });

      // "bye" : le serveur ferme proprement avant le timeout Vercel.
      // EventSource va reconnecter tout seul, on n'a rien à faire.
      es.addEventListener("bye", () => {
        // no-op — le navigateur reconnecte tout seul
      });

      es.onerror = () => {
        // EventSource gère la reconnexion automatique sur les erreurs
        // transitoires. On ne fait rien ici sauf si la santé du flux
        // dépasse SSE_HEALTH_TIMEOUT_MS (vérifié dans le health check).
      };

      // Health check : si pas de message reçu depuis SSE_HEALTH_TIMEOUT_MS,
      // on ferme SSE et on bascule en polling fallback définitif.
      healthTimer = setInterval(() => {
        if (Date.now() - lastMessageAt > SSE_HEALTH_TIMEOUT_MS) {
          if (es) {
            try { es.close(); } catch {}
            es = null;
          }
          clearInterval(healthTimer);
          healthTimer = null;
          if (!cancelled) startFallbackPolling();
        }
      }, 5000);
    }

    // Visibility : quand l'onglet est en background longtemps, certains
    // navigateurs throttlent EventSource. À chaque retour foreground, on
    // s'assure d'avoir au moins une lecture fraîche.
    function onVisible() {
      if (document.visibilityState === "visible" && !es && !pollTimer) {
        // Si on est mort, redémarre proprement
        startSSE();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    startSSE();

    return () => {
      cancelled = true;
      if (es) {
        try { es.close(); } catch {}
      }
      if (pollTimer) clearTimeout(pollTimer);
      if (healthTimer) clearInterval(healthTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
