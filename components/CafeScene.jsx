import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isMuted, setMuted, subscribeMuted } from "../lib/sounds.js";
import { getModulePosition } from "../lib/modulePositions.js";
import CafeSign from "./CafeSign.jsx";
import Counter from "./Counter.jsx";
import Mike from "./Mike.jsx";
import PaperPanel from "./PaperPanel.jsx";
import ShelfPanel from "./ShelfPanel.jsx";
import { useDraggable } from "./useDraggable.js";
import { useDragScale } from "./useDragScale.js";

function CafeChildResize({ onPointerDown }) {
  return (
    <span
      className="cafe-resize-handle"
      onPointerDown={onPointerDown}
      title="Resize (drag vertical)"
      aria-label="Resize"
    >⤡</span>
  );
}

function CafeDragKnob({ onPointerDown, dragging, label }) {
  return (
    <span
      className={`cafe-drag-knob${dragging ? " is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      title={`Drag ${label}`}
      aria-label={`Drag ${label}`}
    >✥</span>
  );
}

function useSceneScale() {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    function updateScale() {
      setScale(Math.min(window.innerWidth / 1600, window.innerHeight / 900));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return scale;
}

function DistantSkyline() {
  const lights = [
    { left: 110, top: 92, w: 8, h: 12, opacity: 0.42 },
    { left: 142, top: 84, w: 7, h: 10, opacity: 0.28 },
    { left: 168, top: 102, w: 9, h: 14, opacity: 0.5 },
    { left: 198, top: 76, w: 8, h: 12, opacity: 0.34 },
    { left: 232, top: 110, w: 7, h: 10, opacity: 0.24 },
    { left: 268, top: 96, w: 9, h: 12, opacity: 0.46 },
    { left: 308, top: 82, w: 8, h: 12, opacity: 0.32 },
    { left: 342, top: 118, w: 7, h: 10, opacity: 0.22 },
    { left: 378, top: 90, w: 8, h: 12, opacity: 0.4 },
    { left: 416, top: 104, w: 9, h: 14, opacity: 0.5 },
    { left: 454, top: 86, w: 7, h: 10, opacity: 0.26 },
    { left: 488, top: 122, w: 8, h: 12, opacity: 0.44 },
    { left: 524, top: 98, w: 9, h: 12, opacity: 0.36 },
    { left: 562, top: 80, w: 7, h: 10, opacity: 0.28 },
    { left: 598, top: 116, w: 8, h: 12, opacity: 0.48 },
    { left: 638, top: 92, w: 9, h: 14, opacity: 0.4 },
    { left: 678, top: 108, w: 7, h: 10, opacity: 0.24 },
    { left: 716, top: 84, w: 8, h: 12, opacity: 0.34 }
  ];
  return (
    <section className="distant-skyline" aria-hidden="true" data-file="CafeScene.jsx::DistantSkyline">
      <div className="distant-rooftop distant-rooftop-a" />
      <div className="distant-rooftop distant-rooftop-b" />
      <div className="distant-rooftop distant-rooftop-c" />
      {lights.map((light, i) => (
        <span
          key={i}
          className="distant-light"
          style={{
            left: `${light.left}px`,
            top: `${light.top}px`,
            width: `${light.w}px`,
            height: `${light.h}px`,
            opacity: light.opacity
          }}
        />
      ))}
    </section>
  );
}

// Étage supérieur du café : SAME wrapper que le cafe-glass (cafe-cluster-bg)
// donc soumis au même scale du wrapper. 2 étages de fenêtres alignés sur
// les meneaux 2, 4, 6, 8 du cafe-glass (en coords pré-scale).
function CafeUpperFloor() {
  const init = getModulePosition("CafeUpperFloor");
  const ds = useDragScale({
    scaled: true,
    name: "CafeScene.jsx::CafeUpperFloor",
    initialOffset: init.offset,
    initialScale: init.scale
  });
  const lefts = [117, 337, 557, 777];
  const floors = [
    { top: 30,  height: 168, lit: [true, false, true, false] },
    { top: 230, height: 168, lit: [false, true, false, true] },
    { top: 410, height: 138, lit: [true, false, true, false] }
  ];
  return (
    <section
      className={`cafe-upper${ds.interacting ? " is-dragging" : ""}`}
      data-file="CafeScene.jsx::CafeUpperFloor"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`,
        transformOrigin: "center center"
      }}
    >
      <CafeDragKnob onPointerDown={ds.handleDragStart} dragging={ds.interacting} label="CafeUpperFloor" />
      <div className="cafe-upper-cornice" />
      {floors.flatMap((floor, fi) =>
        lefts.map((left, wi) => (
          <span
            key={`${fi}-${wi}`}
            className={`cafe-upper-window${floor.lit[wi] ? " is-lit" : ""}`}
            style={{
              left: `${left}px`,
              top: `${floor.top}px`,
              height: `${floor.height}px`
            }}
          />
        ))
      )}
      <CafeChildResize onPointerDown={ds.handleResizeStart} />
    </section>
  );
}

