"use client";

import { useDragScale } from "./useDragScale.js";

export default function CafeSign() {
  const ds = useDragScale({
    scaled: true,
    name: "CafeSign.jsx",
    initialOffset: { x: 154.7, y: 118 },
    initialScale: { x: 1.141, y: 1.141 }
  });

  return (
    <header
      className={`cafe-sign${ds.interacting ? " is-dragging" : ""}`}
      data-file="CafeSign.jsx"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) rotate(0.2deg) scale(${ds.scale.x}, ${ds.scale.y})`
      }}
    >
      <div className="sign-face">
        <h1>
          <span className="sign-capsule">CAFÉ DINELLI</span>
        </h1>
      </div>
      <span
        className={`cafe-drag-knob${ds.interacting ? " is-dragging" : ""}`}
        onMouseDown={ds.handleDragStart}
        title="Drag CafeSign"
        aria-label="Drag CafeSign"
      >✥</span>
      <span
        className="cafe-resize-handle"
        onMouseDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </header>
  );
}
