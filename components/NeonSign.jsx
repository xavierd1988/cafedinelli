"use client";

import { getModulePosition } from "../lib/modulePositions.js";

// NeonSign est désormais purement statique : pas de drag, resize ou rotation.
// Il est rendu comme enfant de CafeSign et hérite de son transform — c'est
// CafeSign qui se déplace/redimensionne en dev, le néon suit.

export default function NeonSign() {
  const init = getModulePosition("NeonSign");
  const offset = init.offset || { x: 0, y: 0 };
  const scale = typeof init.scale === "number" ? init.scale : 1;
  const rotation = typeof init.rotation === "number" ? init.rotation : 0;

  return (
    <div
      className="neon-sign"
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
    </div>
  );
}
