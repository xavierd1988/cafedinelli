"use client";

import { useEffect, useState } from "react";
import CafeScene from "./CafeScene.jsx";
import MobileShell from "./MobileShell.jsx";
import ModuleNameBadge from "./ModuleNameBadge.jsx";
import NeonSign from "./NeonSign.jsx";
import { NicknameProvider } from "./NicknameContext.jsx";
import NicknameTag from "./NicknameTag.jsx";
import PositionExporter from "./PositionExporter.jsx";
import Receipt from "./Receipt.jsx";
import SeatsPoller from "./SeatsPoller.jsx";
import WeatherClock from "./WeatherClock.jsx";

function computeMode() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  // jour : 10h30 (630 min) → 17h30 (1050 min)
  return minutes >= 630 && minutes < 1050 ? "day" : "night";
}

const seatPositions = [
  { id: 1, x: 700, seatY: 655, footY: 715 },
  { id: 2, x: 820, seatY: 650, footY: 708, nickname: "window seat",
    message: "Searches are all recipes, rate cuts, and rain before 8." },
  { id: 3, x: 940, seatY: 646, footY: 702 },
  { id: 4, x: 1060, seatY: 642, footY: 697 },
  { id: 5, x: 1180, seatY: 638, footY: 692, nickname: "early reader",
    message: "Everyone is talking softly about the same three headlines." },
  { id: 6, x: 1300, seatY: 634, footY: 688 }
];

export default function Homepage() {
  const [autoMode, setAutoMode] = useState("night");
  // null = AUTO (suit l'heure), "night" = forcé nuit, "day" = forcé jour
  const [forceMode, setForceMode] = useState(null);

  useEffect(() => {
    setAutoMode(computeMode());
    const id = setInterval(() => setAutoMode(computeMode()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function cycleForceMode() {
    setForceMode((m) => (m === null ? "night" : m === "night" ? "day" : null));
  }

  const mode = forceMode || autoMode;
  // Outils de dev (badge "fichier au clic" + bouton export positions) :
  // visibles uniquement avec `npm run dev`. Strippés du bundle prod par Next.
  const isDev = process.env.NODE_ENV === "development";

  return (
    <NicknameProvider>
      <main
        className={`homepage is-${mode}${isDev ? "" : " is-frozen"}`}
        aria-label="Dinelli's Cafe homepage"
        data-file="Homepage.jsx"
      >
        {/* Vue desktop : scène complète + modules flottants. Masquée sur mobile via CSS. */}
        <div className="desktop-shell">
          <CafeScene seats={seatPositions} />
          <Receipt forceMode={forceMode} onCycleForceMode={cycleForceMode} />
          <WeatherClock />
          <NeonSign />
          <NicknameTag />
        </div>
        {/* Vue mobile : newsletter / chat / mike empilés. Masquée sur desktop via CSS. */}
        <MobileShell />
        <SeatsPoller />
        {isDev && <ModuleNameBadge />}
        {isDev && <PositionExporter />}
      </main>
    </NicknameProvider>
  );
}
