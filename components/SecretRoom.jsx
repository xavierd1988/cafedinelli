"use client";

import { useEffect, useRef, useState } from "react";
import { useNickname } from "./NicknameContext.jsx";
import { getPersona, subscribePersona } from "../lib/personaStore.js";

// =============================================================================
// SECRET ROOM — salle de réunion clandestine satirique
// =============================================================================
// Atmosphère : sombre, cinématique, fumée, lampes chaudes au-dessus de la
// table. Style parodie de société secrète (genre Dr Strangelove + Men in
// Black + groupe d'oligarques surréalistes), JAMAIS politique ou offensant.
//
// Layout (pourcentages dans .sr-stage qui a un aspect ratio fixe) :
//   - Grand écran mural au fond (avec carte du monde absurde, "PLAN B")
//   - Table ovale en bois centrée, vue en perspective légère
//   - 10 sièges autour de la table : 5 occupés par archétypes, 5 vides
//   - Le user peut cliquer un siège vide → s'assoit, bulle "I probably
//     shouldn't be here."
//
// Tout le composant tient dans une seule section. Aucune image, que du CSS
// + un peu de SVG pour la carte. Hover tooltips sur les personnages.
// =============================================================================

// 7 sièges vraiment collés au rebord ovale. Le plateau a son centre
// visuel à (50%, 52.5%) avec rx≈35% et ry≈21% (après le rotateX(34deg) +
// translate(-50%,-45%)). On parcourt l'ellipse de 180° à 0° en passant
// par 90° (bas). Les chaises hugent le rim. Personne au top (occupé par
// l'écran mural).
const CHARACTERS = [
  {
    id: "reptile",
    name: "The Diplomat",
    tooltip: "Definitely not from here.",
    x: 20, y: 63           // 150° — mi-gauche, contre le rebord
  },
  {
    id: "agent",
    name: "Agent K-9",
    tooltip: "Definitely not watching you.",
    x: 33, y: 70           // 120° — bas-gauche
  },
  {
    id: "tycoon",
    name: "The Visionary",
    tooltip: "Has 14 backup planets.",
    x: 50, y: 73           // 90° — pied de table (face caméra)
  },
  {
    id: "mystic",
    name: "Old Sage",
    tooltip: "Predicted this meeting in 1642.",
    x: 67, y: 70           // 60° — bas-droite
  },
  {
    id: "popstar",
    name: "The Performer",
    tooltip: "Hee-hee. Plan B is on.",
    x: 80, y: 63           // 30° — mi-droite
  }
];

// Architecturalement ce sont les 7e et 8e siège du café (le bar a les
// IDs 1-6, la salle secrète prolonge avec 7-8). Le rendu reste séparé
// dans la modale, mais la logique POST/release/seat-swap est identique.
const EMPTY_SEATS = [
  { id: 7, x: 15, y: 52 },   // 180° — pointe gauche du fer à cheval
  { id: 8, x: 85, y: 52 }    // 0°   — pointe droite du fer à cheval
];

// Tooltip cinématique sur un siège.
function Tooltip({ children }) {
  return <span className="sr-tooltip">{children}</span>;
}

