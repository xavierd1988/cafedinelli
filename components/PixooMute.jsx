"use client";

import { useEffect, useRef, useState } from "react";

const SIDES = ["top", "bottom", "left"];

export default function PixooMute() {
  const [muted, setMuted] = useState(false);
  const [catSide, setCatSide] = useState("top");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/pixoo")
      .then((r) => r.json())
      .then((d) => {
        setMuted(!!d.muted);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  function toggle(e) {
    e.stopPropagation();
    setCatSide(SIDES[Math.floor(Math.random() * SIDES.length)]);
    fetch("/api/pixoo", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setMuted(!!d.muted))
      .catch(() => {});
  }

  if (!ready) return null;

  return (
    <div
      className="pixoo-mute-wrap"
      onClick={toggle}
      title={muted ? "Pixoo muted — click to unmute" : "Mute Pixoo buzzer"}
      data-file="PixooMute.jsx"
      aria-label={muted ? "Pixoo muted" : "Mute Pixoo"}
    >
      <style>{`
        .pixoo-mute-wrap {
          position: absolute;
          left: 960px;
          top: 262px;
          width: 72px;
          height: 56px;
          cursor: pointer;
          z-index: 30;
          user-select: none;
        }
        .pixoo-mute-window {
          position: absolute;
          inset: 0;
          background: rgba(12, 9, 7, 0.82);
          border: 2px solid rgba(90, 75, 58, 0.7);
          border-radius: 1px;
          box-shadow: inset 0 0 12px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
          overflow: hidden;
        }
        .pixoo-mute-window::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(90, 75, 58, 0.5);
          transform: translateX(-50%);
        }
        .pixoo-mute-window::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 2px;
          background: rgba(90, 75, 58, 0.5);
          transform: translateY(-50%);
        }
        .pixoo-mute-window.is-muted {
          background: rgba(8, 6, 5, 0.92);
        }
        /* Faint light glow when not muted */
        .pixoo-mute-window:not(.is-muted)::before {
          box-shadow: 0 0 8px rgba(255, 200, 100, 0.08);
        }
        /* Cat container — overflows the window bounds */
        .pixoo-mute-cat {
          position: absolute;
          font-size: 26px;
          line-height: 1;
          pointer-events: none;
          z-index: 1;
          animation: cat-appear 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .pixoo-mute-cat.from-top {
          top: -26px;
          left: 50%;
          transform: translateX(-50%);
        }
        .pixoo-mute-cat.from-bottom {
          bottom: -26px;
          left: 50%;
          transform: translateX(-50%);
        }
        .pixoo-mute-cat.from-left {
          left: -26px;
          top: 50%;
          transform: translateY(-50%);
        }
        @keyframes cat-appear {
          from { opacity: 0; transform: translateX(-50%) scale(0.5); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        .pixoo-mute-cat.from-bottom {
          animation-name: cat-appear-bottom;
        }
        .pixoo-mute-cat.from-left {
          animation-name: cat-appear-left;
        }
        @keyframes cat-appear-bottom {
          from { opacity: 0; transform: translateX(-50%) scale(0.5); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes cat-appear-left {
          from { opacity: 0; transform: translateY(-50%) scale(0.5); }
          to   { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        .pixoo-mute-wrap:hover .pixoo-mute-window {
          border-color: rgba(120, 100, 78, 0.9);
        }
      `}</style>

      <div className={`pixoo-mute-window${muted ? " is-muted" : ""}`} />

      {muted && (
        <span
          key={catSide}
          className={`pixoo-mute-cat from-${catSide}`}
          aria-hidden="true"
        >
          🐱
        </span>
      )}
    </div>
  );
}
