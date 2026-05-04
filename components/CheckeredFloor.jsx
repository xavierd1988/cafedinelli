"use client";

import { useRef, useState } from "react";
import { useDraggable } from "./useDraggable.js";
import { getModulePosition } from "../lib/modulePositions.js";
import { getEditMode } from "../lib/editMode.js";

// Module sol en damier bordeaux + noir. Rectangulaire horizontal par
// défaut, draggable en position, resizable indépendamment en largeur et
// hauteur via la poignée ⤡, et rotatable via la poignée ⟳ (top-right).
// La rotation est calculée comme l'angle entre le centre du module et
// la position courante du pointeur — drag circulaire = rotation libre.
// Le PositionExporter parse `rotate(...)` du transform pour le bake.
export default function CheckeredFloor() {
  const init = getModulePosition("CheckeredFloor");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: true,
    name: "CheckeredFloor.jsx",
    initialOffset: init.offset
  });
  const [size, setSize] = useState(init.size);
  const [rotation, setRotation] = useState(
    typeof init.rotation === "number" ? init.rotation : 0
  );
  const [resizing, setResizing] = useState(false);
  const [rotating, setRotating] = useState(false);
  const rootRef = useRef(null);

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
        width: Math.max(60, startW + dx),
        height: Math.max(30, startH + dy)
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

  function handleRotateStart(e) {
    if (!getEditMode()) return;
    e.preventDefault();
    e.stopPropagation();
    const el = rootRef.current;
    if (!el) return;
    // Centre du module en coords écran (la getBoundingClientRect tient
    // déjà compte du scale + transform parent).
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const startRot = rotation;
    setRotating(true);

    function move(ev) {
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
      let next = startRot + (angle - startAngle);
      // Normalise dans [-180, 180] pour des valeurs lisibles à l'export.
      next = ((next + 180) % 360 + 360) % 360 - 180;
      setRotation(+next.toFixed(2));
    }
    function up() {
      setRotating(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const interacting = dragging || resizing || rotating;

  return (
    <div
      ref={rootRef}
      className={`checkered-floor is-draggable${interacting ? " is-dragging" : ""}`}
      data-file="CheckeredFloor.jsx"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
        transformOrigin: "center center",
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
      onPointerDown={handleDragStart}
    >
      <span
        className="checkered-floor-rotate-handle"
        onPointerDown={handleRotateStart}
        title="Rotate (drag autour du centre)"
        aria-label="Rotate"
      >⟳</span>
      <span
        className="cafe-resize-handle checkered-floor-resize-handle"
        onPointerDown={handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}
