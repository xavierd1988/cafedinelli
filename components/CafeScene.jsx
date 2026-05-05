import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getModulePosition } from "../lib/modulePositions.js";
import { getEditMode, setEditMode } from "../lib/editMode.js";
import { useSceneScale } from "./useSceneScale.js";
import BlackBackdrop from "./BlackBackdrop.jsx";
import BordeauxBackdrop from "./BordeauxBackdrop.jsx";
import CafeDoor from "./CafeDoor.jsx";
import CafeSign from "./CafeSign.jsx";
import CheckeredFloor from "./CheckeredFloor.jsx";
import Counter from "./Counter.jsx";
import Gatekeeper from "./Gatekeeper.jsx";
import InteractiveSilhouette from "./InteractiveSilhouette.jsx";
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

// useSceneScale a été déplacé dans ./useSceneScale.js pour que les modules
// flottants (Receipt, WeatherClock, NicknameTag) l'utilisent aussi.

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

// 17 fenêtres par étage, espacement 94px. Toute la rangée a été décalée
// très légèrement vers la gauche (-16px) par rapport aux positions
// d'origine pour mieux s'aligner avec la façade.
const WINDOW_LEFTS = [
  24, 118, 212, 306, 400, 494, 588, 682, 776,
  870, 964, 1058, 1152, 1246, 1340, 1434, 1528
];

// 4 étages résidentiels. La rangée du bas (top:430), qui longeait
// directement la corniche au-dessus des magasins/storefront, a été
// retirée pour ne pas se cogner visuellement aux awnings des shops.
const buildingFloors = [
  { top: 30,  windows: WINDOW_LEFTS },
  { top: 130, windows: WINDOW_LEFTS },
  { top: 230, windows: WINDOW_LEFTS },
  { top: 330, windows: WINDOW_LEFTS }
];

// Une fenêtre sur deux allumée, en damier (rangées paires/impaires
// décalées d'un cran) → effet "immeuble vivant" sans tout cramer.
const litMap = [
  WINDOW_LEFTS.map((_, i) => i % 2 === 0),
  WINDOW_LEFTS.map((_, i) => i % 2 === 1),
  WINDOW_LEFTS.map((_, i) => i % 2 === 0),
  WINDOW_LEFTS.map((_, i) => i % 2 === 1)
];

