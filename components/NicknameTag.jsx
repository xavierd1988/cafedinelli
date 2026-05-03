"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { useNickname } from "./NicknameContext.jsx";

export default function NicknameTag() {
  const { nickname, setNickname, loading } = useNickname();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const ds = useDragScale({
    scaled: false,
    name: "NicknameTag",
    initialOffset: { x: 0, y: 0 },
    initialScale: { x: 1, y: 1 }
  });

  // Resync brouillon quand le nom serveur arrive.
  useEffect(() => {
    if (!editing) setDraft(nickname);
  }, [nickname, editing]);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== nickname) setNickname(trimmed);
  }

  function cancel() {
    setEditing(false);
    setDraft(nickname);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  return (
    <aside
      className={`name-tag is-draggable${ds.interacting ? " is-dragging" : ""}`}
      data-file="NicknameTag.jsx"
      aria-label="Set your name"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y}) rotate(-1.4deg)`
      }}
    >
      <header
        className="name-tag-header"
        onMouseDown={ds.handleDragStart}
      >
        <span className="name-tag-sub">my name is</span>
      </header>
      <div
        className="name-tag-field"
        onClick={() => !editing && setEditing(true)}
      >
        {editing ? (
          <input
            type="text"
            className="name-tag-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 40))}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="?"
            maxLength={40}
            aria-label="Your nickname"
          />
        ) : (
          <span className={`name-tag-name${nickname ? "" : " is-empty"}`}>
            {nickname || (loading ? "…" : "?")}
          </span>
        )}
      </div>
      <span
        className="name-tag-resize"
        onMouseDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </aside>
  );
}
