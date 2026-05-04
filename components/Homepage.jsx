"use client";

import { useEffect, useState } from "react";
import CafeScene from "./CafeScene.jsx";
import MobileShell from "./MobileShell.jsx";
import ModuleNameBadge from "./ModuleNameBadge.jsx";
import { NicknameProvider } from "./NicknameContext.jsx";
import NicknameTag from "./NicknameTag.jsx";
import PositionExporter from "./PositionExporter.jsx";
import Receipt from "./Receipt.jsx";
import SecretRoom from "./SecretRoom.jsx";
import SeatsPoller from "./SeatsPoller.jsx";
import SoundManager from "./SoundManager.jsx";
import WeatherClock from "./WeatherClock.jsx";
import { useEditMode } from "../lib/editMode.js";

function computeMode() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  // jour : 10h30 (630 min) → 17h30 (1050 min)
  return minutes >= 630 && minutes < 1050 ? "day" : "night";
}

const seatPositions = [
  { id: 1, x: 700, seatY: 655, footY: 715 },
  { id: 2, x: 820, seatY: 650, footY: 708 },
  { id: 3, x: 940, seatY: 646, footY: 702 },
  { id: 4, x: 1060, seatY: 642, footY: 697 },
  { id: 5, x: 1180, seatY: 638, footY: 692 },
  { id: 6, x: 1300, seatY: 634, footY: 688 }
];

export default function Homepage() {
  const [autoMode, setAutoMode] = useState("night");
  // null = AUTO (suit l'heure), "night" = forcé nuit, "day" = forcé jour
  const [forceMode, setForceMode] = useState(null);
  // Edit mode est runtime, activé via la caisse (clic + tape "7"). Persiste
  // en localStorage. useEditMode est réactif → re-render sur toggle.
  const editMode = useEditMode();

  useEffect(() => {
    setAutoMode(computeMode());
    const id = setInterval(() => setAutoMode(computeMode()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function cycleForceMode() {
    setForceMode((m) => (m === null ? "night" : m === "night" ? "day" : null));
  }

  const mode = forceMode || autoMode;
  // Outils d'édition (badge fichier + bouton save layout) visibles UNIQUEMENT
  // en edit mode. Le reste du temps tout est figé partout (incluant iPad /
  // touch). Pour activer l'edit mode : clic sur la caisse → tape "7".

  return (
    <NicknameProvider>
      <main
        className={`homepage is-${mode}${editMode ? "" : " is-frozen"}`}
        aria-label="Dinelli's Cafe homepage"
        data-file="Homepage.jsx"
      >
        {/* Vue desktop : scène complète + modules flottants. Masquée sur mobile via CSS. */}
        <div className="desktop-shell">
          <CafeScene seats={seatPositions} />
          <Receipt forceMode={forceMode} onCycleForceMode={cycleForceMode} />
          <WeatherClock />
          <NicknameTag />
        </div>
        {/* Vue mobile : newsletter / chat / mike empilés. Masquée sur desktop via CSS. */}
        <MobileShell />
        <SeatsPoller />
        <SoundManager />
        {/* Pièce secrète plein écran. Reste invisible tant que le hotspot
            "secret-room-open" (intérieur de CafeDoor en état ouvert) n'est
            pas cliqué. Top-level pour passer au-dessus de tous les modules. */}
        <SecretRoom />
        {editMode && <ModuleNameBadge />}
        {/* Bouton save : caché en mode figé, visible uniquement en edit mode. */}
        {editMode && <PositionExporter />}
      </main>
    </NicknameProvider>
  );
}
