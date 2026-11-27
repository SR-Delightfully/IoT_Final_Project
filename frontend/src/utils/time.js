// The database stores CURRENT_TIMESTAMP in UTC ("2026-11-27 06:23:13", no zone).
// These helpers turn it into the store's local time for display.

export function parseDbTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  // Date-only values (YYYY-MM-DD) are already calendar days: keep them as-is.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00`);
  const date = new Date(`${text.replace(" ", "T")}${/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? "" : "Z"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n) => String(n).padStart(2, "0");

// "2026-11-27" in local time
export function localDate(value) {
  const d = parseDbTime(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
}

// "2026-11-27 @ 01:23" in local time
export function localDateTime(value) {
  const d = parseDbTime(value);
  return d ? `${localDate(value)} @ ${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}
