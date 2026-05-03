"use client";

import { useEffect, useState } from "react";
import AskMikeSign from "./AskMikeSign.jsx";
import CafeScene from "./CafeScene.jsx";
import ModuleNameBadge from "./ModuleNameBadge.jsx";
import NeonSign from "./NeonSign.jsx";
import { NicknameProvider } from "./NicknameContext.jsx";
import NicknameTag from "./NicknameTag.jsx";
import PositionExporter from "./PositionExporter.jsx";
import Receipt from "./Receipt.jsx";
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
  const [forceNight, setForceNight] = useState(false);

  useEffect(() => {
    if (forceNight) return; // pas la peine de poll si overridé
    setAutoMode(computeMode());
    const id = setInterval(() => setAutoMode(computeMode()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [forceNight]);

  const mode = forceNight ? "night" : autoMode;

  return (
    <NicknameProvider>
      <main className={`homepage is-${mode}`} aria-label="Dinelli's Cafe homepage" data-file="Homepage.jsx">
        <CafeScene seats={seatPositions} />
        <Receipt forceNight={forceNight} onToggleForceNight={() => setForceNight((v) => !v)} />
        <WeatherClock />
        <NeonSign />
        <NicknameTag />
        <AskMikeSign />
        <ModuleNameBadge />
        <PositionExporter />
      </main>
    </NicknameProvider>
  );
}
