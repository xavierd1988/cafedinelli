"use client";

import { useEffect, useMemo, useState } from "react";

// =============================================================================
// TOPIC POPUP — overlay déclenché par les liens non-Amazon de la newsletter
// =============================================================================
// Split éditorial 2 colonnes :
//
//   ┌───────────────────────┬───────────────────────┐
//   │  Shop the topic       │  Read about it        │
//   │  ───────────────      │  ───────────────      │
//   │  [photo] desc · $XX   │  NBC News             │
//   │  [photo] desc · $XX   │  · tagline            │
//   │  [photo] desc · $XX   │  Vogue                │
//   │  [photo] desc · $XX   │  · tagline            │
//   │  [photo] desc · $XX   │  …                    │
//   └───────────────────────┴───────────────────────┘
//
// PHOTOS : on appelle /api/product-image (le même endpoint qui hydrate la
// vitrine du store) avec une recherche Amazon par produit. La popup
// affiche un placeholder pendant le fetch, puis swappe vers la vraie
// photo Amazon dès qu'elle arrive. Si Amazon échoue / bloque, fallback
// sur une vignette placeholder.
//
// SOURCES PRESSE : chaque média a sa propre URL de recherche native
// (vogue.com/search?q=…, nytimes.com/search?query=…, etc.) pour atterrir
// directement sur le site, jamais via Google.
// =============================================================================

const PRODUCT_QUERIES = [
  // 5 angles produits qui fonctionnent pour la majorité des topics :
  // un poster, un t-shirt, un livre, un mug, un sticker.
  { suffix: "poster",       desc: "Poster"          },
  { suffix: "t-shirt",      desc: "T-shirt"         },
  { suffix: "book",         desc: "Book"            },
  { suffix: "mug",          desc: "Mug"             },
  { suffix: "sticker pack", desc: "Sticker pack"    }
];

// Chaque média avec son propre pattern de recherche → on atterrit
// directement sur la page recherche du publisher, jamais via Google.
const SOURCES = [
  { name: "NBC News",          search: (q) => `https://www.nbcnews.com/search/?q=${q}` },
  { name: "Vogue",             search: (q) => `https://www.vogue.com/search?q=${q}` },
  { name: "CNN",               search: (q) => `https://edition.cnn.com/search?q=${q}` },
  { name: "The Atlantic",      search: (q) => `https://www.theatlantic.com/search/?q=${q}` },
  { name: "Wired",             search: (q) => `https://www.wired.com/search/?q=${q}&sort=score+desc` },
  { name: "The New York Times",search: (q) => `https://www.nytimes.com/search?query=${q}` },
  { name: "Bloomberg",         search: (q) => `https://www.bloomberg.com/search?query=${q}` },
  { name: "ESPN",              search: (q) => `https://www.espn.com/search/_/q/${q}` },
  { name: "Variety",           search: (q) => `https://variety.com/?s=${q}` },
  { name: "Reuters",           search: (q) => `https://www.reuters.com/site-search/?query=${q}` },
  { name: "The Verge",         search: (q) => `https://www.theverge.com/search?q=${q}` },
  { name: "The New Yorker",    search: (q) => `https://www.newyorker.com/search/q/${q}` }
];

const TAGLINES = [
  "What it means and what's next",
  "The full timeline so far",
  "Behind the headlines",
  "Why everyone's talking about it",
  "A closer look",
  "The numbers that matter",
  "Five quick takeaways",
  "An editor's reading"
];

function amazonSearchUrl(query) {
  const q = encodeURIComponent(String(query || "").trim()).replace(/%20/g, "+");
  return `https://www.amazon.com/s?k=${q}`;
}

// FNV-ish 32-bit string hash → seed déterministe pour le topic.
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// LCG simple — pas de Math.random, on veut le même rendu pour le même topic.
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fire(name, detail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* analytics hook silently ignored */
  }
}

