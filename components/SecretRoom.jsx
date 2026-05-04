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

// Écran mural au fond de la pièce.
function WallScreen() {
  return (
    <div className="sr-screen" aria-hidden="true">
      <div className="sr-screen-frame" />
      <div className="sr-screen-glow" />
      <div className="sr-screen-content">
        <header className="sr-screen-header">
          <span className="sr-screen-pill">LIVE</span>
          <span className="sr-screen-title">TOTALLY NORMAL MEETING</span>
          <span className="sr-screen-pill sr-screen-pill-warn">⚠ DO NOT PANIC</span>
        </header>

        <svg
          className="sr-screen-map"
          viewBox="0 0 400 180"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="srGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(80,180,220,0.18)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="400" height="180" fill="url(#srGlow)" />

          {/* "Continents" très approximatifs en blobs */}
          <path
            d="M 28 64 Q 56 38, 96 56 Q 132 70, 116 96 Q 92 116, 56 110 Q 22 100, 28 64 Z"
            fill="rgba(120,200,210,0.26)"
            stroke="rgba(180,220,230,0.6)"
            strokeWidth="1"
          />
          <path
            d="M 168 38 Q 220 24, 256 50 Q 280 70, 250 92 Q 210 110, 188 92 Q 158 70, 168 38 Z"
            fill="rgba(120,200,210,0.26)"
            stroke="rgba(180,220,230,0.6)"
            strokeWidth="1"
          />
          <path
            d="M 286 76 Q 322 60, 360 86 Q 380 110, 348 130 Q 314 142, 290 122 Q 268 102, 286 76 Z"
            fill="rgba(120,200,210,0.26)"
            stroke="rgba(180,220,230,0.6)"
            strokeWidth="1"
          />
          <path
            d="M 110 130 Q 130 120, 156 134 Q 168 148, 148 156 Q 122 160, 110 148 Z"
            fill="rgba(120,200,210,0.26)"
            stroke="rgba(180,220,230,0.6)"
            strokeWidth="1"
          />

          {/* Lignes rouges en pointillés (trajectoires absurdes) */}
          <path
            d="M 70 80 Q 180 10, 230 70"
            fill="none"
            stroke="#ff3b3b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <path
            d="M 230 70 Q 280 130, 330 100"
            fill="none"
            stroke="#ff3b3b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <path
            d="M 330 100 Q 200 160, 70 80"
            fill="none"
            stroke="#ff3b3b"
            strokeWidth="1.2"
            strokeDasharray="2 4"
            opacity="0.7"
          />

          {/* Cibles / marqueurs */}
          <g className="sr-screen-target" transform="translate(70 80)">
            <circle r="6" fill="none" stroke="#ff3b3b" strokeWidth="1" />
            <circle r="2" fill="#ff3b3b" />
          </g>
          <g className="sr-screen-target" transform="translate(230 70)">
            <circle r="6" fill="none" stroke="#ff3b3b" strokeWidth="1" />
            <circle r="2" fill="#ff3b3b" />
          </g>
          <g className="sr-screen-target" transform="translate(330 100)">
            <circle r="6" fill="none" stroke="#ff3b3b" strokeWidth="1" />
            <circle r="2" fill="#ff3b3b" />
          </g>

          {/* Coordonnées factices */}
          <text x="78" y="76" fill="rgba(255,220,200,0.7)" fontSize="6" fontFamily="monospace">
            48.85N · 2.35E
          </text>
          <text x="240" y="66" fill="rgba(255,220,200,0.7)" fontSize="6" fontFamily="monospace">
            ??.??N · ??.??E
          </text>
          <text x="335" y="100" fill="rgba(255,220,200,0.7)" fontSize="6" fontFamily="monospace">
            MOON-04
          </text>

          {/* Diagramme "missile" totally fictional */}
          <g transform="translate(316 24)">
            <rect x="0" y="0" width="60" height="14" fill="rgba(20,30,40,0.65)" stroke="rgba(255,220,200,0.5)" strokeWidth="0.6" />
            <line x1="0" y1="3" x2="60" y2="3" stroke="rgba(255,200,170,0.35)" strokeWidth="0.4" />
            <line x1="0" y1="11" x2="60" y2="11" stroke="rgba(255,200,170,0.35)" strokeWidth="0.4" />
            <text x="3" y="10" fill="#ffd6c8" fontSize="6" fontFamily="monospace">
              NUCLEAR-ISH SKETCH
            </text>
          </g>
        </svg>

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
        <WallScreen />
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
