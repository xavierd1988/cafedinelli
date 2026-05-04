"use client";

import { useEffect, useRef, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { getModulePosition } from "../lib/modulePositions.js";

// Porte rouge. Démarre FERMÉE. La seule façon de l'ouvrir : taper le bon
// password sur la silhouette c — celle-ci dispatch l'event "cafe-door-unlock"
// qu'on écoute ici. La porte s'ouvre alors 5 secondes puis se referme toute
// seule. Pas de click-toggle. Reste draggable/resizable via la poignée de
// drag dédiée (EDIT_MODE).
const OPEN_MS = 5000;

export default function CafeDoor() {
  const init = getModulePosition("CafeDoor");
  const ds = useDragScale({
    scaled: true,
    name: "CafeDoor.jsx",
    initialOffset: init.offset,
    initialScale: init.scale
  });
  const [closed, setClosed] = useState(true);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    function onUnlock() {
      // Ouvre la porte
      setClosed(false);
      // Replanifie la fermeture (clear avant pour ne pas accumuler les timers
      // si le user tape le bon password plusieurs fois d'affilée).
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setClosed(true);
        closeTimerRef.current = null;
      }, OPEN_MS);
    }
    window.addEventListener("cafe-door-unlock", onUnlock);
    return () => {
      window.removeEventListener("cafe-door-unlock", onUnlock);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`cafe-door-module is-draggable${ds.interacting ? " is-dragging" : ""}${closed ? " is-closed" : ""}`}
      data-file="CafeDoor.jsx"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`,
        transformOrigin: "center center"
      }}
      onPointerDown={ds.handleDragStart}
    >
      <div className="cafe-door-art" aria-hidden="true">
        <div className="cafe-door-glow" />
        <div className="cafe-door-frame">
          <span className="cafe-door-frame-top" />
          <span className="cafe-door-frame-left" />
          <span className="cafe-door-threshold" />
        </div>
        <div className="cafe-door">
          <span className="cafe-door-side" />
          <span className="cafe-door-panel cafe-door-panel-1" />
          <span className="cafe-door-panel cafe-door-panel-2" />
          <span className="cafe-door-panel cafe-door-panel-3" />
          <span className="cafe-door-knob-plate" />
          <span className="cafe-door-knob" />
        </div>
      </div>
      <span
        className="cafe-resize-handle cafe-door-resize-handle"
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}
