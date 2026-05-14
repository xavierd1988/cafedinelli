"use client";

import { useEffect, useState } from "react";

// =============================================================================
// GOOGLE TRENDS POPUP — overlay style Google quand on clique un trend
// =============================================================================
// Déclenché par les rangées de la section "GOOGLE TRENDS USA" de la
// newsletter (data-google-trend sur la <tr>). Fetch les 5 derniers
// articles Google News via /api/google-news?q=keyword et les affiche
// avec un style Google : fond blanc, accent bleu #1a73e8, font system.
//
// Chaque card est cliquable et ouvre l'article dans un nouvel onglet.
// =============================================================================

function timeAgo(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export default function GoogleTrendsPopup({ trend, onClose }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setErr(null);
    fetch(`/api/google-news?q=${encodeURIComponent(trend)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(Array.isArray(d?.items) ? d.items : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e?.message || "network");
        setItems([]);
      });
    return () => { cancelled = true; };
  }, [trend]);

  // Escape pour fermer
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="gtp-overlay"
      data-file="GoogleTrendsPopup.jsx"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="gtp-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Google search results for ${trend}`}
      >
        {/* Header style Google : logo en lettres colorées + query dans une barre */}
        <div className="gtp-header">
          <div className="gtp-logo" aria-hidden="true">
            <span style={{ color: "#4285f4" }}>G</span>
            <span style={{ color: "#ea4335" }}>o</span>
            <span style={{ color: "#fbbc04" }}>o</span>
            <span style={{ color: "#4285f4" }}>g</span>
            <span style={{ color: "#34a853" }}>l</span>
            <span style={{ color: "#ea4335" }}>e</span>
          </div>
          <div className="gtp-search">
            <span className="gtp-search-icon" aria-hidden="true">🔍</span>
            <span className="gtp-search-q">{trend}</span>
          </div>
          <button
            className="gtp-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >×</button>
        </div>

        <div className="gtp-results">
          {items === null && (
            <div className="gtp-loading">Loading top stories…</div>
          )}
          {items !== null && items.length === 0 && (
            <div className="gtp-empty">
              {err ? "Couldn't reach Google News." : "No recent stories found."}
            </div>
          )}
          {items && items.map((it, i) => (
            <a
              key={i}
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="gtp-result"
            >
              <div className="gtp-result-source">
                {it.source || new URL(it.link).hostname.replace(/^www\./, "")}
              </div>
              <div className="gtp-result-title">{it.title}</div>
              {it.pubDate && (
                <div className="gtp-result-meta">{timeAgo(it.pubDate)}</div>
              )}
            </a>
          ))}
        </div>
      </div>

      <style>{`
        .gtp-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(20, 22, 28, 0.55);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: gtp-overlay-in 220ms ease-out both;
        }
        @keyframes gtp-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .gtp-card {
          background: #ffffff;
          color: #202124;
          border-radius: 14px;
          width: min(640px, 100%);
          max-height: 80vh;
          overflow-y: auto;
          box-shadow:
            0 1px 6px rgba(32, 33, 36, 0.18),
            0 24px 60px rgba(0, 0, 0, 0.35);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                       Roboto, "Helvetica Neue", Arial, sans-serif;
          animation: gtp-card-in 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
        }
        @keyframes gtp-card-in {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gtp-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #ebedf0;
          position: sticky;
          top: 0;
          background: #ffffff;
          z-index: 1;
        }
        .gtp-logo {
          font-family: "Product Sans", Arial, sans-serif;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.3px;
          user-select: none;
        }
        .gtp-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f1f3f4;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 14px;
          color: #3c4043;
          border: 1px solid transparent;
          transition: background 150ms ease, border-color 150ms ease;
        }
        .gtp-search:hover {
          background: #ffffff;
          border-color: #dadce0;
        }
        .gtp-search-icon { opacity: 0.6; font-size: 13px; }
        .gtp-search-q { font-weight: 500; }
        .gtp-close {
          appearance: none;
          border: 0;
          background: transparent;
          font-size: 22px;
          color: #5f6368;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gtp-close:hover {
          background: #f1f3f4;
          color: #202124;
        }
        .gtp-results {
          display: flex;
          flex-direction: column;
        }
        .gtp-loading, .gtp-empty {
          padding: 40px 20px;
          text-align: center;
          color: #5f6368;
          font-size: 14px;
        }
        .gtp-result {
          display: block;
          padding: 14px 20px;
          text-decoration: none;
          color: inherit;
          border-bottom: 1px solid #ebedf0;
          transition: background 130ms ease;
        }
        .gtp-result:last-child { border-bottom: 0; }
        .gtp-result:hover { background: #f8f9fa; }
        .gtp-result-source {
          font-size: 12px;
          color: #5f6368;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .gtp-result-title {
          font-size: 16px;
          line-height: 1.35;
          color: #1a0dab;          /* couleur lien Google */
          font-weight: 400;
          margin-bottom: 4px;
        }
        .gtp-result:visited .gtp-result-title { color: #681da8; }
        .gtp-result-meta {
          font-size: 12px;
          color: #70757a;
        }
      `}</style>
    </div>
  );
}
