"use client";

import { useEffect, useState } from "react";
import { getModulePosition } from "../lib/modulePositions.js";
import TopicPopup from "./TopicPopup.jsx";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

const dailyStories = [
  {
    icon: "✊",
    title: "May Day — « Workers Over Billionaires »",
    body: "Près de 500 organisations coordonnent {+750 manifestations} à travers les États-Unis. La National Education Association ({3 M de membres}) appelle à un boycott du travail, de l'école et du shopping."
  },
  {
    icon: "🐎",
    title: "Kentucky Derby ce week-end",
    body: "152ᵉ édition demain à Churchill Downs. Field complet de {20 chevaux}, Renegade favori à {+400}. Couverture NBC/Peacock dès 14h30 EST."
  },
  {
    icon: "🛢️",
    title: "Pétrole & Venezuela",
    body: "Exxon Mobil et ConocoPhillips reconsidèrent leurs investissements vénézuéliens après des années d'évitement, portés par des prix élevés et de nouvelles politiques pro-investisseurs. Équipes techniques déjà sur place."
  },
  {
    icon: "🏛️",
    title: "Shutdown DHS terminé",
    body: "Le Congrès met fin au shutdown record du Department of Homeland Security, permettant aux {240 000 employés} de reprendre leurs missions."
  }
];

const googleTrends = [
  ["Kentucky Derby 2026", "+1 200%", "2M+"],
  ["May Day protests", "+850%", "1,2M"],
  ["Nuggets vs Timberwolves", "+620%", "950K"],
  ["Met Gala 2026 theme", "+540%", "720K"],
  ["Renegade horse odds", "+480%", "580K"],
  ["Mother's Day gifts", "+410%", "1,8M"],
  ["Nikola Jokic stats", "+380%", "510K"],
  ["Euphoria Season 3", "+340%", "690K"],
  ["DHS shutdown end", "+310%", "460K"],
  ["Coachella 2026 weekend 2", "+285%", "540K"],
  ["Sabrina Carpenter tour", "+260%", "480K"],
  ["Beyoncé Met Gala", "+240%", "420K"],
  ["Allergy season pollen", "+220%", "730K"],
  ["Exxon Venezuela", "+205%", "290K"],
  ["Justin Bieber Coachella", "+195%", "380K"],
  ["Cinco de Mayo events", "+185%", "620K"],
  ["Karol G tour", "+170%", "340K"],
  ["NBA playoff bracket", "+155%", "410K"],
  ["Apple Watch Series 11", "+140%", "360K"],
  ["Trump tariffs update", "+130%", "510K"],
  ["Spring travel deals", "+125%", "670K"],
  ["AirPods Pro 3 review", "+118%", "390K"],
  ["Iron Man Lavender Trail", "+110%", "220K"],
  ["Bitcoin ETF inflows", "+105%", "280K"],
  ["Fed rate decision May", "+95%", "310K"]
];

const twitterTrends = [
  ["Jokic", "Performance MVP face aux Wolves", "412K posts"],
  ["#MayDay2026", "Mobilisations « Workers Over Billionaires »", "385K posts"],
  ["Jaden McDaniels", "Défense lock-down sur Murray", "298K posts"],
  ["Nuggets", "Game 6 ce soir à Denver", "274K posts"],
  ["Scott Jennings", "Débat CNN sur les protestations", "218K posts"],
  ["Wolves", "Clutch Edwards en 4ᵉ QT", "196K posts"],
  ["#SmackDown", "Wyatt Sicks vs Kairi storyline", "172K posts"],
  ["Kentucky Derby", "Tirage des post positions", "158K posts"],
  ["White House", "Nouvelle conférence sur l'immigration", "142K posts"],
  ["#WorkersOverBillionaires", "Slogan officiel des cortèges", "128K posts"],
  ["Kairi", "Retour spectaculaire WWE", "115K posts"],
  ["Beyoncé", "Co-chair Met Gala lundi", "102K posts"],
  ["Secret Service", "Renforts à Louisville", "94K posts"],
  ["#FashionIsArt", "Hype dress code Met Gala", "86K posts"],
  ["CJ Allen", "Track & field record NCAA", "72K posts"]
];

