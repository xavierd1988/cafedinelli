"use client";

import { useEffect, useState } from "react";

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

const EMPTY_SEATS = [
  { id: "e1", x: 15, y: 52 },   // 180° — pointe gauche du fer à cheval
  { id: "e2", x: 85, y: 52 }    // 0°   — pointe droite du fer à cheval
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

// Personnage : archétype rendu en couches CSS (head + accessoires).
function Character({ archetype }) {
  return (
    <div className={`sr-char sr-char-${archetype}`}>
      <div className="sr-char-back" />
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

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("secret-room-open", onOpen);
    return () => window.removeEventListener("secret-room-open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setUserSeatId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  function close() {
    setOpen(false);
    setUserSeatId(null);
  }

  function takeSeat(id, e) {
    e.stopPropagation();
    setUserSeatId(id);
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

        {/* Sièges vides cliquables */}
        {EMPTY_SEATS.map((s) => {
          const isUser = userSeatId === s.id;
          return (
            <button
              type="button"
              key={s.id}
              className={`sr-seat sr-seat-empty${isUser ? " is-user" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              onClick={(e) => takeSeat(s.id, e)}
              aria-label={isUser ? "Your seat" : "Sit here"}
            >
              <div className="sr-chair">
                <div className="sr-chair-back" />
                <div className="sr-chair-cushion" />
              </div>
              {isUser ? (
                <>
                  <UserAvatar />
                  <span className="sr-user-bubble">
                    I probably shouldn’t be here.
                  </span>
                </>
              ) : (
                <span className="sr-empty-hint">Sit here</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="secret-room-hint">
        click outside the table or press Esc to leave
      </p>
    </div>
  );
}