// === LeftBuilding ============================================================
// Bâtiment unique côté gauche : façade homogène allant du haut de l'image
// (top:0) jusqu'au sol (top:760). Composé de haut en bas :
//   - 3 étages de fenêtres résidentielles (lb-floor)
//   - une ligne de toiture intérieure (lb-string-course)
//   - la vitrine du rez-de-chaussée (lb-storefront)
//   - 2 modules vitrines décoratives (lb-module)
//   - un socle (lb-base)
// =============================================================================

// 17 fenêtres par étage, espacement 94px, couvrent toute la largeur (1600).
const WINDOW_LEFTS = [
  40, 134, 228, 322, 416, 510, 604, 698, 792,
  886, 980, 1074, 1168, 1262, 1356, 1450, 1544
];

const buildingFloors = [
  { top: 30,  windows: WINDOW_LEFTS },
  { top: 130, windows: WINDOW_LEFTS },
  { top: 230, windows: WINDOW_LEFTS }
];

// pattern damier alterné par étage
const litMap = [
  WINDOW_LEFTS.map((_, i) => i % 2 === 0),
  WINDOW_LEFTS.map((_, i) => i % 2 === 1),
  WINDOW_LEFTS.map((_, i) => i % 2 === 0)
];

function LeftBuilding() {
  return (
    <section className="left-building" aria-hidden="true" data-file="CafeScene.jsx::LeftBuilding">
      {buildingFloors.map((floor, fi) => (
        <div className="lb-floor" key={fi} style={{ top: `${floor.top}px` }}>
          {floor.windows.map((x, wi) => (
            <span
              key={wi}
              className={`lb-window${litMap[fi][wi] ? " is-lit" : ""}`}
              style={{ left: `${x}px` }}
            />
          ))}
        </div>
      ))}
      <div className="lb-string-course" />
      <div className="lb-storefront">
        <span className="lb-pane lb-pane-1" />
        <span className="lb-pane lb-pane-2" />
        <span className="lb-pane lb-pane-3" />
        <span className="lb-pane lb-pane-4" />
        <span className="lb-pane lb-pane-5" />
        <span className="lb-pane lb-pane-6" />
        <span className="lb-door" />
      </div>
      <div className="lb-shop lb-shop-a">
        <div className="lb-shop-awning" />
        <div className="lb-shop-sign">GROCERY</div>
        <div className="lb-shop-window">
          <span className="lb-shop-glow" />
          <span className="lb-shop-shelf lb-shop-shelf-top" />
          <span className="lb-shop-shelf lb-shop-shelf-mid" />
        </div>
        <div className="lb-shop-base" />
      </div>
      <div className="lb-shop lb-shop-b">
        <div className="lb-shop-awning lb-shop-awning-alt" />
        <div className="lb-shop-sign">BAKERY</div>
        <div className="lb-shop-window">
          <span className="lb-shop-glow" />
          <span className="lb-shop-shelf lb-shop-shelf-top" />
          <span className="lb-shop-shelf lb-shop-shelf-mid" />
        </div>
        <div className="lb-shop-base" />
      </div>
      <div className="lb-base" />
    </section>
  );
}

