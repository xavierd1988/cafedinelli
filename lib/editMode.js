"use client";

// Master switch runtime : tout le drag/resize/rotate est gelé tant que ce
// flag est à false. Activation explicite via la caisse-enregistreuse :
// clic sur la caisse → keypad → tape "7" → toggle edit mode.
//
// Persiste en localStorage pour survivre aux reloads. Les composants qui
// rendent en fonction du mode utilisent `useEditMode()` (réactif). Les
// callbacks (event handlers) lisent simplement `EDIT_MODE` qui est une
// live binding ES modules — ils voient la valeur courante au moment du
// click, sans re-render nécessaire.

import { useEffect, useState } from "react";

const STORAGE_KEY = "cafe-edit-mode";

let _editMode = false;
const listeners = new Set();

// Bootstrap depuis localStorage côté browser uniquement.
if (typeof window !== "undefined") {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      _editMode = true;
    }
  } catch {
    // localStorage indisponible (private mode, sandbox) — on reste à false.
  }
}

export function getEditMode() {
  return _editMode;
}

export function setEditMode(v) {
  const next = !!v;
  if (next === _editMode) return;
  _editMode = next;
  if (typeof window !== "undefined") {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  listeners.forEach((cb) => {
    try {
      cb(next);
    } catch {
      // listener cassé — on continue.
    }
  });
}

export function toggleEditMode() {
  setEditMode(!_editMode);
}

function subscribeEditMode(cb) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Hook React réactif — pour les composants qui rendent différemment selon
// le mode (Homepage gate de PositionExporter, etc.). Re-render auto sur
// chaque toggle.
//
// IMPORTANT : on initialise systématiquement à `false` pour que le 1er
// render côté CLIENT match le HTML SSR (qui n'a pas accès à localStorage,
// donc rend toujours editMode=false / is-frozen). Sinon Next.js throw une
// "Hydration mismatch" et bloque tout. La vraie valeur (depuis localStorage
// via _editMode bootstrap) est appliquée juste après mount via useEffect.
export function useEditMode() {
  const [v, setV] = useState(false);
  useEffect(() => {
    setV(_editMode);
    return subscribeEditMode(setV);
  }, []);
  return v;
}

// Live binding ES module : les imports `EDIT_MODE` voient la valeur
// courante à chaque accès. Suffit pour les checks dans les event handlers
// (pointerdown/pointerup/etc.) qui s'exécutent au moment du click.
export { _editMode as EDIT_MODE };
