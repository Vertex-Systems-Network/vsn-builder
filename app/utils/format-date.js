// Deterministic date formatting: fixed locale + UTC so SSR and client output match (no hydration mismatch).
const FORMATTERS = {
  date: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }),
  datetime: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
  time: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }),
};

export function formatDate(value, style = "datetime", fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const formatter = FORMATTERS[style] || FORMATTERS.datetime;
  return style === "date" ? formatter.format(date) : `${formatter.format(date)} UTC`;
}
