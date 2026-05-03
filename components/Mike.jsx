"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";
import { useNickname } from "./NicknameContext.jsx";

// Id réservé hors de la plage des seats (1..6) pour Mike dans bubbleManager.
const MIKE_ID = -1;
const RESPONSE_VISIBLE_MS = 22000;
const THINKING_VISIBLE_MS = 30000; // garde-fou si la requête traîne

// Détecte une mention "mike" / "@mike" dans un message d'un seat.
const MIKE_MENTION = /(^|[^a-z])mike\b|@mike/i;

export default function Mike() {
  const { nickname } = useNickname();
  const [bubbleHost, setBubbleHost] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | thinking | speaking | error
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const silhouetteRef = useRef(null);
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  const hideTimerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setBubbleHost(document.getElementById("bubble-portal-host"));
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Mike écoute les seats : si un message le mentionne, il répond.
  useEffect(() => {
    function handler(e) {
      const detail = typeof e.detail === "object" ? e.detail : null;
      if (!detail) return;
      const msg = (detail.message || "").trim();
      if (!msg || !MIKE_MENTION.test(msg)) return;
      ask(msg, detail.nickname);
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le panneau "ask a question to Mike" déclenche l'ouverture de son input.
  useEffect(() => {
    function handler() {
      if (inFlightRef.current) return;
      setEditing(true);
      setDraft("");
    }
    window.addEventListener("open-mike-input", handler);
    return () => window.removeEventListener("open-mike-input", handler);
  }, []);

  function scheduleHide(ms) {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPhase("idle");
      setText("");
    }, ms);
  }

  async function ask(question, speaker) {
    if (inFlightRef.current) return; // une question à la fois
    inFlightRef.current = true;
    clearTimeout(hideTimerRef.current);
    setPhase("thinking");
    setText("");
    scheduleHide(THINKING_VISIBLE_MS);

    try {
      const res = await fetch("/api/mike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          speaker: speaker || nickname || ""
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.answer) {
        const fallback = data?.error === "slow down"
          ? "…laisse-moi finir mon café."
          : "…";
        setPhase("error");
        setText(fallback);
      } else {
        setPhase("speaking");
        setText(data.answer);
      }
    } catch {
      setPhase("error");
      setText("…");
    } finally {
      inFlightRef.current = false;
      scheduleHide(RESPONSE_VISIBLE_MS);
    }
  }

  function handleSilhouetteClick(e) {
    e.stopPropagation();
    if (phase === "thinking") return;
    setEditing(true);
    setDraft("");
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed) return;
    ask(trimmed, nickname);
  }

  function cancel() {
    setEditing(false);
    setDraft("");
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

  const showBubble =
    editing || phase === "thinking" || phase === "speaking" || phase === "error";

  // Enregistre auprès du bubbleManager pour bénéficier du placement
  // anti-collision et de la couche portail au-dessus de tout.
  useEffect(() => {
    if (!showBubble || !bubbleHost) return;
    registerBubble(MIKE_ID, {
      getSeatEl: () => silhouetteRef.current,
      getBubbleEl: () => bubbleRef.current,
      anchor: "top"
    });
    return () => unregisterBubble(MIKE_ID);
  }, [showBubble, bubbleHost]);

  return (
    <>
      <div
        ref={silhouetteRef}
        className="inside-silhouette silhouette-b mike-silhouette"
        onClick={handleSilhouetteClick}
        title="Click to talk to Mike"
        data-file="Mike.jsx"
      />
      {bubbleHost && showBubble && createPortal(
        <span
          ref={bubbleRef}
          className="speech-bubble bubble-shape-3 mike-bubble"
          onClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="bubble-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              onBlur={commit}
              placeholder="Demande à Mike…"
              maxLength={200}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <em>mike</em>
              <span>{phase === "thinking" ? "…" : text}</span>
            </>
          )}
        </span>,
        bubbleHost
      )}
    </>
  );
}
