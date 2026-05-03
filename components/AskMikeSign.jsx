"use client";

import { useDragScale } from "./useDragScale.js";

// Petit panneau flottant qui invite à parler à Mike. Cliquer dessus dispatch
// un évènement écouté par Mike.jsx pour ouvrir son input directement.
export default function AskMikeSign() {
  const ds = useDragScale({
    scaled: false,
    name: "AskMikeSign",
    initialOffset: { x: 0, y: 0 },
    initialScale: { x: 1, y: 1 }
  });

  function handleClick(e) {
    if (ds.dragging) return;
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-mike-input"));
  }

  return (
    <aside
      className={`ask-mike is-draggable${ds.interacting ? " is-dragging" : ""}`}
      data-file="AskMikeSign.jsx"
      aria-label="Ask Mike"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y}) rotate(-1.2deg)`
      }}
      onMouseDown={ds.handleDragStart}
      onClick={handleClick}
    >
      <span className="ask-mike-text">ask a question to mike the barman</span>
      <span
        className="ask-mike-resize"
        onMouseDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </aside>
  );
}