// Items dispatchés aléatoirement partout sur la table. Liste écrite
// "à la main" avec rotations variées pour que ça ait l'air vraiment posé
// par un groupe de gens en pleine réunion (rien d'aligné). Les positions
// couvrent toute la surface, pas juste le bas. Format compact : un array
// d'objets {kind, x, y, rot, label?, variant?} qu'on map en JSX.
const TABLE_ITEMS = [
  // 2 laptops (centre de la table, face caméra)
  { kind: "laptop", x: 40, y: 60, face: "front" },
  { kind: "laptop", x: 60, y: 60, face: "front" },

  // Lampes chaudes
  { kind: "lamp", x: 28, y: 36 },
  { kind: "lamp", x: 72, y: 36 },

  // Papiers éparpillés (mix blanc + jaune-craft, rotations aléatoires)
  { kind: "paper", x: 17, y: 22, rot: -14 },
  { kind: "paper", x: 32, y: 28, rot:   8, variant: "alt" },
  { kind: "paper", x: 52, y: 22, rot:  -3 },
  { kind: "paper", x: 78, y: 30, rot:  16, variant: "alt" },
  { kind: "paper", x: 24, y: 76, rot:  22 },
  { kind: "paper", x: 70, y: 78, rot: -10, variant: "alt" },

  // Dossiers manille
  { kind: "folder", x: 18, y: 48, rot: -8,  label: "PHASE 7" },
  { kind: "folder", x: 82, y: 48, rot:  6,  label: "CLASSIFIED", variant: "red" },

  // Mugs (cafés répartis aléatoirement)
  { kind: "mug", x: 36, y: 46 },
  { kind: "mug", x: 50, y: 50 },
  { kind: "mug", x: 64, y: 46 },
  { kind: "mug", x: 22, y: 60 },
  { kind: "mug", x: 78, y: 60 },

  // Stylos / crayons (petites bâtons inclinés)
  { kind: "pen", x: 44, y: 28, rot:  35 },
  { kind: "pen", x: 60, y: 32, rot: -28, variant: "blue" },
  { kind: "pen", x: 30, y: 62, rot:  72 },
  { kind: "pen", x: 70, y: 70, rot: -55, variant: "blue" },

  // Sticky notes (petits carrés colorés)
  { kind: "sticky", x: 12, y: 44, rot: -6,  variant: "yellow" },
  { kind: "sticky", x: 88, y: 32, rot:  9,  variant: "pink" },
  { kind: "sticky", x: 46, y: 76, rot: -12, variant: "yellow" },

  // Téléphone (smartphone sombre)
  { kind: "phone", x: 26, y: 32, rot: 14 },
  { kind: "phone", x: 76, y: 22, rot: -8 },

  // Verre de whisky / eau
  { kind: "glass", x: 40, y: 76 },
  { kind: "glass", x: 56, y: 78 },

  // Cendrier avec cig
  { kind: "ashtray", x: 84, y: 70 }
];

// Render dispatcher.
function TableItem({ item }) {
  const transform = item.rot != null
    ? `translate(-50%, -50%) rotate(${item.rot}deg)`
    : undefined;
  const style = { left: `${item.x}%`, top: `${item.y}%` };
  if (transform) style.transform = transform;
  switch (item.kind) {
    case "laptop":
      return (
        <div
          className={`sr-prop sr-laptop sr-laptop-face-${item.face || "front"}`}
          style={style}
        />
      );
    case "lamp":
      return <div className="sr-prop sr-lamp" style={style} />;
    case "paper":
      return (
        <div
          className={`sr-prop sr-paper${item.variant === "alt" ? " sr-paper-alt" : ""}`}
          style={style}
        />
      );
    case "folder":
      return (
        <div
          className={`sr-prop sr-folder${item.variant === "red" ? " sr-folder-red" : ""}`}
          style={style}
        >
          <span className="sr-folder-tag">{item.label}</span>
        </div>
      );
    case "mug":
      return <div className="sr-prop sr-mug" style={style} />;
    case "pen":
      return (
        <div
          className={`sr-prop sr-pen${item.variant === "blue" ? " sr-pen-blue" : ""}`}
          style={style}
        />
      );
    case "sticky":
      return (
        <div
          className={`sr-prop sr-sticky sr-sticky-${item.variant || "yellow"}`}
          style={style}
        />
      );
    case "phone":
      return <div className="sr-prop sr-phone" style={style} />;
    case "glass":
      return <div className="sr-prop sr-glass" style={style} />;
    case "ashtray":
      return (
        <div className="sr-prop sr-ashtray" style={style}>
          <span className="sr-ashtray-cig" />
        </div>
      );
    default:
      return null;
  }
}

function TableProps() {
  return (
    <>
      {TABLE_ITEMS.map((item, i) => (
        <TableItem key={i} item={item} />
      ))}
    </>
  );
}

