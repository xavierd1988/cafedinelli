"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (nickname: string, message: string) => void;
};

export default function SeatModal({ open, onClose, onSubmit }: Props) {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setNickname("");
      setMessage("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = message.trim();
  const hasLink = /https?:\/\/|www\.|\.[a-z]{2,}\//i.test(trimmed);
  const valid = trimmed.length > 0 && trimmed.length <= 140 && !hasLink;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md fade-up">
        <div className="rounded-sm border border-warm-amber/30 bg-bg-cafe shadow-[0_30px_80px_-20px_rgba(244,216,168,0.25)]">
          <div className="border-b border-warm-amber/15 px-6 py-4">
            <p className="font-serif text-xl text-warm-light">Take a seat</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
              Leave a thought on the counter
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-muted">
                Nickname <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 24))}
                placeholder="anonymous"
                className="w-full rounded-sm border border-warm-amber/20 bg-bg-night/60 px-3 py-2 text-paper placeholder:text-muted/60 focus:border-warm-amber/60 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-muted">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                placeholder="Say something to the counter…"
                rows={3}
                className="w-full resize-none rounded-sm border border-warm-amber/20 bg-bg-night/60 px-3 py-2 text-paper placeholder:text-muted/60 focus:border-warm-amber/60 focus:outline-none"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>{hasLink ? "No links allowed." : "No links. 140 max."}</span>
                <span>{message.length}/140</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-warm-amber/15 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-paper"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() => onSubmit(nickname.trim() || "anonymous", trimmed)}
              className="rounded-sm bg-warm-glow px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm-light disabled:cursor-not-allowed disabled:bg-warm-glow/30 disabled:text-ink/50"
            >
              Sit down
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
