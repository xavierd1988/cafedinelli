const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Keep the server and the first browser render identical. The live instant
// is supplied only after mount; a prerender must never bake in a clock time.
export function formatWeatherClock(time, timeZone) {
  if (!time) return { date: "-- --", time: "--:-- --", day: "---" };

  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}),
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(time).map(({ type, value }) => [type, value]));

  return {
    date: `${parts.day}-${parts.month}`,
    time: `${parts.hour}:${parts.minute} ${parts.dayPeriod}`,
    day: parts.weekday.toUpperCase()
  };
}

// Forecast values are calendar dates in the weather location, not instants
// at UTC midnight (which would be the previous day in American time zones).
export function forecastDay(date) {
  const calendarDate = new Date(`${date}T12:00:00Z`);
  return DAYS[calendarDate.getUTCDay()] || "---";
}
