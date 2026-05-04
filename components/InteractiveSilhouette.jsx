"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";

// Silhouette intérieure qui réagit au clic. Deux modes :
// - mode="message" → simple bulle qui affiche "message" (ex : "I'm busy working")
// - mode="password" → input password ; si le mot de passe correct est tapé,
//   onUnlock() est appelé (sinon refus message court).
// Disparaît après ~5s.

const VISIBLE_MS = 5000;

export default function InteractiveSilhouette({
  className,
  bubbleId,
  mode = "message",
  message = "",
  password,
  unlockMessage = "welcome",
  rejectMessage = "wrong"
}) {
  const [bubbleHost, setBubbleHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState(null); // {kind: "ok"|"reject", text}

  const silhouetteRef = useRef(null);
  const bubbleRef = useRef(null);
  const inputRef = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    setBubbleHost(document.getElementById("bubble-portal-host"));
  }, []);

  useEffect(() => {
    if (open && mode === "password") inputRef.current?.focus();
  }, [open, mode]);

  function scheduleClose(ms = VISIBLE_MS) {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setOpen(false);
      setFeedback(null);
      setDraft("");
    }, ms);
  }

  function handleClick(e) {
    e.stopPropagation();
    setOpen(true);
    setFeedback(null);
    setDraft("");
    // Bulle visible 5s puis disparaît, peu importe le mode (message ou
    // password). Pour password : si tu n'as pas tapé/validé en 5s, la
    // bulle se ferme et tu dois recliquer pour réessayer.
    scheduleClose();
  }

  function submitPassword(e) {
    e?.preventDefault();
    if (mode !== "password") return;
    const tried = draft.trim().toLowerCase();
    if (tried === (password || "").toLowerCase()) {
      setFeedback({ kind: "ok", text: unlockMessage });
      // La porte est la seule chose qui réagit au bon password : on broadcast
      // un event que CafeDoor écoute pour s'ouvrir.
      try {
        window.dispatchEvent(new CustomEvent("cafe-door-unlock"));
      } catch {
        // SSR / sandbox : ignore.
      }
    } else {
      setFeedback({ kind: "reject", text: rejectMessage });
    }
    setDraft("");
    scheduleClose();
  }

  function close(e) {
    e?.stopPropagation();
    clearTimeout(hideTimerRef.current);
    setOpen(false);
    setFeedback(null);
    setDraft("");
  }

  useEffect(() => {
    if (!open || !bubbleHost) return;
    registerBubble(bubbleId, {
      getSeatEl: () => silhouetteRef.current,
      getBubbleEl: () => bubbleRef.current,
      anchor: "top"
    });
    return () => unregisterBubble(bubbleId);
  }, [open, bubbleHost, bubbleId, feedback]);

  return (
    <>
      <div
        ref={silhouetteRef}
        className={`inside-silhouette ${className} interactive-silhouette`}
        onClick={handleClick}
        title="Click"
      />
      {bubbleHost && open && createPortal(
        <span
          ref={bubbleRef}
          className="speech-bubble bubble-shape-3 mike-bubble silhouette-mini-bubble"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="mike-bubble-close"
            onClick={close}
            aria-label="Close"
            title="Close"
          >×</button>
          {mode === "message" ? (
            <div className="mike-response">
              <span>{message}</span>
            </div>
          ) : (
            <>
              {feedback ? (
                <div className="mike-response">
                  <span style={{ color: feedback.kind === "ok" ? "#1a7a3a" : "#7a1a1a" }}>
                    {feedback.text}
                  </span>
                </div>
              ) : (
                <div className="mike-response">
                  <span>password?</span>
                </div>
              )}
              {!feedback && (
                <form onSubmit={submitPassword}>
                  <input
                    ref={inputRef}
                    className="bubble-input mike-bubble-input"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 40))}
                    onKeyDown={(e) => { if (e.key === "Escape") close(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="…"
                    maxLength={40}
                  />
                </form>
              )}
            </>
          )}
        </span>,
        bubbleHost
      )}
    </>
  );
}
