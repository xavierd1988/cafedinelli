"use client";

import { useState } from "react";

// Drag handler partagé pour tous les modules.
// - scaled: true si l'élément est dans .scene-stage (compense le scale de la stage).
//   Pour les éléments en position fixed (Receipt, WeatherClock), passe scaled:false.
export function useDraggable({ scaled = false, name = null, initialOffset = { x: 0, y: 0 } } = {}) {
  const [offset, setOffset] = useState(initialOffset);
  const [dragging, setDragging] = useState(false);

  function handleDragStart(e) {
    // ignore les clics sur des contrôles interactifs
    const tag = (e.target.tagName || "").toLowerCase();
    if (["input", "button", "textarea", "select", "a", "label"].includes(tag)) return;

    if (name && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("module-click", { detail: name }));
    }

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startOffset = { ...offset };
    const scale = scaled
      ? Math.min(window.innerWidth / 1600, window.innerHeight / 900) || 1
      : 1;

    setDragging(true);

    function handleMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setOffset({ x: startOffset.x + dx, y: startOffset.y + dy });
    }

    function handleUp() {
      setDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return { offset, dragging, handleDragStart };
}
