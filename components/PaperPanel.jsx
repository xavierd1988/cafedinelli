"use client";

import { useEffect, useState } from "react";
import { getModulePosition } from "../lib/modulePositions.js";
import { getEditMode } from "../lib/editMode.js";

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
function HighlightedBody({ text }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("{") && part.endsWith("}") ? (
          <span className="paper-badge" key={i}>{part.slice(1, -1)}</span>
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

function RankedList({ rows, kind }) {
  return (
    <ol className="paper-list">
      {rows.map((row, index) => (
        <li className="paper-list-row" key={index}>
          <span className="paper-rank">{index + 1}</span>
          {kind === "google" ? (
            <>
              <span className="paper-list-label">{row[0]}</span>
              <span className="paper-list-meta">
                <MetricBadge value={row[1]} />
                <span className="paper-list-volume">{row[2]}</span>
              </span>
            </>
          ) : kind === "amazonBest" ? (
            <>
              <span className="paper-list-label">
                <strong>{row[0]}</strong>
                {row[1] !== "—" && <em> — {row[1]}</em>}
              </span>
              <span className="paper-rank-tag">{row[2]}</span>
            </>
          ) : kind === "movers" ? (
            <>
              <span className="paper-list-label">
                <strong>{row[0]}</strong>
                {row[1] !== "—" && <em> — {row[1]}</em>}
              </span>
              <MetricBadge value={row[2]} />
            </>
          ) : (
            <>
              <span className="paper-list-label">
                <strong>{row[0]}</strong>
                {row[1] && <em> — {row[1]}</em>}
              </span>
              <span className="paper-list-volume">{row[2]}</span>
            </>
          )}
        </li>
      ))}
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
  const [newsletter, setNewsletter] = useState(null);

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

  function getScale() {
    return Math.min(window.innerWidth / 1600, window.innerHeight / 900) || 1;
  }

  function handleDragStart(e) {
    // Gelé sauf en edit mode runtime — comme tous les autres modules.
    if (!getEditMode()) return;
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
    if (!getEditMode()) return;
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

  return (
    <section
      className={`paper-panel${resizing ? " is-resizing" : ""}`}
      id="the-paper"
      aria-labelledby="paper-title"
      data-file="PaperPanel.jsx"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate(${offset.x}px, ${offset.y}px)`
      }}
    >
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
        {newsletter ? (
          <div
            className="paper-newsletter-html"
            dangerouslySetInnerHTML={{ __html: newsletter.html }}
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
      <div
        className="paper-resize-handle"
        onPointerDown={handleResizeStart}
        aria-label="Redimensionner"
        role="button"
      />
    </section>
  );
}