export default function TopicPopup({ topic, articleHref, onClose }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const safeTopic = String(topic || "").trim();

  // Déterministe : 5 produits + 5 sources reproductibles pour le même topic.
  const { products, sources } = useMemo(() => {
    const seed = hashStr(safeTopic.toLowerCase()) || 1;

    // Produits : on combine topic + suffix (poster, t-shirt, …). Chaque
    // produit aura sa propre query Amazon → sa propre photo via
    // /api/product-image. amazonHref ouvre la recherche complète.
    const productList = PRODUCT_QUERIES.map(({ suffix, desc }) => {
      const query = `${safeTopic} ${suffix}`.trim();
      return {
        query,
        desc,
        href: amazonSearchUrl(query)
      };
    });

    // Sources : shuffle déterministe → 5 médias. La 1ère source utilise
    // articleHref (le lien d'origine cliqué dans la newsletter).
    const pickedSources = seededShuffle(SOURCES, seed).slice(0, 5);
    const encodedTopic = encodeURIComponent(safeTopic);
    const sourceList = pickedSources.map((src, i) => {
      const tagline = TAGLINES[(seed + i * 5) % TAGLINES.length];
      const href = i === 0 && articleHref
        ? articleHref
        : src.search(encodedTopic);
      return { name: src.name, tagline, href };
    });

    return { products: productList, sources: sourceList };
  }, [safeTopic, articleHref]);

  // Hydrate les vraies photos Amazon en arrière-plan (même endpoint que
  // la vitrine LeftBuilding). On reçoit { imageUrl, price } par produit
  // et on swappe le placeholder dès que l'image arrive.
  const [productInfo, setProductInfo] = useState({});
  useEffect(() => {
    if (!products?.length) return;
    let cancelled = false;
    (async () => {
      // Concurrence limitée pour ne pas surcharger /api/product-image.
      const queue = [...products];
      const CONCURRENCY = 3;
      async function worker() {
        while (queue.length && !cancelled) {
          const p = queue.shift();
          try {
            const r = await fetch(`/api/product-image?q=${encodeURIComponent(p.query)}`);
            const d = await r.json();
            if (cancelled) return;
            setProductInfo((prev) => ({
              ...prev,
              [p.query]: { imageUrl: d?.imageUrl || null, price: d?.price || null }
            }));
          } catch {
            if (cancelled) return;
            setProductInfo((prev) => ({
              ...prev,
              [p.query]: { imageUrl: null, price: null }
            }));
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    })();
    return () => { cancelled = true; };
  }, [products]);

  if (!safeTopic) return null;

  function handleProductClick(query) {
    fire("product_clicked", { name: query, source: "topic-popup-product" });
    onClose?.();
  }
  function handleSourceClick(name) {
    fire("article_source_clicked", { name: safeTopic, source: name });
    onClose?.();
  }

  return (
    <div
      className="topic-popup-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      data-file="TopicPopup.jsx"
    >
      <div className="topic-popup" role="dialog" aria-modal="true">
        <button
          type="button"
          className="topic-popup-close"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
        >×</button>

        <header className="topic-popup-head">
          <span className="topic-popup-eyebrow">about</span>
          <h3>{safeTopic}</h3>
        </header>

        <div className="topic-popup-body">
          {/* LEFT — 5 produits Amazon liés au topic */}
          <section className="topic-popup-col topic-popup-col-products">
            <h4 className="topic-popup-col-title">Shop the topic</h4>
            <ul className="topic-popup-list">
              {products.map((p) => {
                const info = productInfo[p.query] || {};
                const img = info.imageUrl;
                const price = info.price;
                return (
                  <li className="topic-popup-product" key={p.query}>
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleProductClick(p.query)}
                      aria-label={`Shop ${p.query} on Amazon`}
                    >
                      <div className={`topic-popup-product-photo${img ? " has-image" : ""}`}>
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="topic-popup-product-fallback" aria-hidden="true">
                            {/* placeholder en attendant le scrape */}
                          </span>
                        )}
                      </div>
                      <div className="topic-popup-product-info">
                        <span className="topic-popup-product-desc">
                          {safeTopic} — {p.desc}
                        </span>
                        <span className="topic-popup-product-price">
                          {price || "see on Amazon"}
                        </span>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* RIGHT — 5 sources presse, chacune lien direct vers le site */}
          <section className="topic-popup-col topic-popup-col-sources">
            <h4 className="topic-popup-col-title">Read about it</h4>
            <ul className="topic-popup-list">
              {sources.map((s, i) => (
                <li className="topic-popup-source" key={i}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleSourceClick(s.name)}
                    aria-label={`Read about ${safeTopic} on ${s.name}`}
                  >
                    <span className="topic-popup-source-name">{s.name}</span>
                    <span className="topic-popup-source-tagline">{s.tagline}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
