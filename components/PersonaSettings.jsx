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
    <div className="persona-settings">
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
        ⚙
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
