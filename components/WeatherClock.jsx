"use client";

import { useEffect, useState } from "react";
import { useDraggable } from "./useDraggable.js";
import { getModulePosition } from "../lib/modulePositions.js";
import { useSceneScale } from "./useSceneScale.js";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// WMO weather codes → pixel emoji + text colour
const WMO = {
  0:  { icon: "☀", color: "#ffd23f" },
  1:  { icon: "🌤", color: "#ffd23f" },
  2:  { icon: "⛅", color: "#dadfe1" },
  3:  { icon: "☁",  color: "#a0a8b0" },
  45: { icon: "🌫", color: "#a0a8b0" },
  48: { icon: "🌫", color: "#a0a8b0" },
  51: { icon: "🌦", color: "#7cb7ff" },
  53: { icon: "🌦", color: "#7cb7ff" },
  55: { icon: "🌦", color: "#7cb7ff" },
  61: { icon: "🌧", color: "#7cb7ff" },
  63: { icon: "🌧", color: "#7cb7ff" },
  65: { icon: "🌧", color: "#5a9eff" },
  71: { icon: "❄",  color: "#cfe7ff" },
  73: { icon: "❄",  color: "#cfe7ff" },
  75: { icon: "❄",  color: "#cfe7ff" },
  77: { icon: "❄",  color: "#cfe7ff" },
  80: { icon: "🌧", color: "#7cb7ff" },
  81: { icon: "🌧", color: "#7cb7ff" },
  82: { icon: "⛈", color: "#5a9eff" },
  95: { icon: "⛈", color: "#ff6b6b" },
  96: { icon: "⛈", color: "#ff6b6b" },
  99: { icon: "⛈", color: "#ff6b6b" }
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function lookupWmo(code) {
  return WMO[code] || WMO[0];
}

export default function WeatherClock() {
  const [time, setTime] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(null);
  const init = getModulePosition("WeatherClock");
  const sceneScale = useSceneScale();
  const { offset, dragging, handleDragStart } = useDraggable({
    scaled: false,
    name: "WeatherClock",
    initialOffset: init.offset
  });

  // tick clock every 20s (avoid every-second re-render thrash)
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 20 * 1000);
    return () => clearInterval(id);
  }, []);

  // fetch weather once on mount (refreshed every 30 min)
  useEffect(() => {
    let cancelled = false;

    async function fetchAt(lat, lon) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=5&temperature_unit=fahrenheit`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        // Extrait le nom de ville depuis le timezone (ex: "Europe/Paris" → "Paris")
        const tz = data.timezone || "";
        const city = tz.split("/").pop()?.replace(/_/g, " ") || "";
        setWeather({
          temp: Math.round(data.current_weather.temperature),
          code: data.current_weather.weathercode,
          highs: data.daily.temperature_2m_max.map(Math.round),
          lows: data.daily.temperature_2m_min.map(Math.round),
          codes: data.daily.weathercode,
          dates: data.daily.time,
          city
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError("offline");
      }
    }

    function locate() {
      if (!navigator.geolocation) return fetchAt(48.85, 2.35); // Paris
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchAt(pos.coords.latitude, pos.coords.longitude),
        () => fetchAt(48.85, 2.35),
        { timeout: 8000, maximumAge: 30 * 60 * 1000 }
      );
    }

    locate();
    const refresh = setInterval(locate, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  const dateStr = `${pad(time.getDate())}-${pad(time.getMonth() + 1)}`;
  const h24 = time.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  const timeStr = `${h12}:${pad(time.getMinutes())} ${ampm}`;
  const dayStr = DAYS[time.getDay()];

  const current = weather ? lookupWmo(weather.code) : null;

  const forecast = [];
  if (weather) {
    for (let i = 1; i <= 4 && i < weather.dates.length; i++) {
      const d = new Date(weather.dates[i]);
      forecast.push({
        day: DAYS[d.getDay()],
        icon: lookupWmo(weather.codes[i]).icon,
        high: weather.highs[i],
        low: weather.lows[i]
      });
    }
  }

  return (
    <div
      className={`wclock is-draggable${dragging ? " is-dragging" : ""}`}
      aria-label="Local time and weather"
      data-file="WeatherClock.jsx"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${sceneScale})`,
        transformOrigin: "top right"
      }}
      onPointerDown={handleDragStart}
    >
      <div className="wclock-screen">
        {weather?.city && (
          <div className="wclock-city">{weather.city}</div>
        )}
        <div className="wclock-row wclock-row-top">
          <span className="wclock-date">{dateStr}</span>
          <span className="wclock-time">{timeStr}</span>
          <span className="wclock-day">{dayStr}</span>
        </div>
        <div className="wclock-divider" />
        <div className="wclock-row wclock-row-now">
          {weather ? (
            <>
              <span className="wclock-icon-big" style={{ color: current.color }}>
                {current.icon}
              </span>
              <div className="wclock-now-temp">
                <span className="wclock-temp-big">
                  {weather.temp}°<span className="wclock-unit">F</span>
                </span>
                <div className="wclock-hilo">
                  <span className="wclock-high">{weather.highs[0]}°</span>
                  <span className="wclock-low">{weather.lows[0]}°</span>
                </div>
              </div>
            </>
          ) : (
            <span className="wclock-loading">{error ? "OFFLINE" : "SYNC..."}</span>
          )}
        </div>
        <div className="wclock-divider" />
        <div className="wclock-row wclock-row-fc">
          {forecast.length > 0
            ? forecast.map((f, i) => (
                <div key={i} className="wclock-day-block">
                  <div className="wclock-day-label">{f.day}</div>
                  <div className="wclock-day-icon" style={{ color: lookupWmo(weather.codes[i + 1]).color }}>
                    {f.icon}
                  </div>
                  <div className="wclock-day-high">{f.high}°</div>
                  <div className="wclock-day-low">{f.low}°</div>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