// Le visage : structure riche (oreilles, sourcils, cils, yeux avec iris +
// reflet, joues, nez, lèvres séparées, menton, philtrum). Chaque archétype
// peut overrider chaque trait via CSS (cacher sous lunettes, recolorer, etc.).
function Face() {
  return (
    <>
      <span className="sr-face-ear sr-face-ear-l" />
      <span className="sr-face-ear sr-face-ear-r" />
      <span className="sr-face-cheek sr-face-cheek-l" />
      <span className="sr-face-cheek sr-face-cheek-r" />
      <span className="sr-face-brow sr-face-brow-l" />
      <span className="sr-face-brow sr-face-brow-r" />
      <span className="sr-face-eye sr-face-eye-l">
        <span className="sr-face-lash" />
        <span className="sr-face-iris" />
        <span className="sr-face-pupil" />
        <span className="sr-face-glint" />
      </span>
      <span className="sr-face-eye sr-face-eye-r">
        <span className="sr-face-lash" />
        <span className="sr-face-iris" />
        <span className="sr-face-pupil" />
        <span className="sr-face-glint" />
      </span>
      <span className="sr-face-nose" />
      <span className="sr-face-philtrum" />
      <span className="sr-face-lip sr-face-lip-upper" />
      <span className="sr-face-lip sr-face-lip-lower" />
      <span className="sr-face-chin" />
      <span className="sr-face-shadow" />
    </>
  );
}

// Personnage : archétype rendu en couches CSS empilées de bas en haut :
//   sr-char-legs       → trapèze des jambes, descend bien sous le torse
//   sr-char-torso      → buste/épaules, recouvre le haut des jambes pour
//                        masquer la jonction (chevauchement = pas de gap)
//   sr-char-neck       → connecteur peau
//   sr-char-head       → visage + accessoires d'archétype
//   sr-char-hands      → mains posées sur la table
function Character({ archetype }) {
  return (
    <div className={`sr-char sr-char-${archetype}`}>
      <div className="sr-char-back" />
      <div className="sr-char-legs" />
      <div className="sr-char-shoulders" />
      <div className="sr-char-neck" />
      <div className="sr-char-head">
        <Face />
        {/* Accessoires archétype par-dessus le visage */}
        <span className="sr-acc sr-acc-1" />
        <span className="sr-acc sr-acc-2" />
        <span className="sr-acc sr-acc-3" />
      </div>
      <div className="sr-char-hands" />
    </div>
  );
}

// Avatar du user assis : silhouette neutre cream avec un visage générique.
function UserAvatar() {
  return (
    <div className="sr-char sr-char-user">
      <div className="sr-char-back" />
      <div className="sr-char-legs" />
      <div className="sr-char-shoulders" />
      <div className="sr-char-neck" />
      <div className="sr-char-head">
        <Face />
      </div>
    </div>
  );
}

// Configuration de la vidéo qui joue sur l'écran mural.
// `segments` = 10 morceaux du clip — à chaque ouverture de la pièce ET à
// chaque fin de segment, on en pioche un au hasard (en évitant de
// re-jouer le même 2 fois d'affilée). Modifie les start/end (en
// secondes) pour ajuster les passages.
const VIDEO = {
  id: "APq749_MvRA",
  segments: [
    { start: 8,   end: 26  },
    { start: 32,  end: 52  },
    { start: 60,  end: 80  },
    { start: 95,  end: 118 },
    { start: 130, end: 150 },
    { start: 165, end: 185 },
    { start: 200, end: 222 },
    { start: 240, end: 262 },
    { start: 280, end: 300 },
    { start: 320, end: 342 }
  ]
};

function pickRandomSegment(prev) {
  const list = VIDEO.segments;
  if (list.length <= 1) return list[0];
  let next = list[Math.floor(Math.random() * list.length)];
  // Évite de re-piocher le même segment juste après.
  let safety = 0;
  while (prev && next === prev && safety < 6) {
    next = list[Math.floor(Math.random() * list.length)];
    safety += 1;
  }
  return next;
}

function buildVideoSrc({ muted, segment }) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    playsinline: "1",
    start: String(segment.start),
    end: String(segment.end)
  });
  return `https://www.youtube.com/embed/${VIDEO.id}?${params.toString()}`;
}

