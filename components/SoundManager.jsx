"use client";

import { useEffect, useRef } from "react";
import { playSeatChime, playMikeChime } from "../lib/sounds.js";

// Singleton qui écoute les events globaux et joue les petits sons. Rendu null,
// monté une fois dans Homepage. Ignore les events des 1.5 premières secondes
// (sinon le premier poll qui rejoue tout l'historique = avalanche de chimes).
export default function SoundManager() {
  const graceRef = useRef(true);
  const lastMikeTurnTsRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      graceRef.current = false;
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onSpoke() {
      if (graceRef.current) return;
      playSeatChime();
    }

    function onPoll(e) {
      const mike = e.detail?.mike;
      if (!mike?.turns?.length) return;
      const lastTurn = mike.turns[mike.turns.length - 1];
      if (lastTurn.role !== "mike") return;
      // Init sans son lors du premier passage.
      if (graceRef.current) {
        lastMikeTurnTsRef.current = lastTurn.timestamp;
        return;
      }
      if (lastTurn.timestamp > lastMikeTurnTsRef.current) {
        lastMikeTurnTsRef.current = lastTurn.timestamp;
        playMikeChime();
      }
    }

    window.addEventListener("seat-spoke", onSpoke);
    window.addEventListener("seats-remote-update", onPoll);
    return () => {
      window.removeEventListener("seat-spoke", onSpoke);
      window.removeEventListener("seats-remote-update", onPoll);
    };
  }, []);

  return null;
}
