"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { getModulePosition } from "../lib/modulePositions.js";

// Petit compteur "X/6 seats taken" autonome — draggable et resizable comme
// les autres modules. Écoute l'event "seat-state" pour suivre l'occupation.
export default function SeatsCounter({ total = 6 }) {
  const init = getModulePosition("SeatsCounter");
  const ds = useDragScale({
    scaled: true,
    name: "SeatsCounter.jsx",
    initialOffset: init.offset,
    initialScale: init.scale
  });

  const [occupied, setOccupied] = useState(() => new Set());

  useEffect(() => {
    function handler(e) {
      const { id, occupied: isOccupied } = e.detail || {};
      if (typeof id !== "number") return;
      setOccupied((prev) => {
        const next = new Set(prev);
        if (isOccupied) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    window.addEventListener("seat-state", handler);
    return () => window.removeEventListener("seat-state", handler);
  }, []);

  const count = occupied.size;
  const isFull = count === total;

  return (
    <div
      className={`seats-counter is-draggable${ds.interacting ? " is-dragging" : ""}`}
      data-file="SeatsCounter.jsx"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`,
        transformOrigin: "top left"
      }}
      onPointerDown={ds.handleDragStart}
    >
      <p className="seats-counter-label">At the Counter</p>
      <strong className="seats-counter-num">{count}/{total} seats taken</strong>
      <span className="seats-counter-sub">
        {isFull ? "The counter is full — come back soon." : "Click a seat to leave a thought"}
      </span>
      <span
        className="seats-counter-resize"
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}
