"use client";

import { useEffect, useState } from "react";

// =============================================================================
// TIKTOK TRENDS POPUP — 3 dernières vidéos scrapées par eye pour un keyword
// =============================================================================
// Click sur rangée "TIKTOK — TOP 15" de la newsletter → fetch
// /api/tiktok-videos?q=KEYWORD qui lit les vidéos stockées dans Redis par
// scrape_tiktok.py (Playwright headless sur eye, compte TikTok loggué).
//
// Style TikTok : fond noir, accents magenta (#FE2C55) + cyan (#25F4EE),
// thumbnails verticaux 9:16, click → ouvre la vidéo sur tiktok.com.
// =============================================================================

export default function TikTokTrendsPopup({ trend, onClose }) {
  const [items, setItems] = useState(null);
  const [stale, setStale] = useState(false);
  const [err, setErr] = useState(null);
  const directSearchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(trend)}`;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setErr(null);
    fetch(`/api/tiktok-videos?q=${encodeURIComponent(trend)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(Array.isArray(d?.items) ? d.items : []);
        setStale(!!d?.stale);
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
      className="ttp-overlay"
      data-file="TikTokTrendsPopup.jsx"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="ttp-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`TikTok videos for ${trend}`}
      >
        <div className="ttp-header">
          <div className="ttp-logo" aria-hidden="true">
            <span className="ttp-note" style={{ color: "#25F4EE", marginRight: -6 }}>♪</span>
            <span style={{ color: "#fff", letterSpacing: "-1px" }}>TikTok</span>
            <span className="ttp-note" style={{ color: "#FE2C55", marginLeft: -2 }}>♪</span>
          </div>
          <div className="ttp-trend-info">
            <div className="ttp-trend-label">
              Latest videos {stale && <span style={{ color: "#f4b942" }}>· stale</span>}
            </div>
            <div className="ttp-trend-name">{trend}</div>
          </div>
          <button
            className="ttp-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >×</button>
        </div>

        <div className="ttp-body">
          {items === null && (
            <div className="ttp-state">Loading TikTok…</div>
          )}
          {items !== null && items.length === 0 && (
            <div className="ttp-state">
              <p>No videos cached yet.<br/><span style={{ opacity: 0.6, fontSize: 12 }}>
                ({err ? "fetch failed" : "scrape might not have run today"})
              </span></p>
              <a
                className="ttp-open-tt"
                href={directSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on TikTok →
              </a>
            </div>
          )}
          {items && items.length > 0 && (
            <div className="ttp-grid">
              {items.map((v, i) => (
                <a
                  key={i}
                  className="ttp-card-video"
                  href={v.url || directSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="ttp-thumb">
                    {v.thumbnail ? (
                      <img src={v.thumbnail} alt="" loading="lazy" />
                    ) : (
                      <div className="ttp-thumb-placeholder">▶</div>
                    )}
                    <div className="ttp-thumb-overlay">
                      {v.plays && <div className="ttp-plays">▶ {v.plays}</div>}
                    </div>
                  </div>
                  <div className="ttp-meta">
                    <div className="ttp-author-row">
                      {v.avatar && (
                        <img className="ttp-avatar" src={v.avatar} alt="" loading="lazy" />
                      )}
                      <span className="ttp-author">@{v.handle || v.author}</span>
                    </div>
                    {v.desc && <div className="ttp-desc">{v.desc}</div>}
                    {(v.likes || v.comments) && (
                      <div className="ttp-stats">
                        {v.likes && <span>❤️ {v.likes}</span>}
                        {v.comments && <span>💬 {v.comments}</span>}
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <a
          className="ttp-see-more"
          href={directSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          See more on TikTok →
        </a>
      </div>

      <style>{`
        .ttp-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: ttp-overlay-in 220ms ease-out both;
        }
        @keyframes ttp-overlay-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        .ttp-card {
          background: #000000;
          color: #ffffff;
          border-radius: 16px;
          width: min(640px, 100%);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow:
            0 0 30px rgba(254, 44, 85, 0.15),
            0 24px 60px rgba(0, 0, 0, 0.6);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                       "Helvetica Neue", Arial, sans-serif;
          animation: ttp-card-in 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
        }
        @keyframes ttp-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ttp-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: #000;
          flex-shrink: 0;
        }
        .ttp-logo {
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          display: flex;
          align-items: center;
        }
        .ttp-note { font-size: 24px; }
        .ttp-trend-info { flex: 1; min-width: 0; }
        .ttp-trend-label {
          font-size: 11px;
          color: #888;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          font-weight: 600;
        }
        .ttp-trend-name {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ttp-close {
          appearance: none;
          border: 0;
          background: transparent;
          font-size: 24px;
          color: #888;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ttp-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .ttp-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          min-height: 200px;
        }
        .ttp-state {
          padding: 60px 24px;
          text-align: center;
          color: #888;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          font-size: 14px;
        }
        .ttp-open-tt {
          display: inline-block;
          background: linear-gradient(95deg, #FE2C55, #FF6080);
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          padding: 10px 22px;
          border-radius: 8px;
          text-decoration: none;
          transition: filter 150ms ease;
        }
        .ttp-open-tt:hover { filter: brightness(1.1); }
        .ttp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 520px) {
          .ttp-grid { grid-template-columns: 1fr; }
        }
        .ttp-card-video {
          background: #111;
          border-radius: 10px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          transition: transform 160ms ease, box-shadow 160ms ease;
          display: flex;
          flex-direction: column;
        }
        .ttp-card-video:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(254, 44, 85, 0.25);
        }
        .ttp-thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          background: #1a1a1a;
          overflow: hidden;
        }
        .ttp-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ttp-thumb-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          color: #444;
        }
        .ttp-thumb-overlay {
          position: absolute;
          bottom: 6px;
          left: 6px;
        }
        .ttp-plays {
          background: rgba(0,0,0,0.6);
          color: #fff;
          font-size: 11px;
          padding: 3px 7px;
          border-radius: 4px;
          font-weight: 600;
        }
        .ttp-meta {
          padding: 8px 10px 10px;
        }
        .ttp-author-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .ttp-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          object-fit: cover;
        }
        .ttp-author {
          font-size: 12px;
          color: #ccc;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ttp-desc {
          font-size: 12px;
          line-height: 1.35;
          color: #eee;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ttp-stats {
          display: flex;
          gap: 10px;
          margin-top: 6px;
          font-size: 11px;
          color: #888;
        }
        .ttp-see-more {
          padding: 12px 20px;
          text-align: center;
          color: #FE2C55;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 130ms ease;
          flex-shrink: 0;
        }
        .ttp-see-more:hover { background: rgba(254, 44, 85, 0.08); }
      `}</style>
    </div>
  );
}
