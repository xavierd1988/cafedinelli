"use client";

import { useEffect, useState } from "react";

// =============================================================================
// X TRENDS POPUP — affiche 5 tweets scrapés sur "eye" pour un keyword X
// =============================================================================
// Source : /api/x-tweets?q=KEYWORD qui lit le store Redis alimenté par
// scrape_x.py (Playwright + compte loggué) sur "eye" chaque matin.
//
// Si rien dans le cache (premier jour, scrape échoué) → fallback : bouton
// direct vers x.com/search.
// =============================================================================

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  // Plus d'une semaine : date courte "May 10"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relGeneratedAt(ts) {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const h = Math.round(diffMs / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function XTrendsPopup({ trend, onClose }) {
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState({ generatedAt: null, stale: false });
  const [err, setErr] = useState(null);
  const directSearchUrl = `https://x.com/search?q=${encodeURIComponent(trend)}&src=typed_query&f=live`;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setErr(null);
    fetch(`/api/x-tweets?q=${encodeURIComponent(trend)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(Array.isArray(d?.items) ? d.items : []);
        setMeta({ generatedAt: d?.generatedAt || null, stale: !!d?.stale });
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
            <div className="xtp-trend-label">
              Latest posts
              {meta.generatedAt && (
                <span className="xtp-freshness">
                  · scraped {relGeneratedAt(meta.generatedAt)}
                </span>
              )}
            </div>
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
          {items === null && (
            <div className="xtp-state">Loading tweets…</div>
          )}

          {items !== null && items.length === 0 && (
            <div className="xtp-state">
              <p>
                No tweets cached yet for this trend.
                <br/>
                <span style={{ opacity: 0.6, fontSize: 12 }}>
                  {err
                    ? "(network error)"
                    : "Today's scrape may not have run yet — try the live link below."}
                </span>
              </p>
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

          {items && items.length > 0 && items.map((t, i) => (
            <a
              key={i}
              href={t.url || directSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="xtp-tweet"
            >
              <div className="xtp-tweet-avatar">
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" loading="lazy" />
                ) : (
                  <div className="xtp-tweet-avatar-fallback">
                    {(t.handle || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="xtp-tweet-body">
                <div className="xtp-tweet-head">
                  {t.name && <span className="xtp-tweet-name">{t.name}</span>}
                  {t.handle && <span className="xtp-tweet-handle">@{t.handle}</span>}
                  {t.date && (
                    <>
                      <span className="xtp-tweet-dot">·</span>
                      <span className="xtp-tweet-date">{timeAgo(t.date)}</span>
                    </>
                  )}
                </div>
                {t.text && (
                  <div className="xtp-tweet-text">{t.text}</div>
                )}
                {(t.likes || t.replies || t.reposts) && (
                  <div className="xtp-tweet-stats">
                    {t.replies && <span>💬 {t.replies}</span>}
                    {t.reposts && <span>🔁 {t.reposts}</span>}
                    {t.likes && <span>❤ {t.likes}</span>}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>

        <a
          className="xtp-see-more"
          href={directSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          See more on X →
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
        .xtp-freshness {
          text-transform: none;
          letter-spacing: 0;
          margin-left: 6px;
          font-weight: 400;
          color: #565a5e;
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
          min-height: 200px;
          display: flex;
          flex-direction: column;
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
          margin: auto;
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

        /* ----- Tweet card ----- */
        .xtp-tweet {
          display: flex;
          gap: 12px;
          padding: 14px 20px;
          color: inherit;
          text-decoration: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 130ms ease;
        }
        .xtp-tweet:last-of-type { border-bottom: 0; }
        .xtp-tweet:hover { background: rgba(255, 255, 255, 0.03); }

        .xtp-tweet-avatar {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 50%;
          overflow: hidden;
          background: #2f3336;
        }
        .xtp-tweet-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .xtp-tweet-avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 18px;
          background: linear-gradient(135deg, #1d9bf0 0%, #0a5dab 100%);
        }

        .xtp-tweet-body { flex: 1; min-width: 0; }
        .xtp-tweet-head {
          display: flex;
          align-items: baseline;
          gap: 5px;
          flex-wrap: wrap;
          margin-bottom: 4px;
          font-size: 14px;
          line-height: 1.2;
        }
        .xtp-tweet-name {
          font-weight: 700;
          color: #e7e9ea;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }
        .xtp-tweet-handle, .xtp-tweet-dot, .xtp-tweet-date {
          color: #71767b;
          font-weight: 400;
        }
        .xtp-tweet-text {
          font-size: 14px;
          line-height: 1.4;
          color: #e7e9ea;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
          margin-bottom: 6px;
        }
        .xtp-tweet-stats {
          display: flex;
          gap: 18px;
          font-size: 12px;
          color: #71767b;
          margin-top: 6px;
        }
        .xtp-tweet-stats span { display: flex; align-items: center; gap: 4px; }

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
