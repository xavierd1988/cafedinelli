"use client";

import { useState } from "react";
import { useDraggable } from "./useDraggable.js";

// Drag + scale (X et Y indépendants si voulu via le state).
// Retourne offset, scale, et 2 handlers (drag + resize).
export function useDragScale({
  scaled = false,
  name,
  initialOffset = { x: 0, y: 0 },
  initialScale = { x: 1, y: 1 },
  minScale = 0.15,
  maxScale = 4
} = {}) {
  const drag = useDraggable({ scaled, name, initialOffset });
  const [scale, setScale] = useState(initialScale);
  const [resizing, setResizing] = useState(false);

  function handleResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startScale = { ...scale };
    setResizing(true);

    function move(ev) {
      const factor = 1 + (ev.clientY - startY) / 200;
      setScale({
        x: Math.max(minScale, Math.min(maxScale, startScale.x * factor)),
        y: Math.max(minScale, Math.min(maxScale, startScale.y * factor))
      });
    }
    function up() {
      setResizing(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return {
    offset: drag.offset,
    scale,
    dragging: drag.dragging,
    resizing,
    interacting: drag.dragging || resizing,
    handleDragStart: drag.handleDragStart,
    handleResizeStart
  };
}
