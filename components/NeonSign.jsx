"use client";

import { useState } from "react";
import { useDraggable } from "./useDraggable.js";

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;

export default function NeonSign() {
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: false,
    name: "NeonSign (Cafe Dinelli)",
    initialOffset: { x: 746, y: 297 }
  });
  const [scale, setScale] = useState(0.43);
  const [rotation, setRotation] = useState(-3);
  const [resizing, setResizing] = useState(false);
  const [rotating, setRotating] = useState(false);

  function handleResizeStart(e) {
    if (process.env.NODE_ENV !== "development") return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startScale = scale;
    setResizing(true);

    function move(ev) {
      // drag down = grow, drag up = shrink (intuitif sur poignée corner)
      const delta = (ev.clientY - startY) / 150;
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale + delta)));
    }
    function up() {
      setResizing(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function handleRotateStart(e) {
    if (process.env.NODE_ENV !== "development") return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startRot = rotation;
    setRotating(true);

    function move(ev) {
      const dx = (ev.clientX - startX) / 2; // 2 px souris = 1°
      setRotation(startRot + dx);
    }
    function up() {
      setRotating(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const interacting = dragging || resizing || rotating;

  return (
    <div
      className={`neon-sign is-draggable${interacting ? " is-dragging" : ""}`}
      onMouseDown={handleDragStart}
      data-file="NeonSign.jsx"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
        transformOrigin: "center center"
      }}
      aria-label="Neon sign"
    >
      <div className="neon-hanger" aria-hidden="true">
        <div className="neon-bar" />
        <div className="neon-clip neon-clip-left" />
        <div className="neon-clip neon-clip-right" />
        <div className="neon-chain neon-chain-left" />
        <div className="neon-chain neon-chain-right" />
        <div className="neon-ring neon-ring-left" />
        <div className="neon-ring neon-ring-right" />
      </div>

      <div className="neon-frame">
        <div className="neon-tube neon-tube-top" />
        <div className="neon-tube neon-tube-bottom" />
        <div className="neon-tube neon-tube-left" />
        <div className="neon-tube neon-tube-right" />
        <div className="neon-corner neon-corner-tl" />
        <div className="neon-corner neon-corner-tr" />
        <div className="neon-corner neon-corner-bl" />
        <div className="neon-corner neon-corner-br" />

        <div className="neon-inner">
          <div className="neon-cafe">CAFE</div>
          <div className="neon-dinelli">Dinelli</div>
          <div className="neon-swoosh" />
        </div>
      </div>

      <div
        className="neon-rotate-handle"
        onMouseDown={handleRotateStart}
        title="Rotation (drag horizontal)"
        aria-label="Rotate sign"
      >
        ↻
      </div>
      <div
        className="neon-resize-handle"
        onMouseDown={handleResizeStart}
        title="Taille (drag vertical)"
        aria-label="Resize sign"
      >
        ⤡
      </div>
    </div>
  );
}