function RadioCabinet() {
  const init = getModulePosition("RadioCabinet");
  const ds = useDragScale({
    scaled: true,
    name: "RadioCabinet (CafeScene.jsx)",
    initialOffset: init.offset,
    initialScale: init.scale
  });
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState(null);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
    return subscribeMuted(setMutedState);
  }, []);

  // Diffuse l'état radio à toute l'app
  function broadcast(payload) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("radio-state", { detail: payload }));
  }

  // Récupère les métadonnées FIP en cours (titre + artiste)
  function fetchTrack() {
    fetch("https://api.radiofrance.fr/livemeta/pull/7")
      .then((r) => r.json())
      .then((data) => {
        const steps = data?.steps || {};
        const live = data?.levels?.[0]?.items?.[0];
        const step = live ? steps[live] : null;
        if (step?.title) {
          const next = { title: step.title, artist: step.authors || step.titreAlbum || "" };
          setTrack(next);
          broadcast({ playing: true, track: next });
        }
      })
      .catch(() => {
        /* CORS / offline → silencieux, on garde juste "FIP" */
      });
  }

  // Setup audio src + listeners une seule fois (pas dans le JSX = pas de reset au render)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!a.src) a.src = "https://icecast.radiofrance.fr/fip-hifi.aac";
    function onPlay() { setPlaying(true); }
    function onPause() { setPlaying(false); }
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // Poll quand la radio joue (toutes les 30s)
  useEffect(() => {
    if (!playing) return;
    fetchTrack();
    const id = setInterval(fetchTrack, 30 * 1000);
    return () => clearInterval(id);
  }, [playing]);

  function togglePlay(e) {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      setTrack(null);
      broadcast({ playing: false, track: null });
    } else {
      audioRef.current
        .play()
        .then(() => {
          setPlaying(true);
          broadcast({ playing: true, track: null });
        })
        .catch(() => {});
    }
  }

  return (
    <div
      className={`radio-cabinet${ds.interacting ? " is-dragging" : ""}${playing ? " is-playing" : ""}`}
      data-file="CafeScene.jsx::RadioCabinet"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`,
        transformOrigin: "center center"
      }}
      onPointerDown={ds.handleDragStart}
    >
      {/* Audio FIP (Radio France) — src + listeners attachés via ref pour
          ne pas être ré-instanciés à chaque render (sinon le stream se coupe). */}
      <audio ref={audioRef} preload="none" />

      {/* Meuble en bois (base) */}
      <div className="rc-cabinet">
        <span className="rc-cabinet-shelf" />
        <span className="rc-cabinet-handle" />
      </div>
      {/* Vieille radio posée dessus */}
      <div className="rc-body">
        <div className="rc-display">
          <span className="rc-display-scale">88 · 92 · 96 · 100 · 104 · 108</span>
          <span className="rc-display-needle" />
          <span className="rc-display-station">{playing ? "FIP" : ""}</span>
        </div>
        <div className="rc-grille">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="rc-grille-bar" />
          ))}
        </div>
        <div className="rc-dials">
          <span className="rc-dial" />
          <span className="rc-dial" />
        </div>
      </div>

      {/* Bouton play/pause toujours visible */}
      <button
        type="button"
        className={`rc-play-btn${playing ? " is-playing" : ""}`}
        onClick={togglePlay}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={playing ? "Pause FIP" : "Play FIP"}
        title={playing ? "Pause" : "Play FIP — Radio France"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      {/* Mute du son d'ambiance (chimes seats + Mike), à côté du play */}
      <button
        type="button"
        className={`rc-mute-btn${muted ? " is-muted" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setMuted(!muted);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={muted ? "Unmute café sounds" : "Mute café sounds"}
        title={muted ? "Bar sound off" : "Mute bar sound"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <span
        className="cafe-resize-handle"
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}

function CashRegister() {
  const init = getModulePosition("CashRegister");
  const ds = useDragScale({
    scaled: true,
    name: "CashRegister (CafeScene.jsx)",
    initialOffset: init.offset,
    initialScale: init.scale
  });

  return (
    <div
      className={`cash-register${ds.interacting ? " is-dragging" : ""}`}
      data-file="CafeScene.jsx::CashRegister"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`,
        transformOrigin: "center center"
      }}
      onPointerDown={ds.handleDragStart}
    >
      {/* Meuble en bois (base) */}
      <div className="cr-cabinet">
        <span className="cr-cabinet-shelf" />
        <span className="cr-cabinet-handle" />
      </div>
      {/* Caisse enregistreuse posée dessus */}
      <div className="cr-body">
        <div className="cr-display">
          <span className="cr-display-text">$ 4.50</span>
        </div>
        <div className="cr-keys">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="cr-key" />
          ))}
        </div>
        <div className="cr-drawer" />
      </div>
      <span
        className="cafe-resize-handle"
        onPointerDown={ds.handleResizeStart}
        title="Resize"
        aria-label="Resize"
      >⤡</span>
    </div>
  );
}

function CornerCurve() {
  const init = getModulePosition("CornerCurve");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: true,
    name: "CornerCurve (CafeScene.jsx)",
    initialOffset: init.offset
  });
  const [scale, setScale] = useState(init.scale);
  const [resizing, setResizing] = useState(false);

  function handleResizeStart(e) {
    if (process.env.NODE_ENV !== "development") return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startScale = { ...scale };
    setResizing(true);

    function move(ev) {
      const delta = (ev.clientY - startY) / 200;
      const factor = Math.max(0.2, Math.min(3, 1 + delta));
      setScale({
        x: Math.max(0.1, startScale.x * factor),
        y: Math.max(0.1, startScale.y * factor)
      });
    }
    function up() {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const interacting = dragging || resizing;

  return (
    <div
      className={`corner-curve is-draggable${interacting ? " is-dragging" : ""}`}
      data-file="CafeScene.jsx::CornerCurve"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale.x}, ${scale.y})`
      }}
      onPointerDown={handleDragStart}
    >
      <span className="corner-line corner-line-top" />
      <span className="corner-line corner-line-mid" />
      <span className="corner-line corner-line-low" />
      <span
        className="corner-resize-handle"
        onPointerDown={handleResizeStart}
        title="Resize (drag vertical)"
        aria-label="Resize"
      >
        ⤡
      </span>
    </div>
  );
}

