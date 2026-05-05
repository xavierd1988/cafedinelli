"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { useNickname } from "./NicknameContext.jsx";
import { getModulePosition } from "../lib/modulePositions.js";
import PersonaSettings from "./PersonaSettings.jsx";

// To Go Counter — bloc principal du visiteur :
//   - Nickname éditable ("my name is …")
//   - Engrenage de réglage persona (gender + wardrobe)
//   - Compteurs : regulars cumulés + online en temps réel
export default function ShelfPanel() {
  const init = getModulePosition("ShelfPanel");
  const ds = useDragScale({
    scaled: true,
    name: "ShelfPanel (To Go Counter)",
    initialOffset: init.offset,
    initialScale: init.scale
  });

  const { nickname, setNickname, loading } = useNickname();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  // Resync brouillon quand le nom serveur arrive.
  useEffect(() => {
    if (!editing) setDraft(nickname);
  }, [nickname, editing]);

  function commitNickname() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== nickname) setNickname(trimmed);
  }
  function cancelNickname() {
    setEditing(false);
    setDraft(nickname);
  }
  function onNicknameKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitNickname();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelNickname();
    }
  }

  // Compteurs partagés (Redis via /api/seats poll).
  const [total, setTotal] = useState(0);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    function handler(e) {
      const r = e.detail?.regulars;
      if (r && typeof r.total === "number") setTotal(r.total);
      if (typeof e.detail?.online === "number") setOnline(e.detail.online);
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  // Bump optimiste au commit local : +1 sur le total tant que le poll serveur
  // n'est pas remonté (le serveur fait foi ensuite).
  useEffect(() => {
    function handler(e) {
      const detail = typeof e.detail === "object" ? e.detail : null;
      if (!detail || detail.source === "remote") return;
      setTotal((t) => t + 1);
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
  }, []);

  return (
    <section
      className={`shelf-panel is-draggable${ds.interacting ? " is-dragging" : ""}`}
      id="to-go-counter"
      aria-labelledby="shelf-title"
      data-file="ShelfPanel.jsx"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`
      }}
      onPointerDown={ds.handleDragStart}
    >
      <div className="shelf-head">
        <h2 id="shelf-title">To Go Counter</h2>
      </div>

      <div className="shelf-stats">
        <div className="shelf-total">
          <span className="shelf-total-num">{total}</span>
          <span className="shelf-total-label">regulars</span>
        </div>
        <div className="shelf-online">
          <span className="shelf-online-dot" aria-hidden="true" />
          <span className="shelf-online-num">{online}</span>
          <span className="shelf-online-label">online</span>
        </div>
      </div>

      {/* Bloc nickname intégré : "my name is …" + engrenage persona,
          placé sous les stats online. La roue est à côté du label. */}
      <div className="shelf-nickname">
        <div className="shelf-nickname-head">
          <PersonaSettings />
          <span className="shelf-nickname-eyebrow">my name is</span>
        </div>
        <div
          className="shelf-nickname-field"
          onClick={() => !editing && setEditing(true)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {editing ? (
            <input
              type="text"
              className="shelf-nickname-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 40))}
              onKeyDown={onNicknameKey}
              onBlur={commitNickname}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="?"
              maxLength={40}
              aria-label="Your nickname"
            />
          ) : (
            <span className={`shelf-nickname-name${nickname ? "" : " is-empty"}`}>
              {nickname || (loading ? "…" : "?")}
            </span>
          )}
        </div>
      </div>

      <span
        className="shelf-resize-handle"
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </section>
  );
}