const tiktokTrends = [
  ["#MetGala2026", "Recreations costumes & predictions", "3,4B vues"],
  ["#FashionIsArt", "Dress code challenge", "+820% 7j"],
  ["#KentuckyDerby", "Outfits Derby & juleps", "2,1B vues"],
  ["#MapsDance", "Maroon 5 hand-gesture choreo", "1,9B vues"],
  ["#EuphoriaS3", "Edits & outfit recreations", "1,7B vues"],
  ["#ColorHuntChallenge", "Photographier 1 couleur/jour", "+640% 7j"],
  ["#SabrinaCarpenter", "Coachella W2 looks", "1,4B vues"],
  ["#TikTokMadeMeBuyIt", "Mother's Day picks", "1,2B vues"],
  ["#GRWMDerby", "Get Ready With Me hat & dress", "+490% 7j"],
  ["#KarolGTour", "Mañana Será Bonito leg US", "980M vues"],
  ["#YogaPoseChallenge", "Pieds-en-l'air viral", "+420% 7j"],
  ["#MayDayProtest", "Couvertures terrain en direct", "760M vues"],
  ["#MothersDayGifts", "Idées cadeaux dernière minute", "+380% 7j"],
  ["#EspressoDance", "Sabrina Carpenter remix challenge", "680M vues"],
  ["#StorytimeCorporate", "Anecdotes bureau drôles", "+295% 7j"]
];

const youtubeTrends = [
  ["Kentucky Derby 2026 — Post Position Draw", "NBC Sports", "8,2M vues • 1j"],
  ["Sabrina Carpenter — Coachella W2 Full Set", "Coachella", "12,4M vues • 3j"],
  ["Nuggets vs Wolves Game 5 Highlights", "NBA", "6,8M vues • 12h"],
  ["Euphoria S3 Official Trailer", "HBO", "22M vues • 5j"],
  ["May Day 2026 — Live Coverage", "CNN", "3,1M vues • live"],
  ["Justin Bieber — Coachella Comeback", "Coachella", "15,7M vues • 2j"],
  ["MrBeast — $1M Survival Island", "MrBeast", "42M vues • 4j"],
  ["Renegade Kentucky Derby Workout", "Churchill Downs", "2,4M vues • 1j"],
  ["Met Gala 2026 — Theme Reveal", "Vogue", "5,8M vues • 4j"],
  ["Karol G — Mañana Será Bonito Live", "Karol G", "11,2M vues • 3j"],
  ["Kendrick Lamar — New Music Video", "Kendrick Lamar", "28M vues • 6j"],
  ["AirPods Pro 3 Honest Review", "MKBHD", "4,6M vues • 2j"],
  ["GTA 6 Trailer 3 Reaction Mashup", "IGN", "9,3M vues • 3j"],
  ["Mother's Day Gift Guide 2026", "Good Morning America", "2,9M vues • 1j"],
  ["Joe Rogan #2284 — Full Episode", "JRE", "7,5M vues • 2j"]
];

const amazonBest = [
  ["Apple AirPods Pro 3", "Écouteurs sans-fil ANC", "#1 Electronics"],
  ["Stanley Quencher 40oz", "Mug isotherme tendance", "#1 Home & Kitchen"],
  ["Apple Watch Series 11", "GPS 45mm", "#1 Wearables"],
  ["Silonn Countertop Ice Maker", "Glaçons en 6 min", "#1 Appliances"],
  ["Mighty Patch Hero Cosmetics", "Patches anti-acné", "#1 Beauty"],
  ["MAYBESTA Wireless Lavalier Mic", "Micro cravate créateurs", "#1 Musical Instr."],
  ["Mielle Rosemary Mint Hair Oil", "Pousse cheveux", "#1 Haircare"],
  ["Bedsure Duvet Cover Set", "Housse couette king", "#1 Bedding"],
  ["LEGO Creator 3-in-1 Flatbed Truck", "—", "#1 Toys & Games"],
  ["Neutrogena Ultra Sheer SPF 70", "Crème solaire", "#1 Sunscreen"],
  ["DREO Tower Fan 2026", "Ventilateur DC silencieux", "#1 Cooling"],
  ["Shark PowerPro Reveal Plus", "Aspirateur sans-fil", "#1 Vacuums"],
  ["Crocs Classic Clog", "Sabots unisexes", "#1 Clogs"],
  ["Olaplex No. 3 Hair Perfector", "—", "#1 Hair Treat."],
  ["Mother's Day Pop-Up 3D Card", "Carte fleurs", "#1 Greeting Cards"]
];

const amazonMovers = [
  ["Claritin 24-Hour Allergy", "Allergie pollen pic saison", "+4 850%"],
  ["Schylling NeeDoh Squeeze", "Sensory toy viral TikTok", "+3 720%"],
  ["Mother's Day 3D Pop-Up Card", "—", "+2 940%"],
  ["Big Hat Derby Fascinator", "Coiffe Kentucky Derby", "+2 480%"],
  ["Banana Boat Sport SPF 50", "Solaire spray", "+1 920%"],
  ["Mint Julep Cup Set", "Verres en étain x4", "+1 650%"],
  ["Jade Roller & Gua Sha Set", "Beauté Mother's Day", "+1 380%"],
  ["2026-2027 Academic Planner", "Office", "+1 220%"],
  ["OLLY Multivitamin Gummies", "Suppléments femmes", "+1 080%"],
  ["Glitter Dumpling Squishy Toy", "TikTok kids", "+945%"],
  ["Tower Fan DREO 42\"", "Premier coup chaud", "+820%"],
  ["Cinco de Mayo Decor Pack", "—", "+730%"],
  ["Bridgestone Bicycle Tire Tube", "Vélo printemps", "+640%"],
  ["Pashmina Silk Scarf", "Met Gala inspired", "+580%"],
  ["Solo Stove Mesa Tabletop", "Patio fire pit", "+510%"]
];

