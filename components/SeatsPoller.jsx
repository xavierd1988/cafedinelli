"use client";

import { useEffect } from "react";

const POLL_INTERVAL_MS = 3000;

// Singleton qui interroge /api/seats toutes les 3s et dispatch un évènement
// "seats-remote-update" écouté par chaque Seat.jsx. Permet aux clients de
// voir les messages postés par d'autres visiteurs sans refresh.
export default function SeatsPoller() {
  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tick() {
      try {
        const res = await fetch("/api/seats", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const payload = {
          seats: Array.isArray(data?.seats) ? data.seats : [],
          regulars:
            data?.regulars && typeof data.regulars === "object"
              ? data.regulars
              : { total: 0, recent: [] }
        };
        window.dispatchEvent(
          new CustomEvent("seats-remote-update", { detail: payload })
        );
      } catch {
        // silencieux : pas la peine de faire pleurer l'UI sur un blip réseau
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return null;
}
