"use client";

import { useEffect, useState } from "react";

// "On the shelf" : 30 articles café/cosy posés en cases derrière le journal,
// rafraîchis chaque matin à 9h00 via /api/products (cf. lib/productsStore.js
// pour la rotation déterministe). Quand un visiteur clique "buy it" sur un
// article du paper, le journal slide à droite et cette étagère apparaît.
//
// Ce composant est rendu dans Homepage (pas dans PaperPanel) pour rester
// stationnaire pendant que le journal glisse. Communication bidirectionnelle
// via les events :
//   - PaperPanel → Shelf : "cafe-shop-mode-change" { open: bool }
//   - Shelf → PaperPanel : "cafe-shop-mode-close"

function fire(name, detail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* analytics hook silently ignored */
  }
}

export default function Shelf() {
  const [visible, setVisible] = useState(false);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Sync via PaperPanel events — quand le journal passe en shop mode,
  // l'étagère devient visible. Et inversement.
  useEffect(() => {
    function handler(e) {
      const open = !!e.detail?.open;
      setVisible(open);
    }
    window.addEventListener("cafe-shop-mode-change", handler);
    return () => window.removeEventListener("cafe-shop-mode-change", handler);
  }, []);

  // Fetch unique au mount — la liste reste stable toute la journée
  // (rotation à 9h côté serveur).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.products)) setProducts(data.products);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (visible) fire("shelf_revealed");
  }, [visible]);

  function onProductClick(p) {
    fire("product_clicked", { id: p.id, name: p.name });
  }

  function onBack(e) {
    e.preventDefault();
    fire("back_to_paper_clicked");
    fire("cafe-shop-mode-close");
  }

  return (
    <div
      className={`store-shelf${visible ? " is-visible" : ""}`}
      aria-hidden={!visible}
      data-file="Shelf.jsx"
    >
      <header className="store-shelf-head">
        <h3 className="store-shelf-title">On the shelf</h3>
        <button type="button" className="store-shelf-back" onClick={onBack}>
          ← Back to the paper
        </button>
      </header>

      {!loaded ? (
        <p className="store-shelf-loading">Stocking the shelf…</p>
      ) : (
        <div className="store-shelf-grid">
          {products.map((p) => (
            <article className="store-product" key={p.id}>
              <div className="store-product-image" aria-hidden="true">
                <span className="store-product-emoji">{p.emoji}</span>
              </div>
              <h4 className="store-product-name">{p.name}</h4>
              <a
                className="store-product-view"
                href={p.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onProductClick(p)}
              >
                View
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
