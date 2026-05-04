"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { getModulePosition } from "../lib/modulePositions.js";

export default function ShelfPanel() {
  const init = getModulePosition("ShelfPanel");
  const ds = useDragScale({
    scaled: true,
    name: "ShelfPanel (To Go Counter)",
    initialOffset: init.offset,
    initialScale: init.scale
  });

  // - total : nombre cumulé de visiteurs (Redis cafe:regulars:total)
  // - online : nombre de personnes actives sur le site dans les 15 dernières
  //   secondes (Redis cafe:presence sorted set, basé sur les polls API).
  const [total, setTotal] = useState(0);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    function handler(e) {
      const r = e.detail?.regulars;
      if (r && typeof r.total === "number") setTotal(r.total);
      if (typeof e.detail?.online === "number") setOnline(e.detail.online);
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  // Bump optimiste au commit local : +1 sur le total tant que le poll serveur
  // n'est pas remonté (le serveur fait foi ensuite).
  useEffect(() => {
    function handler(e) {
      const detail = typeof e.detail === "object" ? e.detail : null;
      if (!detail || detail.source === "remote") return;
      setTotal((t) => t + 1);
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
  }, []);

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
        <div className="shelf-online">
          <span className="shelf-online-dot" aria-hidden="true" />
          <span className="shelf-online-num">{online}</span>
          <span className="shelf-online-label">{online === 1 ? "online" : "online"}</span>
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