function CornerCurve2() {
  const init = getModulePosition("CornerCurve2");
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: true,
    name: "CornerCurve2 (CafeScene.jsx)",
    initialOffset: init.offset
  });
  const [scale, setScale] = useState(init.scale);
  const [resizing, setResizing] = useState(false);

  function handleResizeStart(e) {
    if (process.env.NODE_ENV !== "development") return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startScale = { ...scale };
    setResizing(true);

    function move(ev) {
      const delta = (ev.clientY - startY) / 200;
      const factor = Math.max(0.2, Math.min(3, 1 + delta));
      setScale({
        x: Math.max(0.1, startScale.x * factor),
        y: Math.max(0.1, startScale.y * factor)
      });
    }
    function up() {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const interacting = dragging || resizing;

  return (
    <div
      className={`corner-curve corner-curve-2 is-draggable${interacting ? " is-dragging" : ""}`}
      data-file="CafeScene.jsx::CornerCurve2"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale.x}, ${scale.y})`
      }}
      onPointerDown={handleDragStart}
    >
      <span className="corner-curve-2-fill" />
      <span className="corner-line corner-line-top" />
      <span className="corner-line corner-line-mid" />
      <span className="corner-line corner-line-low" />
      <span
        className="corner-resize-handle"
        onPointerDown={handleResizeStart}
        title="Resize (drag vertical)"
        aria-label="Resize"
      >
        ⤡
      </span>
    </div>
  );
}

function CafeGlass() {
  const init = getModulePosition("CafeGlass");
  const ds = useDragScale({
    scaled: true,
    name: "CafeScene.jsx::CafeGlass",
    initialOffset: init.offset,
    initialScale: init.scale
  });
  const mullions = [
    { x: 680, top: 365, bottom: 610 },
    { x: 790, top: 362, bottom: 607 },
    { x: 900, top: 360, bottom: 604 },
    { x: 1010, top: 358, bottom: 601 },
    { x: 1120, top: 356, bottom: 598 },
    { x: 1230, top: 354, bottom: 595 },
    { x: 1340, top: 352, bottom: 592 },
    { x: 1450, top: 350, bottom: 585 }
  ];

  return (
    <section
      className={`cafe-glass${ds.interacting ? " is-dragging" : ""}`}
      data-file="CafeScene.jsx::CafeGlass"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`
      }}
    >
      <CafeDragKnob onPointerDown={ds.handleDragStart} dragging={ds.interacting} label="CafeGlass" />
      <div className="interior-ceiling" />
      <div className="interior-floor" />
      <div className="interior-glow glow-left" />
      <div className="interior-glow glow-right" />
      <div className="back-bar">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="inside-silhouette silhouette-a" />
      <Mike />
      <div className="inside-silhouette silhouette-c" />
      {mullions.map((mullion) => (
        <span
          className="mullion"
          key={mullion.x}
          style={{
            left: `${mullion.x - 610}px`,
            top: `${mullion.top - 338}px`,
            height: `${mullion.bottom - mullion.top}px`
          }}
        />
      ))}
      <CafeChildResize onPointerDown={ds.handleResizeStart} />
    </section>
  );
}

function CounterModule({ seats }) {
  const init = getModulePosition("Counter");
  const ds = useDragScale({
    scaled: true,
    name: "Counter.jsx",
    initialOffset: init.offset,
    initialScale: init.scale
  });
  return (
    <Counter
      seats={seats}
      transform={`translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`}
      onDragStart={ds.handleDragStart}
      onResizeStart={ds.handleResizeStart}
      isDragging={ds.interacting}
    />
  );
}

export default function CafeScene({ seats }) {
  const scale = useSceneScale();

  return (
    <div className="scene-viewport" data-file="CafeScene.jsx::scene-viewport">
      <div
        className="scene-stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div className="night-sky" />
        <div className="street-haze" />
        <DistantSkyline />
        <LeftBuilding />
        <div className="cafe-glass-wrap"><CafeGlass /></div>
        <div className="cafe-module" data-file="CafeScene.jsx::cafe-module">
          <div className="cafe-cluster cafe-cluster-bg">
            <CafeUpperFloor />
          </div>
          <div className="cafe-cluster cafe-cluster-fg">
            <CounterModule seats={seats} />
          </div>
        </div>
        <CornerCurve />
        <CornerCurve2 />
        <CashRegister />
        <RadioCabinet />
        <CafeSign />
        <PaperPanel />
        <ShelfPanel />
        <div className="street-base" aria-hidden="true" />
        <div className="scene-vignette" aria-hidden="true" />
        <div id="bubble-portal-host" className="bubble-portal-host" aria-hidden="true" />
      </div>
    </div>
  );
}
