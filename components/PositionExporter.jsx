"use client";

import { useState } from "react";

// Liste des modules à inspecter — selecteur DOM + nom de fichier
const MODULES = [
  { selector: ".receipt",        file: "Receipt.jsx" },
  { selector: ".wclock",         file: "WeatherClock.jsx" },
  { selector: ".name-tag",       file: "NicknameTag.jsx" },
  { selector: ".shelf-panel",    file: "ShelfPanel.jsx" },
  { selector: ".paper-panel",    file: "PaperPanel.jsx" },
  { selector: ".neon-sign",      file: "NeonSign.jsx" },
  { selector: ".cafe-sign",      file: "CafeSign.jsx" },
  { selector: ".cafe-upper",     file: "CafeScene.jsx::CafeUpperFloor" },
  { selector: ".cafe-glass",     file: "CafeScene.jsx::CafeGlass" },
  { selector: ".counter-zone",   file: "Counter.jsx" },
  { selector: ".corner-curve:not(.corner-curve-2)", file: "CafeScene.jsx::CornerCurve" },
  { selector: ".corner-curve-2",                    file: "CafeScene.jsx::CornerCurve2" },
  { selector: ".cash-register",                     file: "CafeScene.jsx::CashRegister" },
  { selector: ".radio-cabinet",                     file: "CafeScene.jsx::RadioCabinet" }
];

function parseTransform(str = "") {
  const out = {};
  const t = str.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/);
  if (t) {
    out.x = +parseFloat(t[1]).toFixed(1);
    out.y = +parseFloat(t[2]).toFixed(1);
  }
  const r = str.match(/rotate\(\s*([-\d.]+)deg\s*\)/);
  if (r) out.rotation = +parseFloat(r[1]).toFixed(2);
  const s = str.match(/scale\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)/);
  if (s) {
    out.scale = +parseFloat(s[1]).toFixed(3);
    if (s[2]) out.scaleY = +parseFloat(s[2]).toFixed(3);
  }
  return out;
}

export default function PositionExporter() {
  const [status, setStatus] = useState("");

  function exportPositions() {
    const positions = {};
    MODULES.forEach(({ selector, file }) => {
      const el = document.querySelector(selector);
      if (!el) {
        positions[file] = { error: "not found" };
        return;
      }
      const t = parseTransform(el.style.transform || "");
      positions[file] = t;
      // taille pour PaperPanel (resizable)
      if (selector === ".paper-panel") {
        const w = parseFloat(el.style.width);
        const h = parseFloat(el.style.height);
        if (!isNaN(w)) positions[file].width = w;
        if (!isNaN(h)) positions[file].height = h;
      }
    });

    const json = JSON.stringify(positions, null, 2);

    console.log("=== MODULE POSITIONS ===");
    console.log(json);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(json)
        .then(() => setStatus("✓ copié — colle dans le chat"))
        .catch(() => setStatus("clipboard refusé — voir console"));
    } else {
      setStatus("voir console");
    }

    setTimeout(() => setStatus(""), 4000);
  }

  return (
    <div className="position-exporter">
      <button type="button" onClick={exportPositions}>
        📋 Export positions
      </button>
      {status && <span className="position-exporter-status">{status}</span>}
    </div>
  );
}
