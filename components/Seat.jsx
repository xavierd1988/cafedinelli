"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerBubble, unregisterBubble } from "./bubbleManager.js";
import { useNickname } from "./NicknameContext.jsx";
import { getPersona, subscribePersona } from "../lib/personaStore.js";
import { getMySeat, setMySeat } from "../lib/mySeat.js";
import { trackEvent, trackSeatTaken } from "../lib/analytics.js";

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

      // ★ Réconciliation après refresh : si ce siège porte notre
      // sessionId, on réclame le verrou local. Permet à l'user de
      // continuer à écrire dessus sans clic supplémentaire. La session
      // reste vivante tant que le dernier message est < 2 min (côté
      // serveur, MAX_AGE_MS). Au-delà, le seat expire naturellement
      // et l'user peut prendre un autre siège.
      const mySid = typeof window !== "undefined"
        ? window.sessionStorage.getItem("cafe-session-id")
        : null;
      const isMineBySession = !!(mySid && mine && mine.sessionId === mySid);
      if (isMineBySession && getMySeat() === null) {
        setMySeat(id);
      }

      // Cas "seat disparu du payload" : quelqu'un (autre IP) qui était
      // assis là vient de cliquer sa silhouette → DELETE serveur. Si on
      // affichait sa silhouette en remote, on la nettoie maintenant pour
      // que le siège redevienne libre côté watcher tout de suite.
      // Si la source courante est "local" (= moi), on touche pas — moi
      // j'ai déjà nettoyé via handleSilhouetteClick et lastSeenTimestampRef
      // bloque la ré-application.
      if (!mine) {
        if (lastSourceRef.current === "remote") {
          clearTimeout(messageTimerRef.current);
          clearTimeout(personTimerRef.current);
          setActiveMessage("");
          setActiveNickname("");
          setSeatPersona(null);
          lastSourceRef.current = null;
        }
        return;
      }
      if (typeof mine.timestamp !== "number") return;
      if (mine.timestamp <= lastSeenTimestampRef.current) return;

      lastSeenTimestampRef.current = mine.timestamp;
      // Source = "local" si c'est nous (via sessionId), sinon "remote".
      // Important pour autoriser la ré-écriture après refresh.
      lastSourceRef.current = isMineBySession ? "local" : "remote";
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

  // 3 actions indépendantes, 3 cibles distinctes :
  //   1. handleSeatClick     → click sur le tabouret  → SIT (silhouette + bulle)
  //   2. (bubble onClick)    → click dans la bulle    → OPEN EDITOR (peut taper)
  //   3. handleSilhouetteClick → click sur la silhouette → LEAVE (libère le siège)
  //
  // Chaque action est strictement séparée. Cliquer le tabouret n'ouvre PAS
  // l'éditeur, ne fait QUE faire apparaître la silhouette + bulle vide.
  // Pour parler il faut cliquer la bulle. Pour quitter il faut cliquer la
  // silhouette. Tabourets voisins jamais parasités par mon état.
  function handleSeatClick(e) {
    const mySeatId = getMySeat();
    const isMine = mySeatId === id;
    const isAnotherSeatTaken = mySeatId !== null && !isMine;
    const isRemoteOccupied = showPerson && lastSourceRef.current === "remote";
    trackEvent("counter_seat_click", {
      seat_id: id,
      seat_status: isRemoteOccupied
        ? "remote_occupied"
        : isAnotherSeatTaken
        ? "other_local_seat_active"
        : isMine && showPerson
        ? "own_seat_active"
        : "available"
    });

    // Tabouret occupé par quelqu'un d'autre, ou je suis assis ailleurs : rien.
    if (isAnotherSeatTaken || isRemoteOccupied) {
      e.stopPropagation();
      return;
    }
    // Déjà assis ici : rien (pas de re-toggle, le user clique la silhouette
    // pour quitter).
    if (isMine && showPerson) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
    // SIT : silhouette + bulle apparaissent. Pas d'éditeur ouvert.
    if (!activeNickname) {
      setActiveNickname(nickname || "anonymous");
    }
    setMySeat(id);
    lastSourceRef.current = "local";
    // Reset des timers : on est frais, pas en train d'expirer.
    clearTimeout(messageTimerRef.current);
    clearTimeout(personTimerRef.current);
    setActiveMessage("");
    setEditing(false);
    setDraft("");
  }

  // Click sur la silhouette = LEAVE (libère totalement le siège). Seule la
  // mienne est cliquable (la classe is-remote-occupied bloque le pointer).
  function handleSilhouetteClick(e) {
    e.stopPropagation();
    if (lastSourceRef.current === "remote") return;
    if (getMySeat() !== id) return;

    clearTimeout(messageTimerRef.current);
    clearTimeout(personTimerRef.current);
    setActiveMessage("");
    setActiveNickname("");
    setEditing(false);
    setDraft("");
    setMySeat(null);
    lastSourceRef.current = null;
    // Empêche le prochain poll de re-appliquer mon propre message déjà
    // envoyé (qui reste 2 min côté serveur pour les autres visiteurs).
    lastSeenTimestampRef.current = Date.now();
    // HARD-delete côté serveur — le siège se libère IMMÉDIATEMENT pour
    // tous les autres visiteurs (plus de délai 120s d'expiration). C'est
    // le comportement "fast leave" — fire-and-forget.
    fetch("/api/seats", { method: "DELETE" }).catch(() => {});
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed) {
      // Submit vide : on ferme juste l'éditeur. L'user reste assis (silhouette
      // + bulle vide). Pour quitter le siège, il doit cliquer la silhouette.
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

    // sessionId : identifiant de la session browser (sessionStorage, géré
    // par SeatsPoller). Persiste au refresh, disparait à la fermeture
    // d'onglet → permet le verrou "1 seat par session" côté serveur.
    const sessionId = typeof window !== "undefined"
      ? window.sessionStorage.getItem("cafe-session-id") || ""
      : "";

    // Partage avec les autres clients (les visiteurs qui regardent depuis
    // ailleurs verront le message au prochain poll, sous ~3s).
    fetch("/api/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Envoie le persona courant : chaque client rendra ce siège avec
      // les habits réels de la personne qui parle, pas avec le persona du
      // visiteur qui regarde.
      body: JSON.stringify({ id, nickname: speaker, message: trimmed, persona, sessionId })
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
        if (res.ok) {
          trackEvent("counter_message_submit", {
            seat_id: id,
            source: "counter"
          });
          trackSeatTaken({ seatId: id, source: "counter" });
        }
      })
      .catch(() => {});
  }

  function cancel() {
    // Escape ou click ailleurs : ferme juste l'éditeur. L'user reste assis
    // (silhouette + bulle vide). Pour quitter le siège, click la silhouette.
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

  // Bulle visible dans 3 cas :
  //   - je suis en train d'éditer (input ouvert)
  //   - il y a un message actif (envoyé)
  //   - je suis assis localement sans message encore (placeholder "Click to talk")
  const isMyLocalSeat = getMySeat() === id && lastSourceRef.current === "local";
  // showPerson DOIT être déclaré avant showBubble : ce dernier le lit dans
  // le 3e cas (assis sans message encore). const = temporal dead zone si
  // l'ordre est inversé → ReferenceError au render → Seat crash.
  const showPerson = !!activeNickname;
  const showBubble = editing || !!activeMessage || (isMyLocalSeat && showPerson);

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
      ) : activeMessage ? (
        <>
          {activeNickname && <em>{activeNickname}</em>}
          <span>{activeMessage}</span>
        </>
      ) : (
        // Bulle vide : je suis assis mais je n'ai pas encore parlé. Hint
        // pour cliquer la bulle pour ouvrir l'input.
        <span className="bubble-hint">Say something…</span>
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
          aria-label={lastSourceRef.current === "remote" ? `Seat ${id} occupied` : `Leave seat ${id}`}
          role="button"
          onClick={handleSilhouetteClick}
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
        onClick={handleSeatClick}
        aria-label={
          activeMessage ? `Seat ${id}: ${activeMessage}` : `Take seat ${id}`
        }
      >
        {!showBubble && <span className="take-seat-label">Take a seat</span>}
      </button>
    </div>
  );
}
