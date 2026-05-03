"use client";

import { useEffect, useRef, useState } from "react";
import { useNickname } from "./NicknameContext.jsx";

const MIKE_MENTION = /(^|[^a-z])mike\b|@mike/i;
const BALLOON_DURATION_MS = 11000;

export default function MobileShell() {
  const { nickname, setNickname } = useNickname();
  const [nickDraft, setNickDraft] = useState("");
  const [newsletter, setNewsletter] = useState(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [mikeQ, setMikeQ] = useState("");
  const [mikeA, setMikeA] = useState("");
  const [mikeBusy, setMikeBusy] = useState(false);
  const [balloons, setBalloons] = useState([]);

  // Radio FIP
  const audioRef = useRef(null);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioTrack, setRadioTrack] = useState(null);

  // Pour ignorer les anciens messages qui arrivent au premier poll
  // (sinon une montgolfière par message historique = bordel visuel).
  const seenTimestampsRef = useRef(new Set());
  const initializedRef = useRef(false);

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
  // les nouveaux messages uniquement.
  useEffect(() => {
    function handler(e) {
      const recent = e.detail?.regulars?.recent || [];
      if (!initializedRef.current) {
        recent.forEach((r) => seenTimestampsRef.current.add(r.timestamp));
        initializedRef.current = true;
        return;
      }
      // recent est newest-first ; on inverse pour spawn dans l'ordre chronologique
      const fresh = recent
        .filter((r) => !seenTimestampsRef.current.has(r.timestamp))
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
    const seatId = Math.floor(Math.random() * 6) + 1;
    // spawn local immédiat pour feedback
    const localEntry = {
      nickname: nickname || "anonymous",
      message: trimmed,
      timestamp: Date.now()
    };
    seenTimestampsRef.current.add(localEntry.timestamp);
    spawnBalloon(localEntry);
    try {
      await fetch("/api/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: seatId,
          nickname: localEntry.nickname,
          message: trimmed
        })
      });
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
    setMikeBusy(true);
    setMikeA("…");
    try {
      const res = await fetch("/api/mike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, speaker: nickname || "" })
      });
      const data = await res.json().catch(() => ({}));
      setMikeA(data?.answer || data?.error || "—");
    } catch {
      setMikeA("—");
    }
    setMikeBusy(false);
  }

  function askMike() {
    const trimmed = mikeQ.trim();
    if (!trimmed || mikeBusy) return;
    askMikeWith(trimmed);
    setMikeQ("");
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
              <span className="m-radio-title m-radio-title-live">Live broadcast</span>
            )}
          </div>
        )}
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

        <section className="m-section m-mike">
          <h2 className="m-section-title">Mike (the barman)</h2>
          {mikeA && (
            <div className="m-mike-answer">
              <em>mike</em>
              <span>{mikeA}</span>
            </div>
          )}
          <form
            className="m-inline-input"
            onSubmit={(e) => {
              e.preventDefault();
              askMike();
            }}
          >
            <input
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

      {/* CHAT INPUT FIXE BAS */}
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
      </form>
    </div>
  );
}
