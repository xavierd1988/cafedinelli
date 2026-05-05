// Positions bakées des modules draggables, indexées par device class.
// - desktop : >= 1280px
// - tablet  : 768-1279 (iPad portrait + iPad landscape)
// - phone   : < 768px (utilise le mobile shell empilé, pas la scène café)
//
// En dev les modules sont draggables/resizables (handlers actifs si
// NODE_ENV === "development"). On exporte via PositionExporter qui sait
// quelle device class on est en train de positionner, puis on bake ici.

// Tailles d'origine (pré-iPad). Tous les modules sont draggables/resizables
// en dev (NODE_ENV === "development"), figés en prod.
const desktop = {
  Receipt:        { offset: { x: -19.9, y: -50.8 }, scale: { x: 1.041, y: 1.041 } },
  WeatherClock:   { offset: { x: -39, y: 0.5 }, scale: { x: 1.041, y: 1.041 } },
  NicknameTag:    { offset: { x: 813.3, y: 357.8 }, scale: { x: 1.132, y: 1.132 }, rotation: -1.4 },
  ShelfPanel:     { offset: { x: 196.4, y: 32.9 }, scale: { x: 0.727, y: 0.727 } },
  PaperPanel:     { offset: { x: -71.5, y: -153.2 }, size: { width: 805.4, height: 821.8 } },
  NeonSign:       { offset: { x: -142, y: 16.6 }, scale: 0.38, rotation: -3 },
  CafeSign:       { offset: { x: 154.7, y: 118 }, scale: { x: 1.141, y: 1.141 }, rotation: 0.2 },
  CafeUpperFloor: { offset: { x: 443.6, y: -464 }, scale: { x: 1.065, y: 1.065 } },
  CafeGlass:      { offset: { x: 55.1, y: 64 }, scale: { x: 1.015, y: 1.015 } },
  Counter:        { offset: { x: 62.9, y: 36 }, scale: { x: 1.117, y: 1.117 } },
  CornerCurve:    { offset: { x: -84.5, y: 103 }, scale: { x: 0.743, y: 0.99 } },
  CornerCurve2:   { offset: { x: -520, y: 400.9 }, scale: { x: 0.448, y: 0.477 } },
  CashRegister:   { offset: { x: 466.3, y: 94 }, scale: { x: 0.354, y: 0.354 } },
  RadioCabinet:   { offset: { x: 326.3, y: 84.9 }, scale: { x: 0.526, y: 0.526 } },
  CafeDoor:       { offset: { x: 647.8, y: 261.9 }, scale: { x: 0.403, y: 0.403 } },
  SeatsCounter:   { offset: { x: 1380, y: 380 }, scale: { x: 1, y: 1 } },
  BlackBackdrop:  { offset: { x: 1358.4, y: 358.6 }, size: { width: 380.7, height: 406 } },
  CheckeredFloor: { offset: { x: 950.8, y: 817.3 }, size: { width: 900, height: 160 }, rotation: -2.79 },
  BordeauxBackdrop: { offset: { x: 600, y: 400 }, size: { width: 400, height: 300 } }
};

// Tablet hérite de desktop comme point de départ — c'est ce que tu
// repositionnes en local sur iPad. Une fois validé tu colles ici les
// nouvelles valeurs.
// Quelques overrides pour les modules dont le CSS est en position:fixed
// (donc offset en pixels viewport, pas en coords scene-stage) — sinon
// ils tombent hors-écran à la taille iPad.
const tablet = {
  ...desktop,
  // Desktop le mettait à {x: 1657, y: 907} = bottom-right d'un viewport 1600x900,
  // ce qui est hors-écran sur iPad. On le ramène visible en haut-gauche par
  // défaut, l'utilisateur le repositionne ensuite via drag.
  NicknameTag: { offset: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }
};

// Freeze profond pour verrouiller toutes les positions/tailles bakées :
// aucun composant ne peut accidentellement muter une entrée à l'exécution.
function deepFreeze(o) {
  if (!o || typeof o !== "object") return o;
  Object.values(o).forEach(deepFreeze);
  return Object.freeze(o);
}
deepFreeze(desktop);
deepFreeze(tablet);

const POSITIONS = Object.freeze({ desktop, tablet });

export function getDeviceClass() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "phone";
  if (w < 1280) return "tablet";
  return "desktop";
}

export function getModulePosition(name) {
  const cls = getDeviceClass();
  const map = POSITIONS[cls] || POSITIONS.desktop;
  // Si une clé manque pour le device class courant, on retombe sur desktop.
  return map[name] || POSITIONS.desktop[name];
}
