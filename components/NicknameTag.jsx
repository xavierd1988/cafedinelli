"use client";

import { useEffect, useState } from "react";
import { useDragScale } from "./useDragScale.js";
import { useNickname } from "./NicknameContext.jsx";
import { getModulePosition } from "../lib/modulePositions.js";
import { useSceneScale } from "./useSceneScale.js";

export default function NicknameTag() {
  const { nickname, setNickname, loading } = useNickname();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const init = getModulePosition("NicknameTag");
  const sceneScale = useSceneScale();
  const ds = useDragScale({
    scaled: false,
    name: "NicknameTag",
    initialOffset: init.offset,
    initialScale: init.scale
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
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x * sceneScale}, ${ds.scale.y * sceneScale}) rotate(-1.4deg)`
      }}
    >
      <header
        className="name-tag-header"
        onPointerDown={ds.handleDragStart}
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
            onPointerDown={(e) => e.stopPropagation()}
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
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </aside>
  );
}
