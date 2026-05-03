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
    // Haut de la tête : par défaut on suppose un .seat (226px de hauteur,
    // tête à 145px au-dessus du bas). Pour les éléments dont le rect épouse
    // déjà la silhouette (Mike), on prend simplement le top du rect.
    const headTopFromTop = info.anchor === "top"
      ? (seatRect.top - hostRect.top) / scale
      : seatBottomFromTop - 145;

    const bubbleW = bubbleRect.width / scale;
    const bubbleH = bubbleRect.height / scale;

    // Position naturelle : bas de la bulle 18px au-dessus de la tête → queue
    // de 18px qui touche bien le sommet de la tête.
    let bubbleBottomFromTop = headTopFromTop - 18;

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
    bubbleEl.style.left = `${centerX}px`;
    bubbleEl.style.bottom = `${portalH - bubbleBottomFromTop}px`;

    // Queue : du bas de la bulle jusqu'au haut de la tête. Min 10px pour
    // garantir qu'elle reste visible même si la bulle est très basse.
    const tailLength = Math.max(10, headTopFromTop - bubbleBottomFromTop);
    bubbleEl.style.setProperty("--tail-length", `${tailLength}px`);
  }

  rafId = requestAnimationFrame(tick);
}

export function registerBubble(id, getters) {
  bubbles.set(id, getters);
  if (!rafId && typeof window !== "undefined") {
    rafId = requestAnimationFrame(tick);
  }
}

export function unregisterBubble(id) {
  bubbles.delete(id);
}
