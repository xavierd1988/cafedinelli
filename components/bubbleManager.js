// Singleton qui orchestre toutes les bulles de chat actives :
// - une seule boucle requestAnimationFrame globale
// - empilement vertical déterministe pour éviter le chevauchement
// - longueur de queue calculée pour toujours toucher la tête de la silhouette
//
// Chaque Seat enregistre/désinscrit sa bulle quand elle s'affiche/disparaît.
// Les positions sont écrites en inline-style sur l'élément .speech-bubble
// (qui est rendu via createPortal dans #bubble-portal-host).

const bubbles = new Map(); // seatId → { getSeatEl, getBubbleEl }
let host = null;
let rafId = null;

// Référence à la couche portail (rendue par CafeScene dans .scene-stage).
function ensureHost() {
  if (!host || !host.isConnected) {
    host = typeof document !== "undefined"
      ? document.getElementById("bubble-portal-host")
      : null;
  }
  return host;
}

function tick() {
  if (bubbles.size === 0) {
    rafId = null;
    return;
  }
  const h = ensureHost();
  if (!h) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  const hostRect = h.getBoundingClientRect();
  const scale = h.offsetWidth ? hostRect.width / h.offsetWidth : 1;
  const portalH = h.offsetHeight;

  // Tri stable par seatId croissant : le seat avec l'id le plus bas
  // garde sa position naturelle, les suivants sont éventuellement repoussés.
  const entries = Array.from(bubbles.entries()).sort((a, b) => a[0] - b[0]);
  const placed = [];

  for (const [, info] of entries) {
    const seatEl = info.getSeatEl();
    const bubbleEl = info.getBubbleEl();
    if (!seatEl || !bubbleEl || !seatEl.isConnected || !bubbleEl.isConnected) continue;

    const seatRect = seatEl.getBoundingClientRect();
    const bubbleRect = bubbleEl.getBoundingClientRect();

    // Coords en repère scene-stage (non scaled).
    const centerX = (seatRect.left + seatRect.width / 2 - hostRect.left) / scale;
    const seatBottomFromTop = (seatRect.bottom - hostRect.top) / scale;
    // Haut de la tête au-dessus du bas du .seat.
    // Calcul : .seat-person est à bottom:79, height:66, et a un
    // transform:scale(1.4) avec origin bottom center → la silhouette
    // visuelle s'étire de 79 + 66*1.4 = ~172 px au-dessus du bas du
    // .seat. On ajoute ~3 px pour être pile sur le haut de la tête.
    // Pour les éléments dont le rect épouse déjà la silhouette (Mike),
    // on prend simplement le top du rect via anchor="top".
    const headTopFromTop = info.anchor === "top"
      ? (seatRect.top - hostRect.top) / scale
      : seatBottomFromTop - 175;

    const bubbleW = bubbleRect.width / scale;
    const bubbleH = bubbleRect.height / scale;

    // Bulle 35px au-dessus de la tête (bien décolée mais tige courte).
    const jitterY = info.jitterY || 0;
    let bubbleBottomFromTop = headTopFromTop - 35 - jitterY;

    // Évitement des collisions : on repousse vers le haut au-dessus de toute
    // bulle déjà placée qui chevauche horizontalement.
    for (const p of placed) {
      const xGap = 14;
      const xOverlap =
        Math.abs(centerX - p.centerX) < bubbleW / 2 + p.width / 2 + xGap;
      if (xOverlap && bubbleBottomFromTop > p.topFromTop) {
        bubbleBottomFromTop = p.topFromTop - 12;
      }
    }
    const bubbleTopFromTop = bubbleBottomFromTop - bubbleH;
    placed.push({ centerX, topFromTop: bubbleTopFromTop, width: bubbleW });

    // Position appliquée : centerX (avec translateX(-50%) du CSS) + bottom
    // calculé pour retomber pile sur la cible.
    const jitterX = info.jitterX || 0;
    const jitterRot = info.jitterRot || 0;
    bubbleEl.style.left = `${centerX + jitterX}px`;
    bubbleEl.style.bottom = `${portalH - bubbleBottomFromTop}px`;
    bubbleEl.style.transform = `translateX(-50%) rotate(${jitterRot}deg)`;

    // Queue : courte (max 24px) — la bulle est juste un peu au-dessus, pas
    // reliée par une tige géante. tail-shift compense le décalage horizontal
    // pour que la pointe reste alignée sur la tête de la silhouette.
    const tailLength = Math.min(24, Math.max(10, headTopFromTop - bubbleBottomFromTop));
    bubbleEl.style.setProperty("--tail-length", `${tailLength}px`);
    bubbleEl.style.setProperty("--tail-shift", `${-jitterX}px`);
  }

  rafId = requestAnimationFrame(tick);
}

export function registerBubble(id, getters) {
  // Petit jitter dynamique à chaque prise de parole : la bulle se décale
  // légèrement et tilte un peu, sans partir loin (toujours bien au-dessus
  // de la tête).
  const enriched = {
    ...getters,
    jitterX: (Math.random() - 0.5) * 24,  // ±12 px
    jitterY: Math.random() * 14,           // 0..14 px plus haut
    jitterRot: (Math.random() - 0.5) * 4   // ±2°
  };
  bubbles.set(id, enriched);
  if (!rafId && typeof window !== "undefined") {
    rafId = requestAnimationFrame(tick);
  }
}

export function unregisterBubble(id) {
  bubbles.delete(id);
}
