"use client";

import { useEffect, useState } from "react";

// Toast temporaire qui affiche le nom du fichier source de l'élément cliqué.
// Walk up DOM en cherchant data-file sur l'élément cliqué ou un parent.
// À retirer une fois les positions figées.
export default function ModuleNameBadge() {
  const [name, setName] = useState("");

  useEffect(() => {
    let timeoutId;

    function showName(label) {
      setName(label);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setName(""), 4000);
    }

    // 1) écoute le custom event (drag de module)
    function customHandler(e) {
      showName(e.detail);
    }

    // 2) écoute tous les clics et remonte chercher data-file
    function clickHandler(e) {
      // ignore les clics sur le badge lui-même
      if (e.target.closest(".module-name-badge")) return;

      let node = e.target;
      while (node && node !== document.body) {
        if (node.dataset && node.dataset.file) {
          showName(node.dataset.file);
          return;
        }
        node = node.parentElement;
      }
    }

    window.addEventListener("module-click", customHandler);
    document.addEventListener("mousedown", clickHandler, true);

    return () => {
      window.removeEventListener("module-click", customHandler);
      document.removeEventListener("mousedown", clickHandler, true);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!name) return null;
  return (
    <div className="module-name-badge" key={name}>
      {name}
    </div>
  );
}
