const MONTHS_FULL = "January|February|March|April|May|June|July|August|September|October|November|December";
const MONTHS_ABBR = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

// Order matters: full month names must be tried before abbreviations.
const FORMATS = [
  { id: "Month YYYY", example: "November 2010", re: new RegExp(`\\b(?:${MONTHS_FULL})\\s+\\d{4}\\b`, "g") },
  { id: "Mon YYYY", example: "Nov 2010", re: new RegExp(`\\b(?:${MONTHS_ABBR})\\.?\\s+\\d{4}\\b`, "g") },
  { id: "MM/YYYY", example: "11/2010", re: /\b\d{1,2}\/\d{4}\b/g },
  { id: "YYYY", example: "2010", re: /\b(?:19|20)\d{2}\b/g },
];

const SEP = String.raw`\s*(?:–|—|-|to)\s*`;
const POINT = String.raw`(?:(?:${MONTHS_FULL}|${MONTHS_ABBR})\.?\s+\d{4}|\d{1,2}\/\d{4}|(?:19|20)\d{2})`;
const RANGE_RE = new RegExp(`${POINT}${SEP}(?:${POINT}|Present|Current)`, "i");

/** True when text contains something like "10/2020–Present" or "Jan 2024 - Mar 2025". */
export function hasDateRange(text) {
  return RANGE_RE.test(text);
}

/**
 * Which date styles appear in a string? Each match is consumed so that
 * "November 2010" counts once as "Month YYYY", not also as "YYYY".
 */
export function detectDateFormats(text) {
  let remaining = text;
  const found = [];
  for (const fmt of FORMATS) {
    remaining = remaining.replace(fmt.re, (match) => {
      found.push({ format: fmt.id, match });
      return " ".repeat(match.length);
    });
  }
  return found;
}

const MONTH_INDEX = Object.fromEntries(
  MONTHS_FULL.split("|").flatMap((m, i) => [[m.toLowerCase(), i + 1], [m.slice(0, 3).toLowerCase(), i + 1]]),
);
MONTH_INDEX.sept = 9;
const ABBR = MONTHS_ABBR.split("|").filter((m) => m !== "Sept");

/** Rewrite a single date into another format, or null if it can't be done (e.g. a bare year). */
export function convertDate(text, toFormat) {
  let month;
  let year;
  const named = text.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  const numeric = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (named) [month, year] = [MONTH_INDEX[named[1].toLowerCase()], named[2]];
  else if (numeric) [month, year] = [Number(numeric[1]), numeric[2]];
  else return null; // a bare year has no month to carry over

  if (!month || month > 12) return null;
  if (toFormat === "MM/YYYY") return `${month}/${year}`;
  if (toFormat === "Mon YYYY") return `${ABBR[month - 1]} ${year}`;
  if (toFormat === "Month YYYY") return `${MONTHS_FULL.split("|")[month - 1]} ${year}`;
  return null;
}
