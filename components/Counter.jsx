"use client";

import { useEffect, useState } from "react";
import Seat from "./Seat.jsx";

export default function Counter({ seats, onDragStart, onResizeStart, transform, isDragging }) {
  const [occupiedIds, setOccupiedIds] = useState(() => new Set());

  useEffect(() => {
    function handler(e) {
      const { id, occupied } = e.detail;
      setOccupiedIds((prev) => {
        const next = new Set(prev);
        if (occupied) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    window.addEventListener("seat-state", handler);
    return () => window.removeEventListener("seat-state", handler);
  }, []);

  const count = occupiedIds.size;
  const total = seats.length;
  const isFull = count === total;

  return (
    <section
      className="counter-zone"
      id="the-counter"
      aria-labelledby="counter-title"
      data-file="Counter.jsx"
      style={{ transform, transformOrigin: "center center" }}
    >
      <div
        className={`counter-copy is-drag-handle${isDragging ? " is-dragging" : ""}`}
        onPointerDown={onDragStart}
      >
        <p className="counter-eyebrow" id="counter-title">At the Counter</p>
        <strong className="counter-num">{count}/{total} seats taken</strong>
        <span className="counter-sub">
          {isFull ? "The counter is full — come back soon." : "Click a seat to leave a thought"}
        </span>
        {onResizeStart && (
          <span
            className="cafe-resize-handle counter-resize-handle"
            onPointerDown={onResizeStart}
            title="Resize"
            aria-label="Resize counter"
          >⤡</span>
        )}
      </div>
      <div className="counter-top" aria-hidden="true" />
      <div className="counter-front" aria-hidden="true" />
      <div className="counter-rail" aria-hidden="true" />
      <div className="seats" aria-label="Cafe counter seats">
        {seats.map((seat) => (
          <Seat key={seat.id} seat={seat} />
        ))}
      </div>
    </section>
  );
}
