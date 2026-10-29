/** "Vaughan Woolsey" -> "vaughan-woolsey" */
export function slugify(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Local calendar date as YYYY-MM-DD (not UTC, so late-evening builds keep today's date). */
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local build time as YYYYMMDDHHMMSS, avoiding collisions between same-day exports. */
export function localTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Expand a filename pattern from resume.config.json.
 * Supported tokens: {name} {target} {date} {timestamp}
 */
export function buildBaseName(pattern, { name, target, date, timestamp }) {
  const values = { name: slugify(name) || "resume", target, date, timestamp };
  return pattern
    .replace(/\{(\w+)\}/g, (match, key) => {
      if (!(key in values)) throw new Error(`Unknown filename token ${match}. Use {name}, {target}, {date}, or {timestamp}.`);
      return values[key];
    })
    .replace(/-{2,}/g, "-");
}
