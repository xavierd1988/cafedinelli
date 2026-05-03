"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { getModulePosition } from "../lib/modulePositions.js";

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
  const init = getModulePosition("ShelfPanel");
  const ds = useDragScale({
    scaled: true,
    name: "ShelfPanel (To Go Counter)",
    initialOffset: init.offset,
    initialScale: init.scale
  });

  // Compteur global et derniers entrants viennent du serveur (Redis), partagés
  // entre tous les visiteurs et persistés. Mis à jour via SeatsPoller (~3s)
  // et bumpés instantanément au commit local pour un feedback immédiat.
  const [total, setTotal] = useState(0);
  const [recent, setRecent] = useState([]);

  // Sync depuis le serveur via le polling.
  useEffect(() => {
    function handler(e) {
      const r = e.detail?.regulars;
      if (!r) return;
      if (typeof r.total === "number") setTotal(r.total);
      if (Array.isArray(r.recent)) setRecent(r.recent);
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  // Bump optimiste au commit local : +1 et insert en tête, en attendant que
  // le prochain poll vienne reconcilier avec la valeur serveur autoritative.
  useEffect(() => {
    function handler(e) {
      const detail = typeof e.detail === "object" ? e.detail : null;
      if (!detail) return;
      // Les seat-spoke "remote" viennent du polling — le serveur a déjà
      // incrémenté le total et l'a mis à jour côté Redis. On évite le double comptage.
      if (detail.source === "remote") return;
      setTotal((t) => t + 1);
      setRecent((prev) =>
        [
          { id: detail.id, nickname: detail.nickname, message: detail.message, timestamp: detail.timestamp },
          ...prev
        ].slice(0, 20)
      );
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
  }, []);

  const lastThree = recent.slice(0, 3);

  return (
    <section
      className={`shelf-panel is-draggable${ds.interacting ? " is-dragging" : ""}`}
      id="to-go-counter"
      aria-labelledby="shelf-title"
      data-file="ShelfPanel.jsx"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`
      }}
      onPointerDown={ds.handleDragStart}
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
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </section>
  );
}
