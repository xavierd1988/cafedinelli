"use client";

import { useState } from "react";
import { useDraggable } from "./useDraggable.js";
import { getModulePosition } from "../lib/modulePositions.js";
import { EDIT_MODE } from "../lib/editMode.js";

// Fond noir plein, draggable en position et resizable en hauteur (et
// largeur via la même poignée). Posé à z-index 6, donc juste au niveau
// du cafe-glass-wrap — sert de masque/aplat noir derrière les modules
// posés au-dessus (porte z-index 7, register z-index 18, etc.).
export default function BlackBackdrop() {
  const init = getModulePosition("BlackBackdrop");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: true,
    name: "BlackBackdrop.jsx",
    initialOffset: init.offset
  });
  const [size, setSize] = useState(init.size);
  const [resizing, setResizing] = useState(false);

  function handleResizeStart(e) {
    if (!EDIT_MODE) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    setResizing(true);

    function move(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setSize({
        width: Math.max(40, startW + dx),
        height: Math.max(20, startH + dy)
      });
    }
    function up() {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const interacting = dragging || resizing;

  return (
    <div
      className={`black-backdrop is-draggable${interacting ? " is-dragging" : ""}`}
      data-file="BlackBackdrop.jsx"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
      onPointerDown={handleDragStart}
    >
      <span
        className="cafe-resize-handle black-backdrop-resize-handle"
        onPointerDown={handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}
