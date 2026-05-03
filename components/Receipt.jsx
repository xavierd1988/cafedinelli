"use client";

import { useEffect, useState } from "react";
import { useDraggable } from "./useDraggable.js";
import { getModulePosition } from "../lib/modulePositions.js";

// Cycle 3 états : AUTO (suit l'heure) → NIGHT (forcé nuit) → DAY (forcé jour) → AUTO
const MODE_META = {
  null: { icon: "🌗", label: "AUTO", title: "Auto — follow local time. Click to force night." },
  night: { icon: "🌙", label: "NIGHT ON", title: "Forcing night. Click to force day." },
  day: { icon: "☀️", label: "DAY ON", title: "Forcing day. Click to return to auto." }
};

export default function Receipt({ forceMode = null, onCycleForceMode }) {
  const meta = MODE_META[forceMode] || MODE_META.null;
  const init = getModulePosition("Receipt");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: false,
    name: "Receipt",
    initialOffset: init.offset
  });

  const [radio, setRadio] = useState({ playing: false, track: null });

  useEffect(() => {
    function handler(e) {
      if (e.detail) setRadio(e.detail);
    }
    window.addEventListener("radio-state", handler);
    return () => window.removeEventListener("radio-state", handler);
  }, []);

  return (
    <section
      className={`receipt is-draggable${dragging ? " is-dragging" : ""}`}
      id="subscribe"
      aria-label="Newsletter signup"
      data-file="Receipt.jsx"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={handleDragStart}
    >
      <button
        type="button"
        className={`receipt-night-toggle${forceMode ? " is-on" : ""}`}
        onClick={onCycleForceMode}
        onPointerDown={(e) => e.stopPropagation()}
        title={meta.title}
        aria-pressed={forceMode !== null}
        aria-label="Cycle day/night mode"
      >
        <span className="night-toggle-icon">{meta.icon}</span>
        <span className="night-toggle-label">{meta.label}</span>
      </button>
      {radio.playing && (
        <div className="receipt-now-playing" aria-live="polite">
          <span className="rnp-pulse" aria-hidden="true" />
          <span className="rnp-station">FIP</span>
          {radio.track ? (
            <span className="rnp-track">
              <strong>{radio.track.title}</strong>
              {radio.track.artist && <em> — {radio.track.artist}</em>}
            </span>
          ) : (
            <span className="rnp-track rnp-live">Live broadcast</span>
          )}
        </div>
      )}
      <form onSubmit={(event) => event.preventDefault()}>
        <input aria-label="Email address" placeholder="name@example.com" type="email" />
        <button type="submit">Get tomorrow’s paper</button>
      </form>
    </section>
  );
}