const insights = [
  {
    icon: "🏆",
    title: "Triple convergence sportive ce week-end",
    body: "Kentucky Derby (J-1), Game 6 NBA Nuggets-Wolves ce soir, et Met Gala lundi. Les recherches « Derby + Met Gala » génèrent {+1 200% combiné} et tirent l'e-commerce mode (fascinators +2 480%, scarves +580%)."
  },
  {
    icon: "🌸",
    title: "Pic allergie = pic conso santé",
    body: "Claritin explose à {+4 850%} sur Movers & Shakers — signal saisonnier classique mais 2× plus fort qu'en mai 2025. À coupler avec sunscreen (+1 920%) et OLLY vitamines (+1 080%) pour un cluster wellness printemps clair."
  },
  {
    icon: "✊",
    title: "May Day politise les flux",
    body: "#MayDay2026 cumule {385K posts X} et 760M vues TikTok en 24h. NEA (3M membres) en orchestrateur central — la mobilisation enseignante structure l'agenda médiatique vendredi-samedi."
  },
  {
    icon: "💐",
    title: "Mother's Day J-9 = sprint final",
    body: "Carte 3D pop-up {+2 940%}, jade roller +1 380%, #MothersDayGifts +380% TikTok. Fenêtre de conversion étroite (livraison Prime J-2) : pic d'achat attendu lundi-mercredi."
  },
  {
    icon: "🎶",
    title: "Coachella W2 prolonge la queue virale",
    body: "Sabrina Carpenter (1,4B vues TikTok), Bieber (15,7M YT), Karol G (980M TikTok) — la trinité headliners continue de rythmer les charts musicaux et alimente {#EspressoDance 680M vues}."
  }
];

// Highlight {tokens} as colored badges in body text
function fireProductClick(label) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("product_clicked", { detail: { name: label } }));
    // Tout clic sur un lien Amazon (inline ou flèche) rétracte le journal
    // sur la droite et fait apparaître le store derrière.
    window.dispatchEvent(new CustomEvent("cafe-shop-mode-change", { detail: { open: true } }));
  } catch {
    /* analytics hook silently ignored */
  }
}

function amazonSearchUrl(query) {
  const q = encodeURIComponent(String(query || "").trim()).replace(/%20/g, "+");
  return `https://www.amazon.com/s?k=${q}`;
}

