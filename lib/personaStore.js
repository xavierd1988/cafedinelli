// Persona / wardrobe + sit time : préférences locales par device, persistées
// dans localStorage. Cross-component sync via custom event.

const STORAGE_KEY = "cafe-persona";
const EVENT = "cafe-persona-change";

export const SIT_TIMES = [
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" }
];

export const GENDERS = [
  { value: "m", label: "Homme" },
  { value: "w", label: "Femme" }
];

// 4 options par item, indexées 1..4. Le rendu visuel utilise des classes
// CSS de la forme `wig-${gender}-${index}`, etc. pour styler la silhouette.
export const WARDROBE_OPTIONS = [1, 2, 3, 4];

const DEFAULT = {
  gender: "m",
  wig: 1,
  jacket: 1,
  pants: 1,
  shoes: 1,
  sitTimeSec: 60
};

let state = { ...DEFAULT };
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...DEFAULT, ...parsed };
    }
  } catch {
    /* private browsing / corrupt → on garde DEFAULT */
  }
  loaded = true;
}

export function getPersona() {
  load();
  return { ...state };
}

export function setPersona(patch) {
  load();
  state = { ...state, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...state } }));
  }
}

export function subscribePersona(handler) {
  if (typeof window === "undefined") return () => {};
  const wrapped = (e) => handler({ ...e.detail });
  window.addEventListener(EVENT, wrapped);
  return () => window.removeEventListener(EVENT, wrapped);
}
