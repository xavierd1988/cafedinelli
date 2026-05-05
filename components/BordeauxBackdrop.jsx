"use client";

import { useState } from "react";
import { useDraggable } from "./useDraggable.js";
import { getModulePosition } from "../lib/modulePositions.js";
import { getEditMode } from "../lib/editMode.js";

// Aplat bordeaux très foncé, rectangulaire, draggable + resizable (W/H
// via la poignée ⤡). Position et taille bakées dans modulePositions.js
// sous la clé "BordeauxBackdrop", exportables via PositionExporter.
export default function BordeauxBackdrop() {
  const init = getModulePosition("BordeauxBackdrop");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: true,
    name: "BordeauxBackdrop.jsx",
    initialOffset: init.offset
  });
  const [size, setSize] = useState(init.size);
  const [resizing, setResizing] = useState(false);

  function handleResizeStart(e) {
    if (!getEditMode()) return;
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
      className={`bordeaux-backdrop is-draggable${interacting ? " is-dragging" : ""}`}
      data-file="BordeauxBackdrop.jsx"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
      onPointerDown={handleDragStart}
    >
      <span
        className="cafe-resize-handle bordeaux-backdrop-resize-handle"
        onPointerDown={handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}
