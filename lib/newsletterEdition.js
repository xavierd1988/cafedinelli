const editionFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

const newYorkDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

// An edition date is a calendar day, not midnight in the reader's timezone.
// The caller supplies its client clock so prerendering cannot freeze "today".
export function getNewsletterEdition(newsletter, now) {
  if (!newsletter) {
    return { date: "", dateLabel: "", statusLabel: "No edition is available yet." };
  }

  const date = typeof newsletter.date === "string" ? newsletter.date : "";
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00Z`)
    : null;
  if (!instant || Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== date) {
    return { date: "", dateLabel: "Publication date unavailable", statusLabel: "Latest available edition" };
  }

  let today = "";
  const current = now == null ? null : new Date(now);
  if (current && !Number.isNaN(current.getTime())) {
    const parts = Object.fromEntries(
      newYorkDayFormatter.formatToParts(current).map(({ type, value }) => [type, value])
    );
    today = `${parts.year}-${parts.month}-${parts.day}`;
  }

  const statusLabel = date === today
    ? "Today's edition"
    : today && date < today
      ? "Latest available edition • Today's edition is not published yet"
      : "Latest available edition";

  return { date, dateLabel: editionFormatter.format(instant), statusLabel };
}
