"use client";

import { useState } from "react";
import { useDraggable } from "./useDraggable.js";
import { getModulePosition } from "../lib/modulePositions.js";

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;

export default function NeonSign() {
  const init = getModulePosition("NeonSign");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: false,
    name: "NeonSign (Cafe Dinelli)",
    initialOffset: init.offset
  });
  const [scale, setScale] = useState(init.scale);
  const [rotation, setRotation] = useState(init.rotation);
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
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
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
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const interacting = dragging || resizing || rotating;

  return (
    <div
      className={`neon-sign is-draggable${interacting ? " is-dragging" : ""}`}
      onPointerDown={handleDragStart}
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
        onPointerDown={handleRotateStart}
        title="Rotation (drag horizontal)"
        aria-label="Rotate sign"
      >
        ↻
      </div>
      <div
        className="neon-resize-handle"
        onPointerDown={handleResizeStart}
        title="Taille (drag vertical)"
        aria-label="Resize sign"
      >
        ⤡
      </div>
    </div>
  );
}
