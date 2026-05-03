"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";

function formatStamp(ts) {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const h24 = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${day}/${mon} · ${h12}:${mm} ${ampm}`;
}

export default function ShelfPanel() {
  const ds = useDragScale({
    scaled: true,
    name: "ShelfPanel (To Go Counter)",
    initialOffset: { x: 196.4, y: 32.9 },
    initialScale: { x: 0.727, y: 0.727 }
  });

  const [history, setHistory] = useState([]);

  useEffect(() => {
    function handler(e) {
      const detail = typeof e.detail === "object" ? e.detail : null;
      if (!detail) return;
      setHistory((prev) => [
        { id: detail.id, message: detail.message, timestamp: detail.timestamp },
        ...prev
      ]);
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
  }, []);

  const lastThree = history.slice(0, 3);
  const total = history.length;

  return (
    <section
      className={`shelf-panel is-draggable${ds.interacting ? " is-dragging" : ""}`}
      id="to-go-counter"
      aria-labelledby="shelf-title"
      data-file="ShelfPanel.jsx"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`
      }}
      onMouseDown={ds.handleDragStart}
    >
      <div className="shelf-head">
        <h2 id="shelf-title">To Go Counter</h2>
      </div>
      <div className="shelf-stats">
        <div className="shelf-total">
          <span className="shelf-total-num">{total}</span>
          <span className="shelf-total-label">regulars</span>
        </div>
        <div className="shelf-recent">
          <p className="shelf-recent-title">Last to join</p>
          {lastThree.length === 0 ? (
            <p className="shelf-recent-empty">No one yet…</p>
          ) : (
            <ul>
              {lastThree.map((entry, i) => (
                <li key={`${entry.id}-${entry.timestamp}-${i}`}>
                  <span className="shelf-recent-seat">Seat {entry.id}</span>
                  <span className="shelf-recent-stamp">{formatStamp(entry.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <span
        className="shelf-resize-handle"
        onMouseDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </section>
  );
}
