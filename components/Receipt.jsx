"use client";

import { useEffect, useState } from "react";
import { useDraggable } from "./useDraggable.js";

export default function Receipt({ forceNight = false, onToggleForceNight }) {
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: false,
    name: "Receipt",
    initialOffset: { x: -19, y: -18 }
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
      onMouseDown={handleDragStart}
    >
      <button
        type="button"
        className={`receipt-night-toggle${forceNight ? " is-on" : ""}`}
        onClick={onToggleForceNight}
        onMouseDown={(e) => e.stopPropagation()}
        title={forceNight ? "Force night ON — click to disable" : "Force night mode"}
        aria-pressed={forceNight}
        aria-label="Toggle forced night mode"
      >
        <span className="night-toggle-icon">{forceNight ? "🌙" : "🌗"}</span>
        <span className="night-toggle-label">{forceNight ? "NIGHT ON" : "AUTO"}</span>
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
