"use client";

import { useEffect, useRef, useState } from "react";
import { useNickname } from "./NicknameContext.jsx";
import { isMuted, setMuted, subscribeMuted } from "../lib/sounds.js";
import { trackEvent } from "../lib/analytics.js";

const MIKE_MENTION = /(^|[^a-z])mike\b|@mike/i;
const RECENT_LOCAL_TTL_MS = 6000;

// Codes météo WMO → icône emoji
const WMO_ICONS = {
  0: "☀", 1: "🌤", 2: "⛅", 3: "☁",
  45: "🌫", 48: "🌫",
  51: "🌦", 53: "🌦", 55: "🌦",
  61: "🌧", 63: "🌧", 65: "🌧",
  71: "❄", 73: "❄", 75: "❄", 77: "❄",
  80: "🌧", 81: "🌧", 82: "⛈",
  95: "⛈", 96: "⛈", 99: "⛈"
};

export default function MobileShell() {
  const { nickname, setNickname } = useNickname();
  const [nickDraft, setNickDraft] = useState("");
  const [newsletter, setNewsletter] = useState(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [mikeQ, setMikeQ] = useState("");
  const [mikeBusy, setMikeBusy] = useState(false);
  const [mikeOpen, setMikeOpen] = useState(false);
  const [mikeThread, setMikeThread] = useState(null);
  // Si l'utilisateur ferme une sheet d'un thread dont il n'est pas le starter,
  // on retient l'id pour ne pas rouvrir auto à chaque poll. Reset quand un
  // nouveau thread démarre (id différent).
  const dismissedThreadIdRef = useRef(null);
  const [balloons, setBalloons] = useState([]);

  // Radio FIP
  const audioRef = useRef(null);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioTrack, setRadioTrack] = useState(null);

  // Pour ignorer les anciens messages qui arrivent au premier poll
  // (sinon une montgolfière par message historique = bordel visuel).
  const seenTimestampsRef = useRef(new Set());
  const initializedRef = useRef(false);
  // Une seule silhouette par IP — on garde le siège attribué au premier post
  // pour éviter des 409 sur les posts suivants (sinon le random pickerait
  // un autre siège et le serveur refuserait).
  const myStickySeatRef = useRef(null);
  // Dédup par contenu pour les messages qu'on vient d'envoyer localement :
  // le serveur leur donne un timestamp légèrement différent du Date.now()
  // client, donc le poll les redétecterait sinon comme nouveaux.
  const recentLocalRef = useRef(new Map()); // `${nick}|${msg}` → ts

  // Météo (Open-Meteo, géolocalisée, fallback NYC)
  const [weather, setWeather] = useState(null);

  // Mute du son d'ambiance (chimes seats + Mike). Persistant via localStorage.
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    setMutedState(isMuted());
    return subscribeMuted(setMutedState);
  }, []);

  useEffect(() => {
    setNickDraft(nickname);
  }, [nickname]);

  // newsletter du jour
  useEffect(() => {
    fetch("/api/newsletter")
      .then((r) => r.json())
      .then((d) => setNewsletter(d?.newsletter || null))
      .catch(() => {});
  }, []);

  // Polling chat partagé : à chaque update, on spawn une montgolfière pour
  // les nouveaux messages uniquement, et on sync le thread Mike.
  useEffect(() => {
    function handler(e) {
      const incomingMike = e.detail?.mike;
      if (incomingMike && (incomingMike.expiresAt || 0) > Date.now()) {
        setMikeThread(incomingMike);
        // Plus d'auto-open : un mini-ping signale juste l'activité, l'utilisateur
        // décide de l'ouvrir s'il veut suivre la conversation.
      } else {
        setMikeThread(null);
      }
      const recent = e.detail?.regulars?.recent || [];
      if (!initializedRef.current) {
        recent.forEach((r) => seenTimestampsRef.current.add(r.timestamp));
        initializedRef.current = true;
        return;
      }
      const now = Date.now();
      // recent est newest-first ; on inverse pour spawn dans l'ordre chronologique
      const fresh = recent
        .filter((r) => !seenTimestampsRef.current.has(r.timestamp))
        .filter((r) => {
          // Dédup contenu : si on vient de poster localement le même message,
          // on a déjà spawn la bulle, on saute celle du serveur.
          const key = `${r.nickname || "anonymous"}|${r.message}`;
          const localTs = recentLocalRef.current.get(key);
          if (localTs && now - localTs < RECENT_LOCAL_TTL_MS) {
            recentLocalRef.current.delete(key);
            seenTimestampsRef.current.add(r.timestamp);
            return false;
          }
          return true;
        })
        .reverse();
      fresh.forEach((r) => {
        seenTimestampsRef.current.add(r.timestamp);
        spawnBalloon(r);
      });
    }
    window.addEventListener("seats-remote-update", handler);
    return () => window.removeEventListener("seats-remote-update", handler);
  }, []);

  function spawnBalloon(entry) {
    const id = `${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    // position horizontale aléatoire (15% → 75% du viewport pour rester lisible)
    const left = 15 + Math.random() * 60;
    // léger drift horizontal pendant la montée (style montgolfière qui dérive)
    const drift = (Math.random() - 0.5) * 60;
    const duration = 9 + Math.random() * 4;
    const next = {
      id,
      nickname: entry.nickname || "anonymous",
      message: entry.message,
      left,
      drift,
      duration
    };
    setBalloons((b) => [...b, next]);
    setTimeout(() => {
      setBalloons((b) => b.filter((x) => x.id !== id));
    }, duration * 1000 + 200);
  }

  function commitNickname() {
    const trimmed = nickDraft.trim();
    if (trimmed !== nickname) setNickname(trimmed);
  }

  async function sendChat() {
    const trimmed = chatDraft.trim();
    if (!trimmed || chatBusy) return;
    setChatBusy(true);
    const seatId =
      myStickySeatRef.current || Math.floor(Math.random() * 6) + 1;
    const speaker = nickname || "anonymous";
    // spawn local immédiat pour feedback + marque le contenu pour la dédup poll
    const localEntry = { nickname: speaker, message: trimmed, timestamp: Date.now() };
    seenTimestampsRef.current.add(localEntry.timestamp);
    recentLocalRef.current.set(`${speaker}|${trimmed}`, Date.now());
    spawnBalloon(localEntry);
    try {
      let res = await fetch("/api/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seatId, nickname: speaker, message: trimmed })
      });
      let data = await res.json().catch(() => null);
      // Si 409 (cette IP est déjà à un autre siège), on retry sur ce siège-là.
      if (res.status === 409 && data?.seatId) {
        myStickySeatRef.current = data.seatId;
        res = await fetch("/api/seats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: data.seatId,
            nickname: speaker,
            message: trimmed
          })
        });
        data = await res.json().catch(() => null);
      }
      if (res.ok && data?.entry?.id) {
        myStickySeatRef.current = data.entry.id;
        trackEvent("counter_message_submit", {
          seat_id: data.entry.id,
          source: "mobile_counter"
        });
      }
      if (data?.entry?.timestamp) {
        seenTimestampsRef.current.add(data.entry.timestamp);
      }
      setChatDraft("");
      if (MIKE_MENTION.test(trimmed)) {
        askMikeWith(trimmed);
      }
    } catch {
      /* silencieux */
    }
    setChatBusy(false);
  }

  async function askMikeWith(question) {
    setMikeOpen(true);
    setMikeBusy(true);
    try {
      const res = await fetch("/api/mike-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, asker: nickname || "" })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.thread) setMikeThread(data.thread);
    } catch {
      /* silencieux */
    }
    setMikeBusy(false);
  }

  function askMike() {
    const trimmed = mikeQ.trim();
    if (!trimmed || mikeBusy) return;
    askMikeWith(trimmed);
    setMikeQ("");
  }

  async function closeMikeThread() {
    setMikeOpen(false);
    if (mikeThread?.isYours) {
      // Owner : on supprime le thread pour tout le monde.
      setMikeThread(null);
      try {
        await fetch("/api/mike-thread", { method: "DELETE" });
      } catch {
        /* silencieux */
      }
    } else if (mikeThread) {
      // Non-owner : on cache localement, le thread reste actif côté serveur.
      dismissedThreadIdRef.current = mikeThread.id;
    }
  }

  // Setup radio audio + listeners (une fois)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!a.src) a.src = "https://icecast.radiofrance.fr/fip-hifi.aac";
    function onPlay() { setRadioPlaying(true); }
    function onPause() { setRadioPlaying(false); }
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // Métadonnées track quand la radio joue
  useEffect(() => {
    if (!radioPlaying) return;
    function fetchTrack() {
      fetch("https://api.radiofrance.fr/livemeta/pull/7")
        .then((r) => r.json())
        .then((data) => {
          const steps = data?.steps || {};
          const live = data?.levels?.[0]?.items?.[0];
          const step = live ? steps[live] : null;
          if (step?.title) {
            setRadioTrack({
              title: step.title,
              artist: step.authors || step.titreAlbum || ""
            });
          }
        })
        .catch(() => {});
    }
    fetchTrack();
    const id = setInterval(fetchTrack, 30 * 1000);
    return () => clearInterval(id);
  }, [radioPlaying]);

  function toggleRadio() {
    const a = audioRef.current;
    if (!a) return;
    if (radioPlaying) {
      a.pause();
      setRadioTrack(null);
    } else {
      a.play().catch(() => {});
    }
  }

  // Météo : géolocation puis fetch Open-Meteo, fallback NYC.
  useEffect(() => {
    let cancelled = false;
    function fetchAt(lat, lon) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto&temperature_unit=fahrenheit`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const cw = data?.current_weather;
          if (!cw) return;
          const tz = data?.timezone || "";
          const city = tz.split("/").pop()?.replace(/_/g, " ") || "";
          setWeather({
            temp: Math.round(cw.temperature),
            icon: WMO_ICONS[cw.weathercode] || "🌡",
            city
          });
        })
        .catch(() => {});
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchAt(pos.coords.latitude, pos.coords.longitude),
        () => fetchAt(40.71, -74.0), // NYC fallback
        { timeout: 8000, maximumAge: 30 * 60 * 1000 }
      );
    } else {
      fetchAt(40.71, -74.0);
    }
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="m-shell" data-file="MobileShell.jsx">
      {/* HEADER STICKY HAUT — brand + radio + nickname */}
      <header className="m-header">
        <div className="m-header-row">
          <h1 className="m-brand">Dinelli's Café</h1>
          <button
            type="button"
            className={`m-radio-btn${radioPlaying ? " is-playing" : ""}`}
            onClick={toggleRadio}
            aria-label={radioPlaying ? "Pause FIP" : "Play FIP"}
            title={radioPlaying ? "Pause" : "Play FIP — Radio France"}
          >
            {radioPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className={`m-mute-btn${muted ? " is-muted" : ""}`}
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "Unmute café sounds" : "Mute café sounds"}
            title={muted ? "Sound off" : "Mute café sounds"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <input
            className="m-nick-input"
            placeholder="your name"
            value={nickDraft}
            onChange={(e) => setNickDraft(e.target.value.slice(0, 40))}
            onBlur={commitNickname}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.target.blur();
              }
            }}
            aria-label="Your name"
            maxLength={40}
          />
        </div>
        <div className="m-meta-row">
          {weather && (
            <div className="m-weather" aria-label="Local weather">
              <span className="m-weather-icon" aria-hidden="true">{weather.icon}</span>
              <span className="m-weather-temp">{weather.temp}°F</span>
              {weather.city && (
                <span className="m-weather-city"> · {weather.city}</span>
              )}
            </div>
          )}
          {radioPlaying && (
            <div className="m-radio-track" aria-live="polite">
              <span className="m-radio-pulse" aria-hidden="true" />
              <span className="m-radio-station">FIP</span>
              {radioTrack ? (
                <span className="m-radio-title">
                  {radioTrack.title}
                  {radioTrack.artist && ` — ${radioTrack.artist}`}
                </span>
              ) : (
                <span className="m-radio-title m-radio-title-live">Live</span>
              )}
            </div>
          )}
        </div>
        <audio ref={audioRef} preload="none" />
      </header>

      {/* CONTENU SCROLLABLE — newsletter + mike */}
      <main className="m-content">
        <section className="m-section m-newsletter">
          <h2 className="m-section-title">
            {newsletter?.subject || "Today's digest"}
          </h2>
          {newsletter ? (
            <div
              className="m-newsletter-html"
              dangerouslySetInnerHTML={{ __html: newsletter.html }}
            />
          ) : (
            <p className="m-empty">No newsletter today yet.</p>
          )}
        </section>

        {/* Espace pour que le contenu ne soit pas mangé par la barre chat */}
        <div className="m-bottom-spacer" aria-hidden="true" />
      </main>

      {/* COUCHE MONTGOLFIÈRES — bulles qui montent */}
      <div className="m-balloons" aria-live="polite">
        {balloons.map((b) => (
          <div
            key={b.id}
            className="m-balloon"
            style={{
              left: `${b.left}%`,
              animationDuration: `${b.duration}s`,
              "--drift": `${b.drift}px`
            }}
          >
            <em className="m-balloon-author">{b.nickname}</em>
            <span className="m-balloon-text">{b.message}</span>
          </div>
        ))}
      </div>

      {/* MINI PING : signale qu'une conversation Mike est active sans
          l'ouvrir d'office. Tap pour voir la conv complète. */}
      {mikeThread && mikeThread.turns?.length > 0 && !mikeOpen && (
        <button
          type="button"
          className="m-mike-ping"
          onClick={() => setMikeOpen(true)}
          aria-label="Open Mike conversation"
        >
          <span className="m-mike-ping-pulse" aria-hidden="true" />
          <span className="m-mike-ping-text">
            mike is talking
            {(() => {
              const askers = new Set(
                mikeThread.turns
                  .filter((t) => t.role === "user" && t.asker)
                  .map((t) => t.asker)
              );
              if (askers.size > 0) {
                return ` with ${Array.from(askers).slice(0, 2).join(", ")}${askers.size > 2 ? "…" : ""}`;
              }
              return "";
            })()}
          </span>
        </button>
      )}

      {/* CHAT INPUT FIXE BAS — Send + bouton Mike qui ouvre la sheet */}
      <form
        className="m-chat-bar"
        onSubmit={(e) => {
          e.preventDefault();
          sendChat();
        }}
      >
        <input
          placeholder="Say something at the bar…"
          value={chatDraft}
          onChange={(e) => setChatDraft(e.target.value.slice(0, 140))}
          maxLength={140}
          disabled={chatBusy}
        />
        <button type="submit" disabled={!chatDraft.trim() || chatBusy}>
          Send
        </button>
        <button
          type="button"
          className="m-chat-mike-btn"
          onClick={() => setMikeOpen(true)}
          aria-label="Open Mike conversation"
        >
          Mike
        </button>
      </form>

      {/* BOTTOM SHEET MIKE — affiche le thread partagé en temps réel.
          Pas de backdrop assombrissant : le report newsletter reste lisible
          et interactif derrière. Fermeture via ×. */}
      {mikeOpen && (
          <div
            className="m-mike-sheet"
            role="dialog"
            aria-label="Mike the bartender"
          >
            <div className="m-mike-sheet-head">
              <h3>Mike — the bartender</h3>
              <button
                type="button"
                className="m-mike-sheet-close"
                onClick={closeMikeThread}
                aria-label={
                  !mikeThread || mikeThread.isYours
                    ? "Close conversation"
                    : "Hide"
                }
                title={
                  !mikeThread || mikeThread.isYours
                    ? "Close (everyone)"
                    : "Hide (still open for everyone)"
                }
              >
                ×
              </button>
            </div>
            <div className="m-mike-sheet-body">
              {mikeThread && mikeThread.turns.length > 0 ? (
                <div className="m-mike-thread">
                  {mikeThread.turns.map((t) => (
                    <div
                      key={t.timestamp}
                      className={`m-mike-turn m-mike-turn-${t.role}`}
                    >
                      <em>{t.role === "user" ? (t.asker || "anonymous") : "mike"}</em>
                      <span>{t.message}</span>
                    </div>
                  ))}
                  {mikeBusy && (
                    <div className="m-mike-turn m-mike-turn-mike m-mike-turn-thinking">
                      <em>mike</em>
                      <span>…</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="m-empty">
                  {mikeBusy ? "Mike is thinking…" : "Ask Mike anything. Everyone in the café will see the conversation."}
                </p>
              )}
            </div>
            <form
              className="m-inline-input"
              onSubmit={(e) => {
                e.preventDefault();
                askMike();
              }}
            >
              <input
                autoFocus
                placeholder="Ask the bartender…"
                value={mikeQ}
                onChange={(e) => setMikeQ(e.target.value.slice(0, 200))}
                maxLength={200}
                disabled={mikeBusy}
              />
              <button type="submit" disabled={!mikeQ.trim() || mikeBusy}>
                Ask
              </button>
            </form>
          </div>
      )}
    </div>
  );
}
