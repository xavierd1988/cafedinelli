"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";
import { useNickname } from "./NicknameContext.jsx";

// Le Gatekeeper occupe la silhouette-c (côté droit, près de la porte rouge).
// Même mécanique que Mike : thread partagé via /api/eye-thread, visible par
// tous les visiteurs en ligne via le SeatsPoller.
//
// Différence clé : il garde la porte. Si "the eye" apparaît dans n'importe
// quel turn (user ou gatekeeper), on dispatch "cafe-door-unlock" pour ouvrir
// la porte 5s côté CafeDoor.

const GATEKEEPER_ID = -3;
const PASSWORD_RE = /\bthe\s*eye\b/i;

export default function Gatekeeper() {
  const { nickname } = useNickname();
  const [bubbleHost, setBubbleHost] = useState(null);
  const [thread, setThread] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  // Bulle "How can I help you?" affichée tant qu'on n'a pas commencé à
  // taper ni reçu de thread. Ouverte au clic sur la silhouette.
  const [showGreeting, setShowGreeting] = useState(false);

  const silhouetteRef = useRef(null);
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  const expireTimerRef = useRef(null);
  // Pour ne dispatcher qu'une seule fois par thread quand "the eye" apparaît.
  const unlockedThreadRef = useRef(null);

  useEffect(() => {
    setBubbleHost(document.getElementById("bubble-portal-host"));
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Réception du thread eye via le SeatsPoller global.
  useEffect(() => {
    function handler(e) {
      const incoming = e.detail?.eye;
      if (!incoming || (incoming.expiresAt || 0) < Date.now()) {
        setThread(null);
      } else {
        setThread(incoming);
        setShowGreeting(false);
      }
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  // Auto-fermeture quand le thread expire.
  useEffect(() => {
    clearTimeout(expireTimerRef.current);
    if (!thread) return;
    const remaining = thread.expiresAt - Date.now();
    if (remaining <= 0) {
      setThread(null);
      setEditing(false);
      return;
    }
    expireTimerRef.current = setTimeout(() => {
      setThread(null);
      setEditing(false);
    }, remaining);
    return () => clearTimeout(expireTimerRef.current);
  }, [thread]);

  // Détection du password dans le thread (peu importe que ce soit le user
  // ou le gatekeeper qui le tape) → on broadcast "cafe-door-unlock" une
  // seule fois par thread.
  useEffect(() => {
    if (!thread || !thread.turns?.length) return;
    if (unlockedThreadRef.current === thread.id) return;
    const hasPassword = thread.turns.some((t) => PASSWORD_RE.test(t.message || ""));
    if (hasPassword) {
      unlockedThreadRef.current = thread.id;
      try {
        window.dispatchEvent(new CustomEvent("cafe-door-unlock"));
      } catch {
        // SSR / sandbox : ignore.
      }
    }
  }, [thread]);

  async function ask(question, asker) {
    if (thinking) return;
    setShowGreeting(false);
    setThinking(true);
    setEditing(false);
    try {
      const res = await fetch("/api/eye-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, asker: asker || nickname || "" })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.thread) setThread(data.thread);
    } catch {
      /* silencieux */
    }
    setThinking(false);
  }

  function handleSilhouetteClick(e) {
    e.stopPropagation();
    // Premier clic : on montre le greeting + on ouvre l'input. Deuxième clic
    // alors qu'un thread est en cours : on rouvre l'input pour répondre.
    if (!thread || thread.turns.length === 0) {
      setShowGreeting(true);
    }
    setEditing(true);
    setDraft("");
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed) return;
    setDraft("");
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

  async function closeThread(e) {
    e.stopPropagation();
    setEditing(false);
    setShowGreeting(false);
    setThread(null);
    try {
      await fetch("/api/eye-thread", { method: "DELETE" });
    } catch {
      /* silencieux */
    }
  }

  const hasThread = !!(thread && thread.turns.length > 0);
  const showBubble = editing || thinking || hasThread || showGreeting;
  const turns = thread?.turns || [];
  const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
  const lastReplyTurn = [...turns].reverse().find((t) => t.role === "gatekeeper");

  useEffect(() => {
    if (!showBubble || !bubbleHost) return;
    registerBubble(GATEKEEPER_ID, {
      getSeatEl: () => silhouetteRef.current,
      getBubbleEl: () => bubbleRef.current,
      anchor: "top"
    });
    return () => unregisterBubble(GATEKEEPER_ID);
  }, [showBubble, bubbleHost, turns.length]);

  return (
    <>
      <div
        ref={silhouetteRef}
        className="inside-silhouette silhouette-c gatekeeper-silhouette interactive-silhouette"
        onClick={handleSilhouetteClick}
        title="Click to talk to the gatekeeper"
        data-file="Gatekeeper.jsx"
      />
      {bubbleHost && showBubble && createPortal(
        <span
          ref={bubbleRef}
          className="speech-bubble bubble-shape-3 mike-bubble silhouette-mini-bubble gatekeeper-bubble"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Seul le starter peut fermer (sécurité côté serveur). */}
          {(!hasThread || thread?.isYours) && (
            <button
              type="button"
              className="mike-bubble-close"
              onClick={closeThread}
              aria-label="Close conversation"
              title="Close"
            >×</button>
          )}
          {hasThread ? (
            <>
              {lastUserTurn && (
                <div className="mike-question-chip">
                  <em>{lastUserTurn.asker || "anonymous"}</em>
                  <span>{lastUserTurn.message}</span>
                </div>
              )}
              <div className="mike-response">
                {thinking && !lastReplyTurn ? (
                  <span className="mike-response-thinking">…</span>
                ) : lastReplyTurn ? (
                  <span>{lastReplyTurn.message}</span>
                ) : null}
                {thinking && lastReplyTurn && (
                  <span className="mike-response-thinking"> …</span>
                )}
              </div>
            </>
          ) : thinking ? (
            <div className="mike-response">
              <span className="mike-response-thinking">…</span>
            </div>
          ) : showGreeting ? (
            <div className="mike-response">
              <span>How can I help you?</span>
            </div>
          ) : null}
          {editing ? (
            <input
              ref={inputRef}
              className="bubble-input mike-bubble-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              onBlur={commit}
              placeholder=""
              maxLength={200}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              className="mike-bubble-reply"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
                setDraft("");
              }}
            >
              + reply
            </button>
          )}
        </span>,
        bubbleHost
      )}
    </>
  );
}
