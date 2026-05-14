"use client";

import { useEffect, useState } from "react";

// =============================================================================
// X TRENDS POPUP — overlay style X (Twitter) pour les rangées X Trends
// =============================================================================
// Déclenché par les rangées de la section "X / TWITTER TRENDS" de la
// newsletter (data-x-trend sur la <tr>). Fetch 5 tweets indexés par
// Google sur twitter.com/x.com via /api/x-news?q=keyword.
//
// Style X : fond noir, logo X minimal blanc, accent bleu #1D9BF0 pour
// les handles, font system. Chaque card est cliquable → ouvre le tweet
// dans un nouvel onglet.
//
// Limitation : pas d'API X officielle (payante). Les résultats viennent
// de l'indexation Google donc il peut y avoir un délai de quelques
// heures à 1-2 jours. C'est le compromis pour une solution gratuite.
// =============================================================================

function timeAgo(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

// Génère un avatar "monogramme" coloré déterministe à partir du handle.
// Pas d'image réelle (faut l'API X pour ça) → fallback typographique.
function handleColor(handle) {
  if (!handle) return "#1D9BF0";
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export default function XTrendsPopup({ trend, onClose }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setErr(null);
    fetch(`/api/x-news?q=${encodeURIComponent(trend)}`)
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

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const directSearchUrl = `https://x.com/search?q=${encodeURIComponent(trend)}&src=typed_query&f=top`;

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
        {/* Header : logo X + topic. Style X minimaliste, noir/blanc. */}
        <div className="xtp-header">
          <div className="xtp-logo" aria-hidden="true">𝕏</div>
          <div className="xtp-trend-info">
            <div className="xtp-trend-label">Trending</div>
            <div className="xtp-trend-name">{trend}</div>
          </div>
          <button
            className="xtp-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >×</button>
        </div>

        <div className="xtp-results">
          {items === null && (
            <div className="xtp-loading">Loading recent posts…</div>
          )}
          {items !== null && items.length === 0 && (
            <div className="xtp-empty">
              {err ? "Couldn't load posts." : "No indexed posts found."}
              <a className="xtp-fallback-link" href={directSearchUrl} target="_blank" rel="noopener noreferrer">
                Search on X →
              </a>
            </div>
          )}
          {items && items.map((it, i) => (
            <a
              key={i}
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="xtp-post"
            >
              <div className="xtp-avatar" style={{ background: handleColor(it.handle) }}>
                {it.handle ? it.handle.charAt(0).toUpperCase() : "𝕏"}
              </div>
              <div className="xtp-post-body">
                <div className="xtp-post-head">
                  <span className="xtp-handle">
                    {it.handle ? `@${it.handle}` : (it.source || "X")}
                  </span>
                  {it.pubDate && (
                    <span className="xtp-post-time">· {timeAgo(it.pubDate)}</span>
                  )}
                </div>
                <div className="xtp-post-title">{it.title}</div>
              </div>
            </a>
          ))}
          {items && items.length > 0 && (
            <a
              className="xtp-see-more"
              href={directSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              See all results on X →
            </a>
          )}
        </div>
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
          width: min(600px, 100%);
          max-height: 80vh;
          overflow-y: auto;
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
          position: sticky;
          top: 0;
          background: #000;
          z-index: 1;
        }
        .xtp-logo {
          font-size: 26px;
          line-height: 1;
          font-weight: 700;
          color: #ffffff;
          user-select: none;
        }
        .xtp-trend-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          min-width: 0;
        }
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
          margin-top: 1px;
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
        .xtp-close:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }
        .xtp-results { display: flex; flex-direction: column; }
        .xtp-loading, .xtp-empty {
          padding: 40px 20px;
          text-align: center;
          color: #71767b;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .xtp-fallback-link {
          color: #1D9BF0;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .xtp-fallback-link:hover { text-decoration: underline; }
        .xtp-post {
          display: flex;
          gap: 12px;
          padding: 14px 20px;
          text-decoration: none;
          color: inherit;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 130ms ease;
        }
        .xtp-post:last-of-type { border-bottom: 0; }
        .xtp-post:hover { background: rgba(255, 255, 255, 0.03); }
        .xtp-avatar {
          flex: 0 0 38px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: #ffffff;
          user-select: none;
        }
        .xtp-post-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .xtp-post-head {
          display: flex;
          gap: 6px;
          align-items: baseline;
          color: #71767b;
          font-size: 13px;
        }
        .xtp-handle {
          font-weight: 700;
          color: #e7e9ea;
        }
        .xtp-post-time { color: #71767b; }
        .xtp-post-title {
          font-size: 15px;
          line-height: 1.35;
          color: #e7e9ea;
          margin-top: 3px;
          word-break: break-word;
        }
        .xtp-see-more {
          padding: 14px 20px;
          text-align: center;
          color: #1D9BF0;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 130ms ease;
        }
        .xtp-see-more:hover { background: rgba(29, 155, 240, 0.08); }
      `}</style>
    </div>
  );
}
