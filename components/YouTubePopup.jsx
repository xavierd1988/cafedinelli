"use client";

import { useEffect, useState } from "react";

// =============================================================================
// YOUTUBE POPUP — overlay player quand on clique sur un trend YouTube
// =============================================================================
// Déclenché par les rangées de la section "▶️ YOUTUBE — TOP 15" de la
// newsletter (data-youtube-trend sur la <tr>). Fetch la 1ère vidéo
// correspondant au keyword via /api/youtube-search?q=KEYWORD, puis
// affiche un iframe embed officiel youtube.com/embed/VIDEO_ID en
// autoplay.
//
// Style YouTube : fond très sombre, accent rouge YT, header avec logo
// et nom de la chaîne, infos (durée, vues, date) sous le player.
// =============================================================================

export default function YouTubePopup({ trend, onClose }) {
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | failed

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    setStatus("loading");
    fetch(`/api/youtube-search?q=${encodeURIComponent(trend)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const first = Array.isArray(d?.items) && d.items[0] ? d.items[0] : null;
        if (first && first.videoId) {
          setItem(first);
          setStatus("ready");
        } else {
          setStatus("failed");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("failed");
      });
    return () => { cancelled = true; };
  }, [trend]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const directSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trend)}`;
  const embedSrc = item
    ? `https://www.youtube-nocookie.com/embed/${item.videoId}?autoplay=1&modestbranding=1&rel=0`
    : null;

  return (
    <div
      className="ytp-overlay"
      data-file="YouTubePopup.jsx"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="ytp-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`YouTube video for ${trend}`}
      >
        <div className="ytp-header">
          <div className="ytp-logo" aria-hidden="true">
            <span className="ytp-logo-play">▶</span>
            <span className="ytp-logo-text">YouTube</span>
          </div>
          <div className="ytp-trend-info">
            <div className="ytp-trend-label">Trending search</div>
            <div className="ytp-trend-name">{trend}</div>
          </div>
          <button
            className="ytp-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >×</button>
        </div>

        <div className="ytp-body">
          {status === "loading" && (
            <div className="ytp-state">Searching YouTube…</div>
          )}

          {status === "failed" && (
            <div className="ytp-state">
              <p>No video found for this trend.</p>
              <a
                className="ytp-open-yt"
                href={directSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Search on YouTube →
              </a>
            </div>
          )}

          {status === "ready" && item && (
            <>
              <div className="ytp-player">
                <iframe
                  src={embedSrc}
                  title={item.title || trend}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <div className="ytp-meta">
                <div className="ytp-meta-title">{item.title}</div>
                <div className="ytp-meta-channel">
                  {item.channel}
                  {item.viewsText && <span className="ytp-meta-dot"> · </span>}
                  {item.viewsText && <span>{item.viewsText}</span>}
                  {item.publishedText && <span className="ytp-meta-dot"> · </span>}
                  {item.publishedText && <span>{item.publishedText}</span>}
                </div>
              </div>
            </>
          )}
        </div>

        <a
          className="ytp-see-more"
          href={item ? `https://www.youtube.com/watch?v=${item.videoId}` : directSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on YouTube →
        </a>
      </div>

      <style>{`
        .ytp-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: ytp-overlay-in 220ms ease-out both;
        }
        @keyframes ytp-overlay-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        .ytp-card {
          background: #0f0f0f;
          color: #f1f1f1;
          border-radius: 14px;
          width: min(720px, 100%);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
          font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI",
                       "Helvetica Neue", Arial, sans-serif;
          animation: ytp-card-in 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
        }
        @keyframes ytp-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ytp-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: #0f0f0f;
          flex-shrink: 0;
        }
        .ytp-logo {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.3px;
        }
        .ytp-logo-play {
          color: #fff;
          background: #ff0000;
          padding: 2px 8px 2px 10px;
          border-radius: 5px;
          font-size: 14px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 20px;
        }
        .ytp-logo-text { color: #f1f1f1; }
        .ytp-trend-info { flex: 1; min-width: 0; }
        .ytp-trend-label {
          font-size: 11px;
          color: #aaaaaa;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          font-weight: 500;
        }
        .ytp-trend-name {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ytp-close {
          appearance: none;
          border: 0;
          background: transparent;
          font-size: 24px;
          color: #aaaaaa;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ytp-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .ytp-body {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          min-height: 240px;
          display: flex;
          flex-direction: column;
        }
        .ytp-state {
          padding: 60px 24px;
          text-align: center;
          color: #aaaaaa;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          font-size: 14px;
          flex: 1;
          justify-content: center;
        }
        .ytp-open-yt {
          display: inline-block;
          background: #ff0000;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          padding: 10px 18px;
          border-radius: 999px;
          text-decoration: none;
          transition: background 150ms ease;
        }
        .ytp-open-yt:hover { background: #cc0000; }
        .ytp-player {
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000;
        }
        .ytp-player iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }
        .ytp-meta {
          padding: 14px 18px 18px;
        }
        .ytp-meta-title {
          font-size: 16px;
          line-height: 1.35;
          font-weight: 600;
          color: #f1f1f1;
          margin-bottom: 6px;
        }
        .ytp-meta-channel {
          font-size: 13px;
          color: #aaaaaa;
        }
        .ytp-meta-dot { opacity: 0.6; }
        .ytp-see-more {
          padding: 12px 20px;
          text-align: center;
          color: #ff4d4d;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 130ms ease;
          flex-shrink: 0;
        }
        .ytp-see-more:hover { background: rgba(255, 0, 0, 0.08); }
      `}</style>
    </div>
  );
}
