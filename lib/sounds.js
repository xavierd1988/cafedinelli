// Petits sons synthétisés via Web Audio API — pas de fichiers audio externes.
// Mute persisté en localStorage, partagé entre composants via custom event.

const STORAGE_KEY = "cafe-sound-muted";
const MUTE_EVENT = "cafe-sound-muted-change";

let audioCtx = null;
let muted = false;

if (typeof window !== "undefined") {
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* private browsing : on garde muted = false */
  }
}

function ensureCtx() {
  if (audioCtx) return audioCtx;
  if (typeof window === "undefined") return null;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  } catch {
    return null;
  }
  return audioCtx;
}

function playTone(freq, duration, volume, type = "sine") {
  if (muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  // iOS verrouille AudioContext jusqu'au premier user gesture — on resume.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch {
    /* silencieux */
  }
}

// Tinte rapide quand un seat parle (cliquetis de verre).
export function playSeatChime() {
  playTone(880, 0.18, 0.06, "triangle");
}

// Mike répond : 2 notes plus chaudes (raclement de gorge musical).
export function playMikeChime() {
  playTone(420, 0.16, 0.06, "sine");
  setTimeout(() => playTone(560, 0.2, 0.06, "sine"), 110);
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {}
    window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: muted }));
  }
}

export function subscribeMuted(handler) {
  if (typeof window === "undefined") return () => {};
  const wrapped = (e) => handler(!!e.detail);
  window.addEventListener(MUTE_EVENT, wrapped);
  return () => window.removeEventListener(MUTE_EVENT, wrapped);
}
