"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";
import { useNickname } from "./NicknameContext.jsx";
import { getPersona, subscribePersona } from "../lib/personaStore.js";
import { getMySeat, setMySeat } from "../lib/mySeat.js";

// Le seat est verrouillé 2 minutes (côté serveur ET client). Pendant tout
// ce temps la bulle reste visible — elle ne disparaît qu'au départ de la
// personne (= expiration des 2 min).
const PERSON_MS = 120000;
const MESSAGE_MS = PERSON_MS;

export default function Seat({ seat }) {
  const { id, x, seatY, footY } = seat;
  const { nickname } = useNickname();
  const [persona, setPersonaState] = useState(getPersona());
  useEffect(() => {
    setPersonaState(getPersona());
    return subscribePersona(setPersonaState);
  }, []);
  // Persona de la personne qui est ASSISE à ce siège (ce que tous les autres
  // visiteurs doivent voir, pas le persona local). null = pas encore reçu →
  // on tombe sur le persona local en attendant (utile quand on est en train
  // de cliquer le tabouret avant que le serveur ait notre message).
  const [seatPersona, setSeatPersona] = useState(seat.persona || null);
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
  // Timestamp du dernier message qu'on a appliqué (local ou remote) — sert
  // à ignorer les ré-applications du même message lors du polling.
  const lastSeenTimestampRef = useRef(0);
  // Source du dernier message appliqué : "local" si c'est moi, "remote" si
  // c'est un autre IP. Permet de bloquer les clics sur le tabouret de quelqu'un d'autre.
  const lastSourceRef = useRef(null);
  const editingRef = useRef(false);
  useEffect(() => { editingRef.current = editing; }, [editing]);

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

  // Écoute les updates remote (polling de SeatsPoller). Si un message plus
  // récent que le dernier qu'on a appliqué arrive pour notre seat, on l'affiche
  // avec des timers calés sur l'âge réel du message (pour qu'il disparaisse
  // au bon moment, pas 15s après son arrivée tardive).
  useEffect(() => {
    function handler(e) {
      if (editingRef.current) return; // ne pas écraser l'input en cours
      const payload = e.detail || {};
      const seats = Array.isArray(payload.seats)
        ? payload.seats
        : Array.isArray(payload)
        ? payload
        : [];
      const mine = seats.find((s) => Number(s.id) === id);
      if (!mine || typeof mine.timestamp !== "number") return;
      if (mine.timestamp <= lastSeenTimestampRef.current) return;

      lastSeenTimestampRef.current = mine.timestamp;
      lastSourceRef.current = "remote";
      const ageMs = Date.now() - mine.timestamp;
      const messageRemaining = MESSAGE_MS - ageMs;
      const personRemaining = PERSON_MS - ageMs;

      clearTimeout(messageTimerRef.current);
      clearTimeout(personTimerRef.current);

      // On adopte le persona du visiteur qui est assis ici (peut être null
      // si l'entrée serveur est ancienne et n'avait pas le champ — dans ce
      // cas on garde le précédent qu'on a, ou on tombe sur DEFAULT).
      if (mine.persona && typeof mine.persona === "object") {
        setSeatPersona(mine.persona);
      }

      setActiveNickname(mine.nickname);
      if (messageRemaining > 0) {
        setActiveMessage(mine.message);
        messageTimerRef.current = setTimeout(() => setActiveMessage(""), messageRemaining);
        // Notifie ShelfPanel + Mike comme si l'événement local s'était produit.
        window.dispatchEvent(
          new CustomEvent("seat-spoke", {
            detail: {
              id,
              nickname: mine.nickname,
              message: mine.message,
              timestamp: mine.timestamp,
              source: "remote"
            }
          })
        );
      } else {
        setActiveMessage("");
      }
      if (personRemaining > 0) {
        personTimerRef.current = setTimeout(() => setActiveNickname(""), personRemaining);
      } else {
        setActiveNickname("");
      }
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
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

  // Quand le siège se vide (personne plus assise → activeNickname = ""),
  // on oublie le persona qu'on avait stocké pour ce siège. Ça évite que
  // la prochaine personne qui s'assoit hérite des habits du précédent.
  useEffect(() => {
    if (!activeNickname) setSeatPersona(null);
  }, [activeNickname]);

  function handleClick(e) {
    // Si je suis déjà assis ailleurs ou ici-occupé-par-un-autre : rien.
    const mySeatId = getMySeat();
    const isMine = mySeatId === id;
    const isAnotherSeatTaken = mySeatId !== null && !isMine;
    const isRemoteOccupied = showPerson && lastSourceRef.current === "remote";
    if (isAnotherSeatTaken || isRemoteOccupied) {
      e.stopPropagation();
      return;
    }
    if (editing) return;
    e.stopPropagation();
    clearTimeout(messageTimerRef.current);
    setActiveMessage("");
    setEditing(true);
    setDraft("");
    // Silhouette apparaît immédiatement au clic sur le tabouret (avant
    // même qu'un message soit envoyé). Si l'utilisateur annule, on la
    // retire dans cancel()/commit() vide.
    if (!activeNickname) {
      setActiveNickname(nickname || "anonymous");
    }
    // Réserve mySeat dès le clic pour bloquer le clic sur les autres
    // tabourets pendant la saisie. Sans ça, getMySeat() reste null
    // jusqu'au commit() et l'user pouvait cliquer ailleurs entre-temps.
    // Si l'user annule sans envoyer, cancel() libère ce slot.
    setMySeat(id);
    lastSourceRef.current = "local";
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed) {
      // Aucun message → on retire le silhouette qu'on avait fait apparaître
      // au clic, sauf si une silhouette préexistait (message déjà actif).
      if (!activeMessage) setActiveNickname("");
      return;
    }

    const speaker = nickname || "anonymous";
    const ts = Date.now();
    // On marque la dernière timestamp vue à maintenant pour que le polling
    // ne re-applique pas notre propre message dans 1-2s.
    lastSeenTimestampRef.current = ts;
    lastSourceRef.current = "local";
    setMySeat(id);
    setActiveMessage(trimmed);
    setActiveNickname(speaker);
    // Mon siège m'affiche avec MON persona local — feedback immédiat,
    // pas besoin d'attendre le prochain poll.
    setSeatPersona(persona);

    window.dispatchEvent(
      new CustomEvent("seat-spoke", {
        detail: { id, nickname: speaker, message: trimmed, timestamp: ts, source: "local" }
      })
    );

    clearTimeout(messageTimerRef.current);
    clearTimeout(personTimerRef.current);
    messageTimerRef.current = setTimeout(() => setActiveMessage(""), MESSAGE_MS);
    personTimerRef.current = setTimeout(() => setActiveNickname(""), PERSON_MS);

    // Partage avec les autres clients (les visiteurs qui regardent depuis
    // ailleurs verront le message au prochain poll, sous ~3s).
    fetch("/api/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Envoie le persona courant : chaque client rendra ce siège avec
      // les habits réels de la personne qui parle, pas avec le persona du
      // visiteur qui regarde.
      body: JSON.stringify({ id, nickname: speaker, message: trimmed, persona })
    })
      .then(async (res) => {
        if (res.status === 409) {
          // Cette IP est déjà à un autre siège — on annule l'UI locale et on
          // libère mySeat pour que les autres tabourets restent "non-mine".
          clearTimeout(messageTimerRef.current);
          clearTimeout(personTimerRef.current);
          setActiveMessage("");
          setActiveNickname("");
          if (getMySeat() === id) setMySeat(null);
          lastSourceRef.current = null;
          return;
        }
        // En cas de succès on récupère le timestamp serveur et on l'inscrit
        // dans lastSeenTimestampRef. Sinon le prochain poll re-applique notre
        // propre message comme "remote" (server.ts > client.ts par quelques ms).
        const data = await res.json().catch(() => null);
        if (data?.entry?.timestamp) {
          lastSeenTimestampRef.current = data.entry.timestamp;
        }
      })
      .catch(() => {});
  }

  function cancel() {
    setEditing(false);
    setDraft("");
    // Idem cancel : retirer la silhouette si elle n'avait pas de message réel.
    if (!activeMessage) {
      setActiveNickname("");
      // Pas de message envoyé → on libère le slot mySeat réservé par
      // handleClick, pour que l'user puisse cliquer un autre tabouret.
      if (getMySeat() === id) setMySeat(null);
      lastSourceRef.current = null;
    }
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

  // Quand mon propre seat se vide, on libère mySeat pour que je puisse à
  // nouveau cliquer ailleurs si je veux. Ne touche pas mySeat si quelqu'un
  // d'autre est assis ici (lastSourceRef === "remote").
  useEffect(() => {
    if (!showPerson && lastSourceRef.current === "local") {
      if (getMySeat() === id) setMySeat(null);
      lastSourceRef.current = null;
    }
  }, [showPerson, id]);

  // Enregistre la bulle auprès du manager qui orchestre la position et
  // l'évitement de collision via une seule boucle RAF. On re-enregistre à
  // chaque nouveau message pour que le manager regénère un jitter aléatoire :
  // la bulle change de place à chaque prise de parole.
  useEffect(() => {
    if (!showBubble || !bubbleHost) return;
    registerBubble(id, {
      getSeatEl: () => seatRef.current,
      getBubbleEl: () => bubbleRef.current
    });
    return () => unregisterBubble(id);
  }, [id, showBubble, bubbleHost, activeMessage]);

  const bubbleNode = showBubble ? (
    <span
      ref={bubbleRef}
      className={`speech-bubble bubble-shape-${(id % 5) + 1}${isLatest ? " is-latest-bubble" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        // Bulle d'un autre IP : ne rien faire.
        if (lastSourceRef.current === "remote") return;
        if (editing) return;
        clearTimeout(messageTimerRef.current);
        setActiveMessage("");
        setEditing(true);
        setDraft("");
      }}
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
          onPointerDown={(e) => e.stopPropagation()}
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
    <div
      ref={seatRef}
      data-file="Seat.jsx"
      className={`seat-cell ${showPerson ? "is-occupied" : "is-empty"}${isLatest ? " is-latest" : ""}`}
      style={{
        left: `${x - 58}px`,
        top: `${seatY - 132}px`,
        "--stool-height": `${footY - seatY}px`
      }}
    >
      {bubbleHost && bubbleNode && createPortal(bubbleNode, bubbleHost)}
      {showPerson && (() => {
        // Persona réellement utilisé pour rendre la silhouette assise :
        // - seatPersona si on a une donnée serveur (le persona DE LA PERSONNE
        //   qui est assise ici, peu importe qui regarde)
        // - sinon le persona local en fallback (utile pendant l'édition
        //   avant qu'un message ne soit posté)
        const p = seatPersona || persona;
        return (
        <span
          className={`seat-person${lastSourceRef.current === "remote" ? " is-remote-occupied" : " seat-person-clickable"} persona-${p.gender} wig-${p.gender}-${p.wig} jacket-${p.gender}-${p.jacket} pants-${p.gender}-${p.pants} shoes-${p.gender}-${p.shoes}`}
          aria-label={lastSourceRef.current === "remote" ? `Seat ${id} occupied` : `Talk as person at seat ${id}`}
          role="button"
          onClick={handleClick}
        >
          <span className="person-wig" />
          <span className="person-head" />
          <span className="person-shoulders" />
          <span className="person-pants" />
          <span className="person-shoes person-shoes-l" />
          <span className="person-shoes person-shoes-r" />
        </span>
        );
      })()}
      <span className="stool" aria-hidden="true">
        <span className="stool-top" />
        <span className="stool-stem" />
        <span className="stool-foot" />
      </span>
      {/* Le bouton .seat ne couvre plus que la zone du tabouret pour ne pas
          bloquer les clics sur les éléments derrière (Mike notamment). */}
      <button
        type="button"
        className="seat"
        onClick={handleClick}
        aria-label={
          activeMessage ? `Seat ${id}: ${activeMessage}` : `Take seat ${id}`
        }
      >
        {!showBubble && <span className="take-seat-label">Take a seat</span>}
      </button>
    </div>
  );
}