// Écran mural au fond de la pièce. La vidéo n'est mountée que quand
// `open === true` → fermer la pièce démonte l'iframe et coupe l'audio.
//
// Cycle des segments : à l'ouverture, un segment random est choisi.
// Quand sa durée s'écoule (via setTimeout aligné sur end-start),
// on en pioche un nouveau et l'iframe est remontée → enchaînement
// random sans intervention.
function WallScreen({ open }) {
  const [unmuted, setUnmuted] = useState(false);
  const [segment, setSegment] = useState(() => pickRandomSegment());

  // Reset audio + nouveau segment random à chaque ouverture.
  useEffect(() => {
    if (!open) {
      setUnmuted(false);
      return;
    }
    setSegment((prev) => pickRandomSegment(prev));
  }, [open]);

  // Quand le segment courant arrive à terme, on en pioche un autre.
  // setTimeout calé sur (end - start) secondes + petite marge.
  useEffect(() => {
    if (!open || !segment) return;
    const ms = Math.max(2000, (segment.end - segment.start) * 1000 + 250);
    const id = setTimeout(() => {
      setSegment((prev) => pickRandomSegment(prev));
    }, ms);
    return () => clearTimeout(id);
  }, [open, segment]);

  return (
    <div className="sr-screen">
      <div className="sr-screen-frame" />
      <div className="sr-screen-glow" />
      <div className="sr-screen-content">
        <header className="sr-screen-header">
          <span className="sr-screen-pill">LIVE</span>
          <span className="sr-screen-title">TOTALLY NORMAL MEETING</span>
          <span className="sr-screen-pill sr-screen-pill-warn">⚠ DO NOT PANIC</span>
        </header>

        {open && segment && (
          <>
            <iframe
              key={`${segment.start}-${segment.end}-${unmuted ? "a" : "m"}`}
              className="sr-screen-video"
              src={buildVideoSrc({ muted: !unmuted, segment })}
              title="Secret meeting briefing"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            {!unmuted && (
              <button
                type="button"
                className="sr-screen-unmute"
                onClick={() => setUnmuted(true)}
                aria-label="Unmute video"
                title="Unmute"
              >
                🔊 click to unmute
              </button>
            )}
          </>
        )}

        <footer className="sr-screen-footer">
          <span className="sr-screen-tag">PHASE 7</span>
          <span className="sr-screen-tag">MOON TUNNEL</span>
          <span className="sr-screen-tag sr-screen-tag-blink">PLAN B</span>
          <span className="sr-screen-tag">NUCLEAR-ISH CONCEPT</span>
        </footer>
      </div>
    </div>
  );
}

