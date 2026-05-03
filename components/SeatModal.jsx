import { useEffect, useRef, useState } from "react";

const linkPattern = /(https?:\/\/|www\.|\b[a-z0-9.-]+\.[a-z]{2,}\b)/i;

export default function SeatModal({ seatNumber, onClose, onSubmit }) {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Say one thing before you sit.");
      return;
    }

    if (trimmedMessage.length > 140) {
      setError("Keep it under 140 characters.");
      return;
    }

    if (linkPattern.test(trimmedMessage) || linkPattern.test(nickname)) {
      setError("No links at the counter.");
      return;
    }

    onSubmit({ nickname, message: trimmedMessage });
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <form
        className="seat-modal"
        aria-label={`Take seat ${seatNumber}`}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
          Close
        </button>
        <p className="modal-kicker">Take a seat</p>
        <h2>Seat {seatNumber}</h2>
        <label>
          Nickname optional
          <input
            ref={inputRef}
            value={nickname}
            maxLength={24}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="anonymous"
          />
        </label>
        <label>
          Say one thing about the internet today
          <textarea
            value={message}
            maxLength={140}
            onChange={(event) => {
              setMessage(event.target.value);
              setError("");
            }}
            placeholder="A quiet observation, no links."
          />
        </label>
        <div className="modal-rules">
          <span>{140 - message.length} characters left</span>
          <span>140 characters max</span>
          <span>No links</span>
        </div>
        {error && <p className="modal-error">{error}</p>}
        <button className="sit-button" type="submit">
          Sit at the counter
        </button>
      </form>
    </div>
  );
}
