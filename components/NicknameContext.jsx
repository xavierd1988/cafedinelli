"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const NicknameContext = createContext({
  nickname: "",
  setNickname: () => {},
  loading: true
});

export function NicknameProvider({ children }) {
  const [nickname, setNicknameState] = useState("");
  const [loading, setLoading] = useState(true);

  // Charge le nom courant depuis le serveur (mappé sur l'IP).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/nickname")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setNicknameState(data?.nickname || "");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setNickname = useCallback(async (next) => {
    const trimmed = (next || "").slice(0, 40).trim();
    setNicknameState(trimmed);
    try {
      await fetch("/api/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed })
      });
    } catch {
      // Si le serveur est indispo on garde au moins le nom en mémoire pour la session.
    }
  }, []);

  return (
    <NicknameContext.Provider value={{ nickname, setNickname, loading }}>
      {children}
    </NicknameContext.Provider>
  );
}

export function useNickname() {
  return useContext(NicknameContext);
}
