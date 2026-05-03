"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";
import { useNickname } from "./NicknameContext.jsx";

const MESSAGE_MS = 15000; // bulle conversation : 15s
const PERSON_MS = 60000;  // personnage assis : 1 minute

export default function Seat({ seat }) {
  const { id, x, seatY, footY } = seat;
  const { nickname } = useNickname();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeMessage, setActiveMessage] = useState(seat.message || "");
  const [activeNickname, setActiveNickname] = useState(seat.nickname || "");
  const [isLatest, setIsLatest] = useState(false);
  const [bubbleHost, setBubbleHost] = useState(null);
  const inputRef = useRef(null);
  const seatRef = useRef(null);
  const bubbleRef = useRef(null);
  const messageTimerRef = useRef(null);
  const personTimerRef = useRef(null);

  // Récupère l'élément hôte du portail des bulles (rendu par CafeScene).
  useEffect(() => {
    setBubbleHost(document.getElementById("bubble-portal-host"));
  }, []);

  // Écoute l'événement "seat-spoke" pour savoir si un autre seat a parlé après nous.
  useEffect(() => {
    function handler(e) {
      const eid = typeof e.detail === "object" ? e.detail.id : e.detail;
      setIsLatest(eid === id);
    }
    window.addEventListener("seat-spoke", handler);
    return () => window.removeEventListener("seat-spoke", handler);
  }, [id]);

  // Si le seat a un message seedé : message disparait à 15s, personnage à 60s
  useEffect(() => {
    if (seat.message) {
      messageTimerRef.current = setTimeout(() => setActiveMessage(""), MESSAGE_MS);
      personTimerRef.current = setTimeout(() => setActiveNickname(""), PERSON_MS);
    }
    return () => {
      clearTimeout(messageTimerRef.current);
      clearTimeout(personTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleClick(e) {
    if (editing || activeMessage) return;
    e.stopPropagation();
    setEditing(true);
    setDraft("");
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed) return;

    const speaker = nickname || "anonymous";
    setActiveMessage(trimmed);
    setActiveNickname(speaker);

    window.dispatchEvent(
      new CustomEvent("seat-spoke", {
        detail: { id, nickname: speaker, message: trimmed, timestamp: Date.now() }
      })
    );

    clearTimeout(messageTimerRef.current);
    clearTimeout(personTimerRef.current);
    messageTimerRef.current = setTimeout(() => setActiveMessage(""), MESSAGE_MS);
    personTimerRef.current = setTimeout(() => setActiveNickname(""), PERSON_MS);
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

  const showBubble = editing || !!activeMessage;
  const showPerson = !!activeNickname;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("seat-state", { detail: { id, occupied: showPerson } })
    );
  }, [id, showPerson]);

  // Enregistre la bulle auprès du manager qui orchestre la position et
  // l'évitement de collision via une seule boucle RAF.
  useEffect(() => {
    if (!showBubble || !bubbleHost) return;
    registerBubble(id, {
      getSeatEl: () => seatRef.current,
      getBubbleEl: () => bubbleRef.current
    });
    return () => unregisterBubble(id);
  }, [id, showBubble, bubbleHost]);

  const bubbleNode = showBubble ? (
    <span
      ref={bubbleRef}
      className={`speech-bubble bubble-shape-${(id % 5) + 1}${isLatest ? " is-latest-bubble" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="bubble-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 140))}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder="Say something…"
          maxLength={140}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          {activeNickname && <em>{activeNickname}</em>}
          <span>{activeMessage}</span>
        </>
      )}
    </span>
  ) : null;

  return (
    <button
      ref={seatRef}
      type="button"
      data-file="Seat.jsx"
      className={`seat ${showPerson ? "is-occupied" : "is-empty"}${isLatest ? " is-latest" : ""}`}
      style={{
        left: `${x - 58}px`,
        top: `${seatY - 132}px`,
        "--stool-height": `${footY - seatY}px`
      }}
      aria-label={
        activeMessage ? `Seat ${id}: ${activeMessage}` : `Take seat ${id}`
      }
      onClick={handleClick}
    >
      {bubbleHost && bubbleNode && createPortal(bubbleNode, bubbleHost)}
      {showPerson && (
        <span className="seat-person" aria-hidden="true">
          <span className="person-head" />
          <span className="person-shoulders" />
        </span>
      )}
      {!showBubble && <span className="take-seat-label">Take a seat</span>}
      <span className="stool" aria-hidden="true">
        <span className="stool-top" />
        <span className="stool-stem" />
        <span className="stool-foot" />
      </span>
    </button>
  );
}
