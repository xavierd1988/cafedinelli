"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";
import { useNickname } from "./NicknameContext.jsx";

const MIKE_ID = -1;
const MIKE_MENTION = /(^|[^a-z])mike\b|@mike/i;

export default function Mike() {
  const { nickname } = useNickname();
  const [bubbleHost, setBubbleHost] = useState(null);
  // Thread partagé reçu via le polling (/api/seats inclut .mike). null = pas
  // de conversation active.
  const [thread, setThread] = useState(null);
  // Phase d'interaction locale.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  // Pas de bulle au load. La bulle ne s'ouvre que lorsque tu cliques sur
  // Mike (passage en editing) ou quand un thread arrive.
  const [showGreeting, setShowGreeting] = useState(false);

  const silhouetteRef = useRef(null);
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  const expireTimerRef = useRef(null);

  useEffect(() => {
    setBubbleHost(document.getElementById("bubble-portal-host"));
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Réception du thread via le SeatsPoller global.
  useEffect(() => {
    function handler(e) {
      const incoming = e.detail?.mike;
      if (!incoming || (incoming.expiresAt || 0) < Date.now()) {
        setThread(null);
      } else {
        setThread(incoming);
        setShowGreeting(false); // un thread arrive → on cache le greeting
      }
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  // Auto-fermeture quand le thread expire (60s après le dernier turn).
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

  // Mention "mike" dans un seat-spoke local → on ouvre la bulle et on lance la question.
  useEffect(() => {
    function handler(e) {
      const detail = typeof e.detail === "object" ? e.detail : null;
      if (!detail || detail.source === "remote") return;
      const msg = (detail.message || "").trim();
      if (!msg || !MIKE_MENTION.test(msg)) return;
      ask(msg, detail.nickname);
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(question, asker) {
    if (thinking) return;
    setShowGreeting(false);
    setThinking(true);
    setEditing(false);
    try {
      const res = await fetch("/api/mike-thread", {
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
      await fetch("/api/mike-thread", { method: "DELETE" });
    } catch {
      /* silencieux */
    }
  }

  const hasThread = !!(thread && thread.turns.length > 0);
  const showBubble = editing || thinking || hasThread || showGreeting;
  // On ne montre que le dernier échange : la dernière question d'un user et la
  // dernière réponse de Mike. Plus simple visuellement qu'un thread déroulant.
  const turns = thread?.turns || [];
  const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
  const lastMikeTurn = [...turns].reverse().find((t) => t.role === "mike");

  useEffect(() => {
    if (!showBubble || !bubbleHost) return;
    registerBubble(MIKE_ID, {
      getSeatEl: () => silhouetteRef.current,
      getBubbleEl: () => bubbleRef.current,
      anchor: "top"
    });
    return () => unregisterBubble(MIKE_ID);
    // turns.length comme dépendance : à chaque nouveau turn (question ou
    // réponse), on re-enregistre → nouveau jitter, la bulle change de place.
  }, [showBubble, bubbleHost, turns.length]);

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
          {/* Seul le starter (isYours: true côté serveur, basé IP) peut fermer.
              Sans thread on autorise quand même (greeting local). */}
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
              {/* Question dernière dans une mini-bulle satellite */}
              {lastUserTurn && (
                <div className="mike-question-chip">
                  <em>{lastUserTurn.asker || "anonymous"}</em>
                  <span>{lastUserTurn.message}</span>
                </div>
              )}
              {/* Réponse de Mike : centrale, prominente */}
              <div className="mike-response">
                {thinking && !lastMikeTurn ? (
                  <span className="mike-response-thinking">…</span>
                ) : lastMikeTurn ? (
                  <span>{lastMikeTurn.message}</span>
                ) : null}
                {thinking && lastMikeTurn && (
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
              <span>What can I do for you?</span>
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
              placeholder="Say something to Mike…"
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
