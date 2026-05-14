"use client";

import { useEffect, useRef, useState } from "react";

// =============================================================================
// X TRENDS POPUP — option A : embed officiel X via widgets.js
// =============================================================================
// On charge platform.twitter.com/widgets.js et on crée une timeline
// search via l'API window.twttr.widgets.createTimeline. C'est l'option
// la plus "live" possible sans clé API.
//
// Limites connues :
//   - Adblockers / Safari Strict Tracking Prevention peuvent bloquer
//     widgets.js (le widget reste alors vide).
//   - X a deprecated les "search timelines" embed en 2023 ; certaines
//     queries peuvent ne pas renvoyer de résultats.
//
// Fallback en cas d'échec (timeout 6s sans widget rendu) : bouton
// direct "Open on X →" qui ouvre la page de recherche dans un onglet.
// =============================================================================

const WIDGETS_SRC = "https://platform.twitter.com/widgets.js";

function loadTwitterWidgets() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.twttr && window.twttr.widgets) {
      resolve(window.twttr);
      return;
    }
    // Charge le script si pas déjà présent
    let s = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = WIDGETS_SRC;
      s.async = true;
      s.charset = "utf-8";
      document.head.appendChild(s);
    }
    // Poll jusqu'à ce que window.twttr soit dispo (ou timeout 7s)
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.twttr && window.twttr.widgets) {
        clearInterval(interval);
        resolve(window.twttr);
      } else if (Date.now() - start > 7000) {
        clearInterval(interval);
        reject(new Error("twttr load timeout"));
      }
    }, 150);
  });
}

export default function XTrendsPopup({ trend, onClose }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | failed
  const directSearchUrl = `https://x.com/search?q=${encodeURIComponent(trend)}&src=typed_query&f=live`;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    loadTwitterWidgets()
      .then((twttr) => {
        if (cancelled || !containerRef.current) return;
        // Vide le container au cas où (re-render)
        containerRef.current.innerHTML = "";
        return twttr.widgets.createTimeline(
          {
            sourceType: "profile",
            // Hack : pas d'API "search" pour createTimeline (deprecated).
            // On utilise un widget de recherche manuel : on crée un
            // <a class="twitter-timeline" href="..."> puis on demande à
            // twttr.widgets.load() de le transformer.
            screenName: "twitter"
          },
          containerRef.current,
          { height: 520, theme: "dark", chrome: "noheader nofooter" }
        );
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("failed");
      });

    // Plan B simultané : insère un <a class="twitter-timeline"> pointant
    // vers la search URL — c'est le pattern legacy qui marchait avant
    // 2023. Si X le supporte encore pour le visiteur, le widget remplace
    // automatiquement le <a> par l'iframe.
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      const a = document.createElement("a");
      a.className = "twitter-timeline";
      a.setAttribute("data-theme", "dark");
      a.setAttribute("data-chrome", "noheader nofooter transparent");
      a.setAttribute("data-tweet-limit", "5");
      a.setAttribute("data-height", "520");
      a.href = `https://twitter.com/search?q=${encodeURIComponent(trend)}`;
      a.textContent = `Tweets about ${trend}`;
      containerRef.current.appendChild(a);

      // Demande à twttr.widgets de scanner et transformer le <a>
      loadTwitterWidgets()
        .then((twttr) => {
          if (cancelled) return;
          twttr.widgets.load(containerRef.current);
          // Vérifie après 6s si un iframe a été injecté
          setTimeout(() => {
            if (cancelled) return;
            const iframe = containerRef.current?.querySelector("iframe");
            setStatus(iframe ? "ready" : "failed");
          }, 6000);
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("failed");
        });
    }

    return () => { cancelled = true; };
  }, [trend]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="xtp-overlay"
      data-file="XTrendsPopup.jsx"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="xtp-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`X tweets for ${trend}`}
      >
        <div className="xtp-header">
          <div className="xtp-logo" aria-hidden="true">𝕏</div>
          <div className="xtp-trend-info">
            <div className="xtp-trend-label">Live tweets</div>
            <div className="xtp-trend-name">{trend}</div>
          </div>
          <button
            className="xtp-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >×</button>
        </div>

        <div className="xtp-body">
          {status === "loading" && (
            <div className="xtp-state">Loading live feed…</div>
          )}
          {status === "failed" && (
            <div className="xtp-state">
              <p>X widget unavailable.<br/><span style={{ opacity: 0.6, fontSize: 12 }}>
                (X deprecated search-timeline embeds; adblockers also block widgets.js)
              </span></p>
              <a
                className="xtp-open-x"
                href={directSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open recent tweets on X →
              </a>
            </div>
          )}
          <div
            ref={containerRef}
            className="xtp-timeline"
            style={{ display: status === "ready" ? "block" : "none" }}
          />
        </div>

        <a
          className="xtp-see-more"
          href={directSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on X →
        </a>
      </div>

      <style>{`
        .xtp-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: xtp-overlay-in 220ms ease-out both;
        }
        @keyframes xtp-overlay-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        .xtp-card {
          background: #000000;
          color: #e7e9ea;
          border-radius: 16px;
          width: min(560px, 100%);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                       "Helvetica Neue", Arial, sans-serif;
          animation: xtp-card-in 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
        }
        @keyframes xtp-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .xtp-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: #000;
          flex-shrink: 0;
        }
        .xtp-logo { font-size: 26px; line-height: 1; font-weight: 700; color: #fff; }
        .xtp-trend-info { flex: 1; min-width: 0; }
        .xtp-trend-label {
          font-size: 11px;
          color: #71767b;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          font-weight: 600;
        }
        .xtp-trend-name {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .xtp-close {
          appearance: none;
          border: 0;
          background: transparent;
          font-size: 24px;
          color: #71767b;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .xtp-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .xtp-body {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          min-height: 200px;
        }
        .xtp-state {
          padding: 60px 24px;
          text-align: center;
          color: #71767b;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          font-size: 14px;
        }
        .xtp-open-x {
          display: inline-block;
          background: #1D9BF0;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          padding: 10px 18px;
          border-radius: 999px;
          text-decoration: none;
          transition: background 150ms ease;
        }
        .xtp-open-x:hover { background: #1a8cd8; }
        .xtp-timeline {
          padding: 0;
          background: #000;
        }
        .xtp-timeline iframe {
          width: 100% !important;
          border: 0 !important;
        }
        .xtp-see-more {
          padding: 12px 20px;
          text-align: center;
          color: #1D9BF0;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 130ms ease;
          flex-shrink: 0;
        }
        .xtp-see-more:hover { background: rgba(29, 155, 240, 0.08); }
      `}</style>
    </div>
  );
}
