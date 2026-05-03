// Positions bakées des modules draggables, indexées par device class.
// - desktop : >= 1280px
// - tablet  : 768-1279 (iPad portrait + iPad landscape)
// - phone   : < 768px (utilise le mobile shell empilé, pas la scène café)
//
// En dev les modules sont draggables/resizables (handlers actifs si
// NODE_ENV === "development"). On exporte via PositionExporter qui sait
// quelle device class on est en train de positionner, puis on bake ici.

// Tailles d'origine × 1.17 (bump global +17%). Tous les modules sont
// draggables ET resizables — sur iPad en local, repositionne/redimensionne
// puis exporte les positions.
const desktop = {
  Receipt:        { offset: { x: -19, y: -18 }, scale: { x: 1.17, y: 1.17 } },
  WeatherClock:   { offset: { x: -11, y: -9 }, scale: { x: 1.17, y: 1.17 } },
  NicknameTag:    { offset: { x: 1657, y: 907 }, scale: { x: 1.17, y: 1.17 } },
  ShelfPanel:     { offset: { x: 196.4, y: 32.9 }, scale: { x: 0.851, y: 0.851 } },
  PaperPanel:     { offset: { x: 53.3, y: -116.4 }, size: { width: 611.4, height: 985.3 } },
  NeonSign:       { offset: { x: 746, y: 297 }, scale: 0.503, rotation: -3 },
  CafeSign:       { offset: { x: 154.7, y: 118 }, scale: { x: 1.335, y: 1.335 } },
  CafeUpperFloor: { offset: { x: 443.6, y: -464 }, scale: { x: 1.246, y: 1.246 } },
  CafeGlass:      { offset: { x: 55.1, y: 64 }, scale: { x: 1.188, y: 1.188 } },
  Counter:        { offset: { x: 49.7, y: 41.8 }, scale: { x: 1.307, y: 1.307 } },
  CornerCurve:    { offset: { x: -84.5, y: 103 }, scale: { x: 0.869, y: 1.158 } },
  CornerCurve2:   { offset: { x: -450.8, y: 360.9 }, scale: { x: 0.590, y: 0.628 } },
  CashRegister:   { offset: { x: 448, y: 90.7 }, scale: { x: 0.567, y: 0.567 } },
  RadioCabinet:   { offset: { x: 322.6, y: 89.8 }, scale: { x: 0.684, y: 0.684 } }
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

const POSITIONS = { desktop, tablet };

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