export default function SecretRoom() {
  const [open, setOpen] = useState(false);
  const [userSeatId, setUserSeatId] = useState(null);
  // Sièges que J'AI moi-même quittés cette session — leur entrée existe
  // encore en Redis (released) et arrivera dans remoteSeats, mais on
  // veut pas que JE me voie comme un autre visiteur à mon ancienne
  // place. Pattern miroir de lastSeenTimestampRef côté bar.
  const [myPastSeats, setMyPastSeats] = useState(() => new Set());
  // Message local : ce que TOI tu as écrit en t'asseyant. Affiché dans
  // ta bulle au-dessus du siège, persisté serveur via POST.
  const [userMessage, setUserMessage] = useState("");
  // Phase d'édition (input ouvert pour taper un message)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  // Sièges remote partagés via Redis. Reçus via SeatsPoller.
  // Format : [{ seatId, nickname, message, persona, timestamp }]
  const [remoteSeats, setRemoteSeats] = useState([]);

  // Nickname global (partagé avec le bar) + persona (pour l'avatar).
  const { nickname } = useNickname();
  const [persona, setPersonaState] = useState(getPersona());
  useEffect(() => {
    setPersonaState(getPersona());
    return subscribePersona(setPersonaState);
  }, []);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("secret-room-open", onOpen);
    return () => window.removeEventListener("secret-room-open", onOpen);
  }, []);

  // Diffuse l'état (ouvert/fermé) à toute l'app — RadioCabinet écoute pour
  // mettre FIP en pause à l'entrée (et reprendre à la sortie si elle
  // jouait). Le silence renforce l'ambiance de la salle secrète.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(
        new CustomEvent("secret-room-state", { detail: { open } })
      );
    } catch {
      /* dispatch silencieusement ignoré */
    }
  }, [open]);

  // Sync des sièges secret-room via le poll global (3s).
  useEffect(() => {
    function handler(e) {
      const arr = Array.isArray(e.detail?.secretRoom) ? e.detail.secretRoom : [];
      setRemoteSeats(arr);
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape" && !editing) {
        setOpen(false);
        setUserSeatId(null);
        setUserMessage("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing]);

  if (!open) return null;

  function close() {
    setOpen(false);
    setUserSeatId(null);
    setUserMessage("");
    setEditing(false);
    // Libère le siège côté serveur si on en occupait un.
    fetch("/api/secret-room", { method: "DELETE" }).catch(() => {});
  }

  // ===== Pattern strict bar — 3 clics indépendants =====
  // 1. Click siège vide → SIT (silhouette + bulle vide, PAS d'éditeur)
  // 2. Click bulle      → OPEN EDITOR (le user peut taper)
  // 3. Click silhouette → LEAVE local (libère le siège côté UI)
  // Cliquer un AUTRE siège pendant que je suis assis : bloqué (comme bar).
  function takeSeat(id, e) {
    e.stopPropagation();
    // Déjà à un autre siège → blocked (le user doit cliquer sa
    // silhouette pour partir avant de prendre un nouveau siège).
    if (userSeatId !== null && userSeatId !== id) return;
    // Déjà ici → no-op (pas de re-toggle, on clique la silhouette pour partir).
    if (userSeatId === id) return;
    setUserSeatId(id);
    setEditing(false);
    setDraft("");
  }

  // Click bulle → OPEN EDITOR (input pour taper un message).
  function openEditor(e) {
    e?.stopPropagation();
    if (userSeatId === null) return;
    setDraft(userMessage || "");
    setEditing(true);
  }

  // Click silhouette = LEAVE. Local clear + HARD-delete serveur pour
  // que TOUS les autres visiteurs voient le siège libre tout de suite
  // (pas de délai 120s).
  function leaveSeat(e) {
    e?.stopPropagation();
    if (userSeatId !== null) {
      setMyPastSeats((prev) => new Set(prev).add(userSeatId));
    }
    setUserSeatId(null);
    setUserMessage("");
    setEditing(false);
    setDraft("");
    // Fire-and-forget DELETE — le siège se libère immédiatement côté
    // serveur, le prochain SSE tick le push à tous les clients.
    fetch("/api/secret-room", { method: "DELETE" }).catch(() => {});
  }

  function commitMessage() {
    const trimmed = draft.trim();
    setEditing(false);
    setUserMessage(trimmed);
    setDraft("");
    if (!userSeatId) return;
    // sessionId pour le verrou "1 seat par session" côté serveur.
    const sessionId = typeof window !== "undefined"
      ? window.sessionStorage.getItem("cafe-session-id") || ""
      : "";
    // POST live au serveur — visible par les autres visiteurs au prochain poll.
    fetch("/api/secret-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seatId: userSeatId,
        nickname,
        message: trimmed,
        persona,
        sessionId
      })
    }).catch(() => { /* silencieux */ });
  }

  function cancelMessage() {
    setEditing(false);
    setDraft("");
  }

  function onMessageKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitMessage();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelMessage();
    }
  }

  return (
    <div
      className="secret-room"
      data-file="SecretRoom.jsx"
      onClick={(e) => {
        // Clic sur le fond (pas sur un siège ni sur la table) → on ferme.
        if (e.target === e.currentTarget) close();
      }}
    >
      <button
        type="button"
        className="secret-room-close"
        onClick={close}
        aria-label="Leave the meeting"
        title="Leave (Esc)"
      >×</button>

      <div className="sr-stage">
        {/* Mur du fond avec écran encastré */}
        <div className="sr-wall-back" />
        <WallScreen open={open} />
        <div className="sr-floor" />
        <div className="sr-haze sr-haze-1" />
        <div className="sr-haze sr-haze-2" />

        {/* Table ovale en bois (rim + plateau + reflets) */}
        <div className="sr-table">
          <div className="sr-table-shadow" />
          <div className="sr-table-rim" />
          <div className="sr-tabletop">
            <div className="sr-tabletop-grain" />
            <div className="sr-tabletop-shine" />
            <TableProps />
          </div>
        </div>

        {/* Personnages (chaise + avatar) */}
        {CHARACTERS.map((c) => (
          <div
            key={c.id}
            className="sr-seat sr-seat-occupied"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            <div className="sr-chair">
              <div className="sr-chair-back" />
              <div className="sr-chair-cushion" />
            </div>
            <Character archetype={c.id} />
            <Tooltip>
              <strong>{c.name}</strong>
              <span>{c.tooltip}</span>
            </Tooltip>
          </div>
        ))}

        {/* Sièges visiteurs cliquables — pattern aligné sur le bar :
            click → input message → POST → bulle live partagée via poll.
            Si un autre visiteur (autre IP) est assis, on affiche son
            avatar + nickname + message. */}
        {EMPTY_SEATS.map((s) => {
          // s.id est numérique (7/8), r.seatId revient stringifié depuis
          // Redis ("7"/"8"). On stringify les 2 côtés pour être robuste.
          const sidStr = String(s.id);
          const isUser = String(userSeatId) === sidStr;
          // Pattern aligné sur le bar : les entrées released restent
          // visibles aux AUTRES visiteurs (silhouette + message lisibles
          // jusqu'à expiration 120s). Mais pour MOI, mes propres
          // anciennes entrées sont filtrées via myPastSeats — je dois
          // pas me voir moi-même comme un autre visiteur à mon ancienne
          // place. Pattern miroir du lastSeenTimestampRef du bar.
          const isPastMine = myPastSeats.has(s.id);
          const remote = !isPastMine && remoteSeats.find(
            (r) => String(r.seatId) === sidStr && !isUser
          );
          // Bulle visible dans 3 cas (mêmes que le bar) :
          //  1. j'édite (input ouvert)
          //  2. j'ai un message actif
          //  3. je suis assis sans encore parler (bulle vide + hint)
          const showUserBubble = isUser && (editing || !!userMessage || userSeatId === s.id);
          return (
            <div
              key={s.id}
              className={
                `sr-seat sr-seat-empty` +
                (isUser ? " is-user" : "") +
                (remote ? " is-occupied-remote" : "")
              }
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              {/* Le bouton = chaise + avatar/hint. Click handler change
                  selon l'état :
                    empty (ni user ni remote) → takeSeat (SIT)
                    isUser                    → leaveSeat (LEAVE local)
                    remote                    → désactivé */}
              <button
                type="button"
                className="sr-seat-button"
                onClick={(e) => {
                  if (remote) return;
                  if (isUser) leaveSeat(e);
                  else takeSeat(s.id, e);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!!remote}
                aria-label={
                  isUser
                    ? "Click to leave this seat"
                    : remote
                    ? `${remote.nickname} is here`
                    : "Sit here"
                }
              >
                <div className="sr-chair">
                  <div className="sr-chair-back" />
                  <div className="sr-chair-cushion" />
                </div>
                {isUser ? (
                  <UserAvatar />
                ) : remote ? (
                  <UserAvatar />
                ) : (
                  <span className="sr-empty-hint">Sit here</span>
                )}
              </button>

              {/* Ma bulle (au-dessus du siège, click = OPEN EDITOR) */}
              {showUserBubble && editing && (
                <div
                  className="sr-seat-bubble sr-seat-bubble-input"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 140))}
                    onKeyDown={onMessageKey}
                    onBlur={commitMessage}
                    placeholder="say something…"
                    maxLength={140}
                    aria-label="Your secret room message"
                  />
                </div>
              )}
              {showUserBubble && !editing && userMessage && (
                <span
                  className="sr-seat-bubble"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={openEditor}
                  role="button"
                >
                  <em>{nickname || "anonymous"}</em>
                  <span>{userMessage}</span>
                </span>
              )}
              {showUserBubble && !editing && !userMessage && (
                <span
                  className="sr-seat-bubble sr-seat-bubble-empty"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={openEditor}
                  role="button"
                >
                  say something…
                </span>
              )}
              {remote && remote.message && (
                <span className="sr-seat-bubble">
                  <em>{remote.nickname || "anonymous"}</em>
                  <span>{remote.message}</span>
                </span>
              )}
              {remote && !remote.message && (
                <span className="sr-seat-bubble sr-seat-bubble-name">
                  {remote.nickname || "anonymous"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="secret-room-hint">
        click outside the table or press Esc to leave
      </p>
    </div>
  );
}