// Enrichit le HTML brut de la newsletter avec des liens Amazon. Le mail
// reçu dans Redis est du HTML "tel quel" (souvent sans <a> sur les noms
// de produits). On parcourt les text nodes et, pour chaque produit du
// jour qui apparaît littéralement dans le texte, on remplace la première
// occurrence par <a href="amazon..."> autour du nom. Pas de match dans
// les <a> déjà présents, ni dans <script> / <style>. SSR-safe (no-op si
// pas de window/DOMParser).
function enrichHtmlWithProductLinks(html, products) {
  if (!html || !Array.isArray(products) || products.length === 0) return html;
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  // Pour chaque produit on génère plusieurs variantes de matching :
  // 1) le nom complet (ex: "Apple AirPods Pro 3")
  // 2) le nom sans le numéro / version final (ex: "Apple AirPods Pro")
  // 3) le bigramme principal (ex: "AirPods Pro") si pertinent
  // 4) le mot le plus distinctif (le plus long mot >=5 chars, ex: "AirPods")
  // Les stop-words communs sont exclus des variantes courtes.
  const STOPWORDS = new Set([
    "the", "a", "an", "of", "and", "with", "for", "to", "in", "on",
    "set", "kit", "pack", "box", "bag", "case",
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "avec"
  ]);
  function makeVariants(name) {
    const variants = new Set();
    const trimmed = name.trim();
    if (trimmed.length >= 3) variants.add(trimmed);
    const tokens = trimmed.split(/\s+/);
    // Sans le dernier token s'il est petit (numéro / version)
    if (tokens.length > 2 && tokens[tokens.length - 1].length <= 3) {
      variants.add(tokens.slice(0, -1).join(" "));
    }
    // Bigrammes "significatifs" (les 2 mots du milieu si >= 4 chars chacun)
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i];
      const b = tokens[i + 1];
      if (a.length >= 4 && b.length >= 3 && !STOPWORDS.has(a.toLowerCase()) && !STOPWORDS.has(b.toLowerCase())) {
        variants.add(`${a} ${b}`);
      }
    }
    // Mot le plus long (>=5 chars, pas un stopword) → souvent le plus
    // distinctif (ex: "AirPods" dans "Apple AirPods Pro 3")
    let longest = "";
    for (const t of tokens) {
      const clean = t.replace(/[^A-Za-zÀ-ÿ0-9]/g, "");
      if (clean.length >= 5 && !STOPWORDS.has(clean.toLowerCase()) && clean.length > longest.length) {
        longest = clean;
      }
    }
    if (longest) variants.add(longest);
    return Array.from(variants);
  }

  // Aplatit en {variant, product} pour pouvoir trier par longueur DESC
  // global : un long nom complet a priorité sur un mot seul.
  const matchers = [];
  for (const p of products) {
    if (!p || typeof p.name !== "string" || p.name.length < 3) continue;
    for (const v of makeVariants(p.name)) {
      matchers.push({ variant: v, product: p });
    }
  }
  matchers.sort((a, b) => b.variant.length - a.variant.length);
  if (matchers.length === 0) return html;

  // Suit lesquels ont déjà été linkés — un produit n'est wrappé qu'une seule
  // fois dans toute la newsletter, pour éviter une mer de liens identiques.
  const linkedNames = new Set();

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function walk(node) {
    if (node.nodeType === 3) {
      // Text node
      const text = node.nodeValue;
      if (!text || text.trim().length === 0) return;
      for (const { variant, product } of matchers) {
        if (linkedNames.has(product.name)) continue;
        const re = new RegExp(`\\b${escapeRegex(variant)}\\b`, "i");
        const m = text.match(re);
        if (!m) continue;
        // Split en 3 : avant / match / après
        const before = text.slice(0, m.index);
        const after = text.slice(m.index + m[0].length);
        const a = doc.createElement("a");
        a.href = product.amazonUrl || amazonSearchUrl(product.name);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "paper-link";
        a.setAttribute("data-product-name", product.name);
        a.textContent = m[0];
        const parent = node.parentNode;
        if (before) parent.insertBefore(doc.createTextNode(before), node);
        parent.insertBefore(a, node);
        if (after) {
          const tailNode = doc.createTextNode(after);
          parent.insertBefore(tailNode, node);
          parent.removeChild(node);
          linkedNames.add(product.name);
          // Le reste pourra encore matcher d'AUTRES produits dans `after`
          walk(tailNode);
          return;
        }
        parent.removeChild(node);
        linkedNames.add(product.name);
        return;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "a" || tag === "script" || tag === "style" || tag === "code") return;
    const children = Array.from(node.childNodes);
    for (const c of children) walk(c);
  }

  walk(root);

  // Injection d'un bouton "Buy it" à droite de chaque ligne des tables
  // Amazon Top 15 (best sellers + movers). On repère les <h2> contenant
  // "AMAZON" et on accroche un <td> bouton à la fin de chaque <tr> du
  // tableau qui suit. Idempotent : skip si déjà injecté.
  const headers = root.querySelectorAll("h2, h3, h4");
  headers.forEach((h) => {
    if (!/amazon/i.test(h.textContent || "")) return;
    let next = h.nextElementSibling;
    while (next && next.tagName !== "TABLE") next = next.nextElementSibling;
    if (!next) return;
    next.querySelectorAll("tr").forEach((tr) => {
      if (tr.querySelector(".paper-buy-it-injected")) return;
      const strong = tr.querySelector("strong");
      const keyword = (strong?.textContent || "").trim();
      if (!keyword) return;
      const a = doc.createElement("a");
      a.className = "paper-buy-it-injected";
      a.href = amazonSearchUrl(keyword);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Buy it";
      a.setAttribute("data-product-name", keyword);
      // On l'insère ENTRE la cellule produit et la cellule catégorie :
      // nouvelle <td> placée avant la dernière <td> de la rangée.
      const td = doc.createElement("td");
      td.style.cssText = "padding:6px 8px; vertical-align:middle; white-space:nowrap; text-align:center;";
      td.appendChild(a);
      const cells = tr.querySelectorAll(":scope > td");
      const lastTd = cells[cells.length - 1];
      if (lastTd) {
        tr.insertBefore(td, lastTd);
      } else {
        tr.appendChild(td);
      }
    });
  });

  // === Pass topic-link ====================================================
  // Wrap every <strong> et la cellule "topic" des tableaux ranked dans un
  // <a class="paper-topic-link">. ATTENTION : on EXCLUT les tables
  // Amazon (Top 15 best sellers, Movers & Shakers) qui ont déjà leur
  // bouton Buy-it injecté → pas besoin de les transformer en topic-links.
  function wrapAsTopicLink(node, topicText) {
    const text = (topicText || node.textContent || "").trim();
    if (text.length < 2) return;
    if (node.querySelector("a") || node.closest("a")) return;
    const a = doc.createElement("a");
    a.className = "paper-topic-link";
    a.href = `https://news.google.com/search?q=${encodeURIComponent(text)}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    while (node.firstChild) a.appendChild(node.firstChild);
    node.appendChild(a);
  }

  // Collecte des tables Amazon (celles qui suivent un header "AMAZON ...").
  // On les exclut du topic-link wrap pour ne pas dupliquer l'UX avec le
  // bouton Buy-it qu'on a déjà injecté plus haut.
  const amazonTables = new Set();
  headers.forEach((h) => {
    if (!/amazon/i.test(h.textContent || "")) return;
    let next = h.nextElementSibling;
    while (next && next.tagName !== "TABLE") next = next.nextElementSibling;
    if (next) amazonTables.add(next);
  });
  function isInAmazonTable(node) {
    let p = node.parentNode;
    while (p) {
      if (amazonTables.has(p)) return true;
      p = p.parentNode;
    }
    return false;
  }

  // 1) Bold tags : titres et noms saillants ("Cinco de Mayo", "Hegseth", ...)
  root.querySelectorAll("strong").forEach((strong) => {
    if (isInAmazonTable(strong)) return;
    wrapAsTopicLink(strong);
  });

  // 2) Cellules "topic" des tables ranked NON-Amazon : 2e <td> d'un <tr>
  //    dont le 1er <td> est un numéro ("1.", "2.", "12.").
  root.querySelectorAll("tr").forEach((tr) => {
    if (isInAmazonTable(tr)) return;
    const cells = tr.querySelectorAll(":scope > td");
    if (cells.length < 2) return;
    const firstText = (cells[0].textContent || "").trim();
    if (!/^\d{1,3}\.?$/.test(firstText)) return;
    const second = cells[1];
    if (second.querySelector("a")) return;
    // On marque le <tr> pour pouvoir styler la ligne entière en hover.
    tr.classList.add("paper-topic-row");
    wrapAsTopicLink(second);
  });

  return root.innerHTML;
}

// Chaque mot/expression mis en {accolades} dans le body devient un lien
// inline vers Amazon — c'est la couche commerciale discrète directement
// dans le texte de la newsletter, sans CTA séparée.
function HighlightedBody({ text }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("{") && part.endsWith("}") ? (
          <a
            key={i}
            className="paper-badge paper-link"
            href={amazonSearchUrl(part.slice(1, -1))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireProductClick(part.slice(1, -1))}
          >
            {part.slice(1, -1)}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function isPositiveDelta(s) {
  return typeof s === "string" && s.startsWith("+");
}

function MetricBadge({ value }) {
  if (!value) return null;
  const positive = isPositiveDelta(value);
  return <span className={`paper-metric${positive ? " is-up" : ""}`}>{value}</span>;
}

// Petite flèche posée à droite de chaque ligne ranked. C'est le "Buy it"
// version inline : on clique → onglet Amazon vers le keyword.
function BuyArrow({ keyword }) {
  return (
    <a
      className="paper-buy-arrow"
      href={amazonSearchUrl(keyword)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => fireProductClick(keyword)}
      aria-label={`Buy it — ${keyword}`}
      title="Buy it"
    >
      →
    </a>
  );
}

function RankedList({ rows, kind }) {
  return (
    <ol className="paper-list">
      {rows.map((row, index) => {
        const keyword = row[0];
        return (
          <li className="paper-list-row" key={index}>
            <span className="paper-rank">{index + 1}</span>
            {kind === "google" ? (
              <>
                <a
                  className="paper-list-label paper-link"
                  href={amazonSearchUrl(keyword)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireProductClick(keyword)}
                >
                  {keyword}
                </a>
                <span className="paper-list-meta">
                  <MetricBadge value={row[1]} />
                  <span className="paper-list-volume">{row[2]}</span>
                  <BuyArrow keyword={keyword} />
                </span>
              </>
            ) : kind === "amazonBest" ? (
              <>
                <span className="paper-list-label">
                  <a
                    className="paper-link"
                    href={amazonSearchUrl(keyword)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => fireProductClick(keyword)}
                  ><strong>{keyword}</strong></a>
                  {row[1] !== "—" && <em> — {row[1]}</em>}
                </span>
                <span className="paper-list-meta">
                  <span className="paper-rank-tag">{row[2]}</span>
                  <BuyArrow keyword={keyword} />
                </span>
              </>
            ) : kind === "movers" ? (
              <>
                <span className="paper-list-label">
                  <a
                    className="paper-link"
                    href={amazonSearchUrl(keyword)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => fireProductClick(keyword)}
                  ><strong>{keyword}</strong></a>
                  {row[1] !== "—" && <em> — {row[1]}</em>}
                </span>
                <span className="paper-list-meta">
                  <MetricBadge value={row[2]} />
                  <BuyArrow keyword={keyword} />
                </span>
              </>
            ) : (
              <>
                <span className="paper-list-label">
                  <a
                    className="paper-link"
                    href={amazonSearchUrl(keyword)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => fireProductClick(keyword)}
                  ><strong>{keyword}</strong></a>
                  {row[1] && <em> — {row[1]}</em>}
                </span>
                <span className="paper-list-meta">
                  <span className="paper-list-volume">{row[2]}</span>
                  <BuyArrow keyword={keyword} />
                </span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const sections = [
  { id: "actu", icon: "📰", color: "red", title: "Actualité du jour", kind: "stories", data: dailyStories },
  { id: "google", icon: "🇺🇸", color: "blue", title: "Google Trends USA — Top 25", kind: "google", data: googleTrends },
  { id: "twitter", icon: "🐦", color: "sky", title: "X / Twitter Trends USA — Top 15", kind: "twitter", data: twitterTrends },
  { id: "tiktok", icon: "🎵", color: "pink", title: "TikTok Trends — Top 15", kind: "tiktok", data: tiktokTrends },
  { id: "youtube", icon: "▶️", color: "red", title: "YouTube Trends USA — Top 15", kind: "youtube", data: youtubeTrends },
  { id: "amazon", icon: "🛒", color: "amber", title: "Amazon Best Sellers — Top 15", kind: "amazonBest", data: amazonBest },
  { id: "movers", icon: "📈", color: "green", title: "Amazon Movers & Shakers — Top 15", kind: "movers", data: amazonMovers }
];

const MIN_WIDTH = 360;
const MIN_HEIGHT = 280;

export default function PaperPanel() {
  const init = getModulePosition("PaperPanel");
  const [offset, setOffset] = useState(init.offset);
  const [size, setSize] = useState(init.size);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  // Shop mode : clic sur "Buy it" → le journal slide vers la droite (et
  // descend en z-index pour passer derrière le bar) ; l'étagère du store
  // (rendue dans Homepage) apparaît dans la zone restée libre.
  const [shopMode, setShopMode] = useState(false);
  function openShelf(slug) {
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("buy_it_clicked", {
          detail: { article: slug || null }
        }));
      } catch {}
    }
    setShopMode(true);
  }
  // Sync sortant : on broadcast les changements de shop mode pour que le
  // LeftBuilding (vitrines de produits) puisse réagir.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(new CustomEvent("cafe-shop-mode-change", {
        detail: { open: shopMode, source: "paper" }
      }));
    } catch {}
  }, [shopMode]);
  // Sync entrant : tout clic sur un lien Amazon (inline ou flèche) re-
  // dispatche cet event pour rétracter le journal vers la droite. On
  // ignore les events qu'on a nous-même émis (source: "paper") pour ne
  // pas créer de boucle.
  useEffect(() => {
    function onChange(e) {
      if (e.detail?.source === "paper") return;
      const open = !!e.detail?.open;
      setShopMode((prev) => (prev === open ? prev : open));
    }
    window.addEventListener("cafe-shop-mode-change", onChange);
    return () => window.removeEventListener("cafe-shop-mode-change", onChange);
  }, []);
  useEffect(() => {
    function onClose() { setShopMode(false); }
    window.addEventListener("cafe-shop-mode-close", onClose);
    return () => window.removeEventListener("cafe-shop-mode-close", onClose);
  }, []);
  const [newsletter, setNewsletter] = useState(null);
  const [products, setProducts] = useState([]);
  // Popup ouvert quand on clique sur un lien non-Amazon dans la newsletter.
  // null si fermé. { topic, articleHref } si ouvert.
  const [topicPopup, setTopicPopup] = useState(null);

  // Charge la newsletter du jour (postée par le script automatique).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/newsletter")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setNewsletter(data?.newsletter || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge les 30 produits du jour pour pouvoir injecter des liens Amazon
  // dans le texte HTML de la newsletter (même logique que LeftBuilding).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.products)) setProducts(data.products);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Newsletter HTML enrichi de liens Amazon autour des produits du jour.
  // Recalculé seulement quand la newsletter ou la liste produits change.
  const enrichedNewsletterHtml = newsletter?.html
    ? enrichHtmlWithProductLinks(newsletter.html, products)
    : null;

  function getScale() {
    return Math.min(window.innerWidth / 1600, window.innerHeight / 900) || 1;
  }

  function handleDragStart(e) {
    // EXCEPTION : le PaperPanel (Trend Summary) reste draggable même en
    // mode figé. Le visiteur peut déplacer la newsletter pour la lire à
    // l'aise — c'est le seul module qui survit au gel global.
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("module-click", { detail: "PaperPanel (Résumé Tendances)" }));
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const startOffset = { ...offset };
    const scale = getScale();

    setDragging(true);

    function handleMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setOffset({ x: startOffset.x + dx, y: startOffset.y + dy });
    }

    function handleUp() {
      setDragging(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function handleResizeStart(e) {
    // Resize toujours actif — exception explicite au gel global.
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = { ...size };
    const scale = getScale();

    setResizing(true);

    function handleMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setSize({
        width: Math.max(MIN_WIDTH, startSize.width + dx),
        height: Math.max(MIN_HEIGHT, startSize.height + dy)
      });
    }

    function handleUp() {
      setResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  // Slide quasi total moins 2mm (~7.56px) pour laisser un peu de
  // paper visible à droite.
  const SHOP_SLIDE_X = Math.max(900, size.width) - 7.56;
  const composedX = offset.x + (shopMode ? SHOP_SLIDE_X : 0);

  return (
    <section
      className={
        `paper-panel` +
        (resizing ? " is-resizing" : "") +
        (dragging ? " is-dragging" : "") +
        (shopMode ? " is-shop-mode" : "")
      }
      id="the-paper"
      aria-labelledby="paper-title"
      data-file="PaperPanel.jsx"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate(${composedX}px, ${offset.y}px)`
      }}
    >
      {/* Patte verticale qui dépasse à gauche du paper. Composée de deux
          zones empilées :
            - haut : poignée de drag (déplacement libre du journal),
            - bas  : flèche toggle qui envoie/ramène le paper en position A/B. */}
      <div className={`paper-shop-toggle${shopMode ? " is-on" : ""}`}>
        <div
          className="paper-shop-toggle-drag"
          onPointerDown={handleDragStart}
          aria-label="Drag the paper"
          title="Drag"
        >
          <span aria-hidden="true">≡</span>
        </div>
        <button
          type="button"
          className="paper-shop-toggle-arrow"
          onClick={() => {
            if (shopMode) {
              setShopMode(false);
              try { window.dispatchEvent(new CustomEvent("back_to_paper_clicked")); } catch {}
            } else {
              openShelf("toggle");
            }
          }}
          aria-label={shopMode ? "Back to the paper (position A)" : "Send the paper to the right (position B)"}
          title={shopMode ? "Back to the paper" : "Send to position B"}
        >
          <span aria-hidden="true">{shopMode ? "←" : "→"}</span>
        </button>
      </div>

      <header
        className={`paper-masthead paper-drag-handle${dragging ? " is-dragging" : ""}`}
        onPointerDown={handleDragStart}
      >
        <div className="paper-masthead-capsule">
          <span className="paper-masthead-emoji">📊</span>
          <div>
            <h2 id="paper-title">{newsletter?.subject || "Résumé Tendances"}</h2>
            <p className="paper-date">
              {newsletter ? formatDate(newsletter.date) : "Vendredi 1 mai 2026"}
            </p>
            <p className="paper-meta">
              {newsletter
                ? `Newsletter du jour • reçue ${formatDate(newsletter.receivedAt)}`
                : "Édition complète • USA • Collecte 10h30"}
            </p>
          </div>
          <span className="paper-drag-hint" aria-hidden="true">✥</span>
        </div>
      </header>

      <div className="paper-scroll">
        <div className="paper-scroll-content">
        {newsletter ? (
          <div
            className="paper-newsletter-html"
            dangerouslySetInnerHTML={{ __html: enrichedNewsletterHtml || newsletter.html }}
            onClick={(e) => {
              // RÈGLES de clic dans la newsletter :
              //   1. Lien Amazon (amazon.com / amzn.to) ou produit Buy-it
              //      injecté → on rétracte le journal et on surligne le
              //      produit dans la vitrine. Pas de popup, pas
              //      d'ouverture directe d'Amazon (le visiteur clique
              //      ensuite sur la case rouge dans le shop pour ouvrir
              //      Amazon).
              //   2. Lien non-Amazon (article source : NBC, Vogue, CNN,
              //      etc.) → on ouvre la TopicPopup avec 5 photos liées
              //      au topic + un bouton vers l'article original.
              const link = e.target.closest && e.target.closest("a");
              if (link) {
                e.preventDefault();
                e.stopPropagation();
                const href = link.href || "";

                // Le bouton "Buy it" injecté (paper-buy-it-injected) est
                // le SEUL lien qui déclenche le retract + highlight de
                // produit. Tout le reste (topics enrichis, liens email
                // bruts, etc.) ouvre la TopicPopup.
                if (link.classList.contains("paper-buy-it-injected")) {
                  const name = (link.getAttribute("data-product-name") || link.textContent || "").trim().slice(0, 120);
                  try {
                    window.dispatchEvent(new CustomEvent("product_clicked", { detail: { name, source: "newsletter-buy-it" } }));
                    window.dispatchEvent(new CustomEvent("cafe-shop-mode-change", { detail: { open: true } }));
                    window.dispatchEvent(new CustomEvent("cafe-highlight-product", { detail: { name } }));
                  } catch {}
                  return;
                }

                // Topic ou lien d'article : on ouvre la popup avec
                // 5 photos. Si le href est déjà une recherche Amazon
                // (cas des topics auto-enrichis), on remplace
                // articleHref par Google News pour donner un vrai
                // "source" cliquable au visiteur.
                const topic = (link.textContent || "").trim().slice(0, 120);
                const isAmazon = /amazon\.com|amzn\.to/i.test(href);
                const articleHref = isAmazon
                  ? `https://news.google.com/search?q=${encodeURIComponent(topic)}`
                  : href;
                setTopicPopup({ topic, articleHref });
                return;
              }
              // Clic dans une rangée Amazon (zone texte/pourcentage) sans
              // viser un <a> directement : on dispatche les mêmes events
              // sans simuler de clic sur le <a> (sinon ça ouvrirait Amazon).
              const tr = e.target.closest && e.target.closest("tr");
              if (!tr) return;
              const buyLink = tr.querySelector(".paper-buy-it-injected");
              if (buyLink) {
                e.preventDefault();
                const name = (buyLink.getAttribute("data-product-name") || "").trim();
                try {
                  window.dispatchEvent(new CustomEvent("product_clicked", { detail: { name, source: "newsletter-row" } }));
                  window.dispatchEvent(new CustomEvent("cafe-shop-mode-change", { detail: { open: true } }));
                  window.dispatchEvent(new CustomEvent("cafe-highlight-product", { detail: { name } }));
                } catch {}
                return;
              }
              // Clic dans une rangée "topic" non-Amazon (Top 25 Google,
              // Twitter, TikTok, etc.) hors du <a> direct : on ouvre la
              // popup avec le topic de la 2e cellule.
              if (tr.classList.contains("paper-topic-row")) {
                const topicLink = tr.querySelector(".paper-topic-link");
                if (!topicLink) return;
                e.preventDefault();
                const topic = (topicLink.textContent || "").trim().slice(0, 120);
                const href = topicLink.href || "";
                const articleHref = /amazon\.com|amzn\.to/i.test(href)
                  ? `https://news.google.com/search?q=${encodeURIComponent(topic)}`
                  : href;
                setTopicPopup({ topic, articleHref });
              }
            }}
          />
        ) : (
          <>
            {sections.map((section) => (
          <article className={`paper-card paper-card--${section.color}`} key={section.id}>
            <header className="paper-card-head">
              <span className="paper-card-icon" aria-hidden="true">{section.icon}</span>
              <h3>{section.title}</h3>
            </header>
            {section.kind === "stories" ? (
              <div className="paper-stories">
                {section.data.map((story) => (
                  <div className="paper-story" key={story.title}>
                    <div className="paper-story-head">
                      <span className="paper-story-icon" aria-hidden="true">{story.icon}</span>
                      <strong>{story.title}</strong>
                    </div>
                    <p><HighlightedBody text={story.body} /></p>
                  </div>
                ))}
              </div>
            ) : (
              <RankedList rows={section.data} kind={section.kind} />
            )}
          </article>
        ))}

        <article className="paper-card paper-card--purple paper-card--insights">
          <header className="paper-card-head">
            <span className="paper-card-icon" aria-hidden="true">💡</span>
            <h3>Insights du jour</h3>
          </header>
          <div className="paper-stories">
            {insights.map((insight) => (
              <div className="paper-story" key={insight.title}>
                <div className="paper-story-head">
                  <span className="paper-story-icon" aria-hidden="true">{insight.icon}</span>
                  <strong>{insight.title}</strong>
                </div>
                <p><HighlightedBody text={insight.body} /></p>
              </div>
            ))}
          </div>
        </article>

            <p className="paper-footer">Rapport généré automatiquement • xavier.dinelli@gmail.com</p>
          </>
        )}
        </div>
      </div>
      <div
        className="paper-resize-handle"
        onPointerDown={handleResizeStart}
        aria-label="Redimensionner"
        role="button"
      />

      {/* Popup ouvert au clic sur un lien d'article (non-Amazon) dans la
          newsletter : 5 photos d'un produit Amazon lié au topic + lien
          vers l'article source. */}
      {topicPopup && (
        <TopicPopup
          topic={topicPopup.topic}
          articleHref={topicPopup.articleHref}
          onClose={() => setTopicPopup(null)}
        />
      )}
    </section>
  );
}
