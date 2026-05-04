"use client";

import { useLayoutEffect, useState } from "react";

// Hook partagé : calcule le scale de la scène café (1600 × 900 ramené au
// viewport courant) et le retourne. Tous les modules flottants
// (Receipt, WeatherClock, NicknameTag) l'utilisent pour scaler leur transform
// en lockstep avec la scène, donc les proportions restent stables au resize.

export function useSceneScale() {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    function updateScale() {
      const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
      setScale(s);
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return scale;
}