function LeftBuilding() {
  // Produits du jour + état "shop mode" (controlled by PaperPanel via events).
  // Quand shop mode est ON, on remplit les vitrines GROCERY (15) et MOTOS
  // (15 — affichés en plus des silhouettes de motos). Chaque case est un
  // <a> qui pointe vers Amazon dans un nouvel onglet.
  const [products, setProducts] = useState([]);
  const [shopMode, setShopMode] = useState(false);
  // ID du produit à highlighter (entouré rouge dans la vitrine) après un
  // clic sur le bouton Buy it / la rangée correspondante côté newsletter.
  const [highlightedId, setHighlightedId] = useState(null);

  // Charge les produits dans les vitrines : on essaie d'abord d'extraire
  // les Amazon Top 15 (Best Sellers + Movers) de la newsletter du jour
  // pour que chaque clic dans la newsletter ait son pendant exact dans
  // les vitrines. Fallback : la liste curated /api/products.
  useEffect(() => {
    let cancelled = false;

    function emojiFor(name) {
      const n = name.toLowerCase();
      if (/(watch|series|garmin|apple watch)/.test(n)) return "⌚";
      if (/(phone|iphone)/.test(n)) return "📱";
      if (/(airpod|earbud|headphone|mic\b|lavalier)/.test(n)) return "🎧";
      if (/(tumbler|stanley|mug|cup|bottle|hydro)/.test(n)) return "☕";
      if (/(lotion|oil|serum|cream|moisturiz|hair|olaplex|mielle|eos)/.test(n)) return "🧴";
      if (/(patch|cosmetic|beauty|toner|skincare|medicube)/.test(n)) return "💄";
      if (/(ice|maker|appliance|silonn)/.test(n)) return "🧊";
      if (/(duvet|bedding|sheet|pillow|bedsure)/.test(n)) return "🛏️";
      if (/(lego|toy|squeeze|squishy|needoh|game)/.test(n)) return "🧩";
      if (/(sunscreen|spf|neutrogena|banana boat)/.test(n)) return "☀️";
      if (/(fan|cooling|dreo|tower)/.test(n)) return "🌀";
      if (/(vacuum|shark)/.test(n)) return "🧹";
      if (/(crocs|clog|shoe|boot)/.test(n)) return "👟";
      if (/(card|greeting|pop-?up)/.test(n)) return "💌";
      if (/(claritin|allergy|gummies|olly|vitamin|supplement)/.test(n)) return "💊";
      if (/(julep|cup|glass|tumbler|mint)/.test(n)) return "🥃";
      if (/(planner|notebook|journal|academic)/.test(n)) return "📒";
      if (/(scarf|pashmina|silk)/.test(n)) return "🧣";
      if (/(hat|fascinator|derby)/.test(n)) return "🎩";
      if (/(roller|jade|gua sha)/.test(n)) return "🪞";
      if (/(stove|fire|patio)/.test(n)) return "🔥";
      if (/(bicycle|bike|tire|tube)/.test(n)) return "🚲";
      if (/(decor|cinco)/.test(n)) return "🎉";
      return "🛒";
    }

    function amazonUrlFor(name) {
      const q = encodeURIComponent(String(name || "").trim()).replace(/%20/g, "+");
      return `https://www.amazon.com/s?k=${q}`;
    }

    function extractFromNewsletter(html) {
      if (!html || typeof DOMParser === "undefined") return null;
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
      const out = [];
      const headers = doc.querySelectorAll("h2, h3, h4");
      headers.forEach((h) => {
        if (!/amazon/i.test(h.textContent || "")) return;
        let next = h.nextElementSibling;
        while (next && next.tagName !== "TABLE") next = next.nextElementSibling;
        if (!next) return;
        next.querySelectorAll("tr").forEach((tr) => {
          const strong = tr.querySelector("strong");
          const name = (strong?.textContent || "").trim();
          if (!name) return;
          out.push({
            id: `nl-${out.length}`,
            name,
            emoji: emojiFor(name),
            amazonUrl: amazonUrlFor(name)
          });
        });
      });
      return out;
    }

    fetch("/api/newsletter")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const html = data?.newsletter?.html;
        const fromNewsletter = extractFromNewsletter(html);
        if (fromNewsletter && fromNewsletter.length > 0) {
          setProducts(fromNewsletter);
          return;
        }
        // Fallback liste curated
        return fetch("/api/products", { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => {
            if (cancelled) return;
            if (Array.isArray(d?.products)) setProducts(d.products);
          });
      })
      .catch(() => {
        // Fallback complet en cas d'erreur réseau/newsletter
        fetch("/api/products", { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => {
            if (cancelled) return;
            if (Array.isArray(d?.products)) setProducts(d.products);
          })
          .catch(() => {});
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handler(e) { setShopMode(!!e.detail?.open); }
    window.addEventListener("cafe-shop-mode-change", handler);
    return () => window.removeEventListener("cafe-shop-mode-change", handler);
  }, []);

  // Highlight : matche le nom reçu de la newsletter contre nos produits.
  // Match fuzzy : on cherche le produit dont le nom partage le plus de
  // tokens (>=4 chars, casse insensible) avec le label cliqué. Si match
  // trouvé, on flash sa case 4s avec un cadre rouge.
  useEffect(() => {
    let timer = null;
    function handler(e) {
      const name = (e.detail?.name || "").trim();
      if (!name || products.length === 0) return;
      const queryTokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
      if (queryTokens.length === 0) return;
      let bestId = null;
      let bestScore = 0;
      for (const p of products) {
        const tokens = String(p.name || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
        let score = 0;
        for (const q of queryTokens) {
          if (tokens.some((t) => t === q || t.includes(q) || q.includes(t))) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestId = p.id;
        }
      }
      if (bestId) {
        // S'assurer que la vitrine est visible AVANT d'afficher le highlight
        setShopMode(true);
        setHighlightedId(bestId);
        // Spotlight : on bloque le reste de la page pendant la durée.
        try { document.body.classList.add("is-spotlight-active"); } catch {}
        clearTimeout(timer);
        timer = setTimeout(() => {
          setHighlightedId(null);
          try { document.body.classList.remove("is-spotlight-active"); } catch {}
        }, 3000);
      }
    }
    window.addEventListener("cafe-highlight-product", handler);
    return () => {
      window.removeEventListener("cafe-highlight-product", handler);
      clearTimeout(timer);
      try { document.body.classList.remove("is-spotlight-active"); } catch {}
    };
  }, [products]);

  // Photos + prix produits : on hydrate chaque produit avec
  // { imageUrl, price } quand /api/product-image (Amazon scraping +
  // cache Redis) répond. Les produits sans image gardent leur emoji en
  // fallback ; les produits sans prix affichent simplement "see price".
  const [productInfo, setProductInfo] = useState({});
  useEffect(() => {
    if (products.length === 0) return;
    let cancelled = false;
    const CONCURRENCY = 3;
    let i = 0;
    async function worker() {
      while (i < products.length && !cancelled) {
        const p = products[i++];
        if (productInfo[p.id] !== undefined) continue;
        try {
          const r = await fetch(`/api/product-image?q=${encodeURIComponent(p.name)}`);
          const d = await r.json();
          if (cancelled) return;
          setProductInfo((prev) => ({
            ...prev,
            [p.id]: { imageUrl: d?.imageUrl || null, price: d?.price || null }
          }));
        } catch {
          if (cancelled) return;
          setProductInfo((prev) => ({ ...prev, [p.id]: { imageUrl: null, price: null } }));
        }
      }
    }
    Promise.all(Array.from({ length: CONCURRENCY }, () => worker())).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // 30 produits répartis sur les 3 vitrines, dimensionné en proportion
  // de la largeur de chaque shop (GROCERY 250px, FLORIST 160px, MOTOS
  // 380px).
  const groceryProducts = products.slice(0, 12);
  const floristProducts = products.slice(12, 18);
  const motosProducts   = products.slice(18, 30);

  function trackClick(p) {
    try {
      window.dispatchEvent(new CustomEvent("product_clicked", {
        detail: { id: p.id, name: p.name }
      }));
    } catch {}
  }

  function ShopProductCells({ items, className = "" }) {
    if (!items.length) return null;
    return (
      <div className={`lb-shop-products ${shopMode ? "is-visible" : ""} ${className}`}>
        {items.map((p) => {
          const info = productInfo[p.id] || {};
          const img = info.imageUrl;
          const price = info.price;
          return (
            <a
              key={p.id}
              href={p.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`lb-shop-product${p.id === highlightedId ? " is-highlighted" : ""}${img ? " has-image" : ""}`}
              title={p.name}
              onClick={() => trackClick(p)}
            >
              {img ? (
                <img
                  className="lb-shop-product-img"
                  src={img}
                  alt={p.name}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span className="lb-shop-product-emoji" aria-hidden="true">{p.emoji}</span>
              )}
              {/* Overlay nom + prix visible au hover (zoom géant) */}
              <span className="lb-shop-product-name">{p.name}</span>
              <span className="lb-shop-product-price">{price || "see price"}</span>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <section
      className={`left-building${shopMode ? " is-shop-mode" : ""}`}
      aria-hidden="true"
      data-file="CafeScene.jsx::LeftBuilding"
    >
      {buildingFloors.map((floor, fi) => (
        <div className="lb-floor" key={fi} style={{ top: `${floor.top}px` }}>
          {floor.windows.map((x, wi) => {
            // Reflet unique par fenêtre, déterministe via (fi, wi) :
            // - angle entre 95° et 165° (varie par index combiné)
            // - position du début entre 5% et 35%
            // - intensité entre 0.06 et 0.26
            const seed = fi * 7 + wi * 13;
            const angle = 95 + (seed % 70);
            const start = 5 + ((seed * 3) % 30);
            const mid = start + 12 + ((seed * 5) % 14);
            const end = mid + 14 + ((seed * 2) % 18);
            const alpha = 0.06 + ((seed * 11) % 21) / 100; // 0.06..0.26
            return (
              <span
                key={wi}
                className={`lb-window${litMap[fi][wi] ? " is-lit" : ""}`}
                style={{
                  left: `${x}px`,
                  "--w-reflect-angle": `${angle}deg`,
                  "--w-reflect-start": `${start}%`,
                  "--w-reflect-mid": `${mid}%`,
                  "--w-reflect-end": `${end}%`,
                  "--w-reflect-alpha": alpha
                }}
              />
            );
          })}
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
          {ShopProductCells({ items: groceryProducts })}
        </div>
        <div className="lb-shop-base" />
      </div>
      <div className="lb-shop lb-shop-b">
        <div className="lb-shop-awning lb-shop-awning-alt" />
        <div className="lb-shop-sign">FLORIST</div>
        <div className="lb-shop-window">
          <span className="lb-shop-glow" />
          <span className="lb-shop-shelf lb-shop-shelf-top" />
          <span className="lb-shop-shelf lb-shop-shelf-mid" />
          {ShopProductCells({ items: floristProducts })}
        </div>
        <div className="lb-shop-base" />
      </div>
      {/* Porte cochère haussmannienne entre MOTOS et GROCERY : arche
          sombre. On voit un petit escalier compressé qui monte vers
          une porte en haut (entrée du logement / cour). */}
      <div className="lb-porte-cochere" aria-hidden="true">
        <span className="lb-porte-arch-glow" />
        <span className="lb-porte-back-door" />
        <span className="lb-porte-stairs">
          <span className="lb-porte-step" />
          <span className="lb-porte-step" />
          <span className="lb-porte-step" />
          <span className="lb-porte-step" />
          <span className="lb-porte-step" />
          <span className="lb-porte-step" />
          <span className="lb-porte-step" />
        </span>
      </div>
      <div className="lb-shop lb-shop-c">
        <div className="lb-shop-awning lb-shop-awning-moto" />
        <div className="lb-shop-sign">HARDWARE</div>
        <div className="lb-shop-window">
          <span className="lb-shop-glow" />
          {ShopProductCells({ items: motosProducts })}
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

  // Pause auto à l'ouverture de la salle secrète. On retient si la radio
  // jouait pour pouvoir reprendre exactement là à la sortie. Si la radio
  // était déjà en pause, l'événement est silencieusement no-op.
  const wasPlayingBeforeSecretRef = useRef(false);
  useEffect(() => {
    function onSecretState(e) {
      const isOpen = !!e.detail?.open;
      const a = audioRef.current;
      if (!a) return;
      if (isOpen) {
        wasPlayingBeforeSecretRef.current = playing;
        if (playing) {
          a.pause();
          setPlaying(false);
          setTrack(null);
          broadcast({ playing: false, track: null });
        }
      } else if (wasPlayingBeforeSecretRef.current) {
        wasPlayingBeforeSecretRef.current = false;
        a.play()
          .then(() => {
            setPlaying(true);
            broadcast({ playing: true, track: null });
          })
          .catch(() => {
            /* autoplay refusé : on laisse l'utilisateur relancer */
          });
      }
    }
    window.addEventListener("secret-room-state", onSecretState);
    return () => window.removeEventListener("secret-room-state", onSecretState);
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
  // Keypad caché qui apparaît au clic. "7" toggle l'edit mode.
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [feedback, setFeedback] = useState(null); // null | "ok" | "reject"
  const downRef = useRef(null);
  const inputRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Distinguer click vs drag : on track pointerdown/up et on n'ouvre le
  // keypad que si pas de mouvement.
  function handlePointerDown(e) {
    downRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    ds.handleDragStart(e); // no-op si !EDIT_MODE
  }

  function handlePointerUp(e) {
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    const dt = Date.now() - start.t;
    if (dx < 5 && dy < 5 && dt < 600) {
      setKeypadOpen(true);
      setKeypadValue("");
      setFeedback(null);
    }
  }

  // Auto-focus l'input quand le keypad ouvre.
  useEffect(() => {
    if (keypadOpen) {
      inputRef.current?.focus();
      // Auto-close si rien tapé en 6s.
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setKeypadOpen(false);
        setFeedback(null);
        setKeypadValue("");
      }, 6000);
    }
    return () => clearTimeout(closeTimerRef.current);
  }, [keypadOpen]);

  function submitKeypad(e) {
    e?.preventDefault();
    e?.stopPropagation();
    const v = keypadValue.trim();
    if (v === "7") {
      // Toggle : si déjà en edit mode, désactive ; sinon active.
      setEditMode(!getEditMode());
      setFeedback("ok");
    } else {
      setFeedback("reject");
    }
    setKeypadValue("");
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setKeypadOpen(false);
      setFeedback(null);
    }, 900);
  }

  function closeKeypad(e) {
    e?.stopPropagation();
    clearTimeout(closeTimerRef.current);
    setKeypadOpen(false);
    setFeedback(null);
    setKeypadValue("");
  }

  return (
    <div
      className={`cash-register${ds.interacting ? " is-dragging" : ""}${keypadOpen ? " is-keypad-open" : ""}`}
      data-file="CafeScene.jsx::CashRegister"
      style={{
        transform: `translate(${ds.offset.x}px, ${ds.offset.y}px) scale(${ds.scale.x}, ${ds.scale.y})`,
        transformOrigin: "center center"
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { downRef.current = null; }}
    >
      {/* Meuble en bois (base) */}
      <div className="cr-cabinet">
        <span className="cr-cabinet-shelf" />
        <span className="cr-cabinet-handle" />
      </div>
      {/* Caisse enregistreuse posée dessus */}
      <div className="cr-body">
        <div className="cr-display">
          {keypadOpen ? (
            <form
              className="cr-keypad-form"
              onSubmit={submitKeypad}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                className="cr-keypad-input"
                type="text"
                inputMode="numeric"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={keypadValue}
                onChange={(e) => setKeypadValue(e.target.value.replace(/\D/g, "").slice(0, 3))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeKeypad(e);
                  e.stopPropagation();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="—"
                maxLength={3}
              />
            </form>
          ) : (
            <span className="cr-display-text">
              {feedback === "ok" ? "OK" : feedback === "reject" ? "ERR" : "$ 4.50"}
            </span>
          )}
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
    if (!getEditMode()) return;
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
  // Click vs drag detection — clic court sans mouvement = on summon le taxi
  const downRef = useRef(null);

  function handleResizeStart(e) {
    if (!getEditMode()) return;
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

  function handlePointerDown(e) {
    downRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    handleDragStart(e); // no-op si !EDIT_MODE
  }

  function handlePointerUp(e) {
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    const dt = Date.now() - start.t;
    if (dx < 5 && dy < 5 && dt < 600) {
      // Clic court → on déclenche le taxi NYC localement (feedback immédiat)
      // ET on POST au serveur pour que tous les autres visiteurs voient
      // aussi le taxi traverser au prochain poll (~3s max).
      try {
        window.dispatchEvent(new CustomEvent("summon-taxi"));
      } catch {
        /* ignore */
      }
      fetch("/api/taxi", { method: "POST" }).catch(() => {
        /* silencieux : si le réseau est en panne, l'anim locale a au moins joué */
      });
    }
  }

  const interacting = dragging || resizing;

  return (
    <div
      className={`corner-curve corner-curve-2 is-draggable${interacting ? " is-dragging" : ""}`}
      data-file="CafeScene.jsx::CornerCurve2"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale.x}, ${scale.y})`
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { downRef.current = null; }}
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

// Taxi NYC partagé : traverse de droite à gauche quand un visiteur clique
// CornerCurve2. La signal arrive de 2 sources :
//   (1) "summon-taxi" event local (clic immédiat, feedback < 1ms)
//   (2) seats-remote-update.taxi.summonedAt (autre visiteur a cliqué,
//       reçu via poll en max ~3s)
// Pour ne pas re-jouer une anim qu'on a déjà jouée, on track le dernier
// timestamp affiché via un ref.
function Taxi() {
  const [running, setRunning] = useState(false);
  const ref = useRef(null);
  const lastShownTsRef = useRef(0);

  function trigger() {
    setRunning(false);
    requestAnimationFrame(() => {
      if (ref.current) void ref.current.offsetWidth; // restart anim
      setRunning(true);
    });
  }

  useEffect(() => {
    function onSummonLocal() {
      // Clic local → on note un "now" pour que le poll suivant ne
      // déclenche pas une anim de plus.
      lastShownTsRef.current = Date.now();
      trigger();
    }
    function onRemote(e) {
      const ts = Number(e.detail?.taxi?.summonedAt);
      if (!Number.isFinite(ts) || ts <= 0) return;
      if (ts <= lastShownTsRef.current) return; // déjà vu
      lastShownTsRef.current = ts;
      trigger();
    }
    window.addEventListener("summon-taxi", onSummonLocal);
    window.addEventListener("seats-remote-update", onRemote);
    return () => {
      window.removeEventListener("summon-taxi", onSummonLocal);
      window.removeEventListener("seats-remote-update", onRemote);
    };
  }, []);

  function onAnimEnd() {
    setRunning(false);
  }

  return (
    <div
      ref={ref}
      className={`nyc-taxi${running ? " is-running" : ""}`}
      aria-hidden="true"
      onAnimationEnd={onAnimEnd}
      data-file="CafeScene.jsx::Taxi"
    >
      {/* Dôme TAXI lumineux sur le toit */}
      <span className="taxi-rooflight" />
      <span className="taxi-sign">TAXI</span>

      {/* Carrosserie + greenhouse rendus via .taxi-body (bas) et
          ::before (cabine vitrée). Vitres = 3 fenêtres : conducteur,
          porte arrière, et petit quart-arrière triangulaire. */}
      <span className="taxi-body" />
      <span className="taxi-window taxi-window-front" />
      <span className="taxi-window taxi-window-rear" />
      <span className="taxi-window taxi-window-quarter" />

      {/* Rétroviseur extérieur côté conducteur */}
      <span className="taxi-mirror" />

      {/* Chrome window trim (fine ligne brillante au bas des vitres) */}
      <span className="taxi-trim" />

      {/* Lignes de portes (cuts entre portes avant/arrière) */}
      <span className="taxi-doorline taxi-doorline-front" />
      <span className="taxi-doorline taxi-doorline-rear" />

      {/* Logo NYC TAXI sur la porte arrière */}
      <span className="taxi-logo">
        <span className="taxi-logo-nyc">NYC</span>
        <span className="taxi-logo-mark">T</span>
        <span className="taxi-logo-axi">AXI</span>
      </span>

      {/* Numéro de médaillon (style "5J25 / 525-7253") */}
      <span className="taxi-medallion">5J25</span>

      {/* Damier checker NYC : stripe le long du flanc + panneau plus dense
          sur l'aile arrière */}
      <span className="taxi-stripe" />
      <span className="taxi-checker-rear" />

      {/* Chrome bumpers avant et arrière */}
      <span className="taxi-bumper taxi-bumper-front" />
      <span className="taxi-bumper taxi-bumper-rear" />

      {/* Phares & feux arrière */}
      <span className="taxi-headlight" />
      <span className="taxi-taillight" />

      {/* Roues (avec arche noire pour mieux se détacher du sol) */}
      <span className="taxi-arch taxi-arch-front" />
      <span className="taxi-arch taxi-arch-rear" />
      <span className="taxi-wheel taxi-wheel-front" />
      <span className="taxi-wheel taxi-wheel-rear" />

      {/* Grille avant + ligne de capot pour rapprocher la silhouette
          d'une Crown Victoria */}
      <span className="taxi-grille" />
      <span className="taxi-hoodline" />
      <span className="taxi-trunkline" />

      {/* Poignées de portes chromées */}
      <span className="taxi-handle taxi-handle-front" />
      <span className="taxi-handle taxi-handle-rear" />
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
      <InteractiveSilhouette
        className="silhouette-a"
        bubbleId={-2}
        mode="message"
        message="I'm busy working."
      />
      <Mike />
      <Gatekeeper />
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
        {/* Fond noir (z-index 6, même niveau que .cafe-glass-wrap). Rendu
            AVANT le glass dans le DOM pour que le glass paint au-dessus
            quand les z-index sont égaux. */}
        <BlackBackdrop />
        {/* Aplat bordeaux très foncé, draggable + resizable. */}
        <BordeauxBackdrop />
        {/* Sol en damier bordeaux/noir, draggable + resizable. */}
        <CheckeredFloor />
        {/* Taxi NYC : traverse la rue de droite à gauche au clic sur
            CornerCurve2. Posé AVANT le glass dans le DOM + z-index 5
            pour passer derrière la vitrine. */}
        <Taxi />
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
        {/* Porte AVANT register/radio dans le DOM : door doit passer derrière
            le register (z-index 10 vs 18). Garder cet ordre — sinon en cas de
            cache CSS le DOM order ferait remonter la porte par-dessus. */}
        <CafeDoor />
        <RadioCabinet />
        <CashRegister />
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
