"use client";

import { useEffect, useRef, useState } from "react";
import {
  getPersona,
  setPersona,
  subscribePersona,
  GENDERS,
  WARDROBE_OPTIONS
} from "../lib/personaStore.js";

// Petit menu engrenage qui s'ouvre depuis la NicknameTag pour régler :
// - sit time (30s / 1min / 2min)
// - gender (homme / femme)
// - wardrobe : wig + jacket + pants + shoes (4 variantes chacun, par gender)

export default function PersonaSettings() {
  const [open, setOpen] = useState(false);
  const [persona, setPersonaState] = useState(getPersona());
  const popRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    setPersonaState(getPersona());
    return subscribePersona(setPersonaState);
  }, []);

  // Click / tap dehors → ferme
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (
        popRef.current?.contains(e.target) ||
        btnRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  function update(patch) {
    setPersona(patch);
  }

  return (
    <div className={`persona-settings${open ? " is-open" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className="persona-cog"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Persona settings"
        title="Persona settings"
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.14 12.94a7.46 7.46 0 0 0 .05-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.6 7.6 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.43h-3.84a.5.5 0 0 0-.5.43l-.36 2.54a7.6 7.6 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.46 7.46 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96a7.6 7.6 0 0 0 1.62.94l.36 2.54a.5.5 0 0 0 .5.43h3.84a.5.5 0 0 0 .5-.43l.36-2.54a7.6 7.6 0 0 0 1.62-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      </button>

      {open && (
        <div ref={popRef} className="persona-pop" role="dialog" aria-label="Persona settings">
          <header className="persona-pop-head">Settings</header>

          <div className="persona-row">
            <span className="persona-row-label">Gender</span>
            <div className="persona-segments">
              {GENDERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`persona-seg${persona.gender === opt.value ? " is-on" : ""}`}
                  onClick={() => update({ gender: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: "wig", label: "Hair" },
            { key: "jacket", label: "Top" },
            { key: "pants", label: "Pants" },
            { key: "shoes", label: "Shoes" }
          ].map(({ key, label }) => (
            <div key={key} className="persona-row">
              <span className="persona-row-label">{label}</span>
              <div className="persona-tiles">
                {WARDROBE_OPTIONS.map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`persona-tile persona-tile-${key} persona-tile-${key}-${persona.gender}-${idx}${persona[key] === idx ? " is-on" : ""}`}
                    onClick={() => update({ [key]: idx })}
                    aria-label={`${label} variant ${idx}`}
                    title={`${label} ${idx}`}
                  >
                    <span className={`persona-swatch persona-swatch-${key}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
