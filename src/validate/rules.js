import { inlineText, KNOWN_SECTIONS } from "../parse.js";
import { hasDateRange, detectDateFormats, convertDate } from "./dates.js";

/*
 * Each rule receives a context and returns findings:
 *   { severity: "error" | "warning" | "info", line, message, fix }
 *
 * error   = the export is likely to parse badly; the build refuses to run.
 * warning = a real risk worth fixing; fails CI only with --strict.
 * info    = editorial suggestion; never fails anything.
 *
 * Rules are deliberately small and independent so each one can be unit tested
 * and explained in docs/ats-rules.md.
 */

const lineOf = (token) => (token?.map?.[0] ?? 0) + 1;

/** Tokens of `type` within a range, with their index. */
function* tokensOfType(tokens, type, start = 0, end = tokens.length) {
  for (let i = start; i < end; i++) if (tokens[i].type === type) yield [tokens[i], i];
}

/** First paragraph's inline token inside a token range. */
function firstParagraph(tokens, start, end) {
  for (let i = start; i < end; i++) {
    if (tokens[i].type === "paragraph_open") return { open: tokens[i], inline: tokens[i + 1] };
  }
  return null;
}

/** The first role paragraph immediately after an employer H3, if any. */
function entryMeta(tokens, entry) {
  const t = tokens[entry.start + 3];

  return t?.type === "paragraph_open"
    ? { open: t, inline: tokens[entry.start + 4] }
    : null;
}

/** Text of every list item in a range, with its line number. */
function listItems(tokens, start = 0, end = tokens.length) {
  const items = [];
  for (const [tok, i] of tokensOfType(tokens, "list_item_open", start, end)) {
    const para = firstParagraph(tokens, i, end);
    if (para) items.push({ line: lineOf(tok), text: inlineText(para.inline) });
  }
  return items;
}

export const rules = [
  {
    id: "name-heading",
    description: "The document starts with exactly one H1: your name.",
    check({ outline }) {
      const out = [];
      if (outline.h1Count === 0) {
        out.push({ severity: "error", line: 1, message: "No name heading found.", fix: "Start the file with '# Your Name'." });
      } else if (outline.h1Count > 1) {
        out.push({ severity: "error", line: outline.nameLine, message: `Found ${outline.h1Count} H1 headings; parsers expect one (your name).`, fix: "Use '##' for section headings." });
      }
      const first = outline.tokens.find((t) => t.type !== "html_block");
      if (outline.h1Count && first && !(first.type === "heading_open" && first.tag === "h1")) {
        out.push({ severity: "warning", line: lineOf(first), message: "Content appears before your name.", fix: "Move your '# Name' heading to the top of the file." });
      }
      return out;
    },
  },

  {
    id: "contact-line",
    description: "A contact paragraph follows the name with a readable email, phone, and visible URLs.",
    check({ outline }) {
      const { tokens } = outline;
      const h1 = tokens.findIndex((t) => t.type === "heading_open" && t.tag === "h1");
      if (h1 === -1) return [];
      const para = firstParagraph(tokens, h1, outline.headerEnd);
      if (!para) {
        return [{ severity: "error", line: outline.nameLine, message: "No contact line found under your name.", fix: "Add a line like: 555-555-5555 | you@example.com | linkedin.com/in/you | City, ST" }];
      }

      const out = [];
      const line = lineOf(para.open);
      const text = inlineText(para.inline);

      if (!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) {
        out.push({ severity: "error", line, message: "No email address found in the contact line.", fix: "Include your email as plain text." });
      }
      if (!/(\+?\d[\d\s().-]{8,}\d)/.test(text)) {
        out.push({ severity: "warning", line, message: "No phone number found in the contact line." });
      }

      const kids = para.inline.children ?? [];
      const linkedText = new Set(kids.filter((t, i) => kids[i - 1]?.type === "link_open").map((t) => t.content.trim()));

      // A bare label like "LinkedIn" gives an ATS the word, not the profile.
      // (Linked labels are handled by the hidden-URL check below.)
      const labels = /^(linkedin|github|portfolio|website|personal site)$/i;
      for (const part of text.split(/\s*[|·•,]\s*/)) {
        if (labels.test(part.trim()) && !linkedText.has(part.trim())) {
          out.push({
            severity: "warning",
            line,
            message: `"${part.trim()}" is a label with no address. Parsers and printed copies only see the word.`,
            fix: `Use the address itself as the visible text, e.g. linkedin.com/in/your-handle`,
          });
        }
      }

      // [LinkedIn](https://...) hides the URL from plain-text extraction.
      kids.forEach((t, i) => {
        if (t.type !== "link_open") return;
        const href = t.attrGet("href") ?? "";
        const label = kids[i + 1]?.content ?? "";
        const bare = href.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
        if (!href.startsWith("mailto:") && !label.includes(bare) && !bare.includes(label)) {
          out.push({ severity: "warning", line, message: `Link text "${label}" hides its URL (${href}).`, fix: `Write the link as <${href}> or [${bare}](${href}) so the address is visible.` });
        }
      });
      return out;
    },
  },

  {
    id: "required-sections",
    description: "Sections listed in requiredSections (config) are present under recognizable headings.",
    check({ outline, target }) {
      const present = new Set(outline.sections.map((s) => s.key));
      return (target.requiredSections ?? [])
        .filter((key) => !present.has(key))
        .map((key) => ({
          severity: "error",
          line: 1,
          message: `Missing a "${key}" section.`,
          fix: `Add a '## ${key[0].toUpperCase() + key.slice(1)}' section (or a recognized alias; see docs/ats-rules.md).`,
        }));
    },
  },

  {
    id: "standard-headings",
    description: "Section headings use conventional names an ATS can map to fields.",
    check({ outline }) {
      return outline.sections
        .filter((s) => !s.key)
        .map((s) => ({
          severity: "info",
          line: s.line,
          message: `"${s.title}" is not a standard section name; some parsers may lump it into another field.`,
          fix: `Consider one of: ${KNOWN_SECTIONS.join(", ")}.`,
        }));
    },
  },

  {
    id: "empty-section",
    description: "Every section has content.",
    check({ outline }) {
      return outline.sections
        .filter((s) => s.end - s.start <= 3) // heading_open, inline, heading_close only
        .map((s) => ({ severity: "warning", line: s.line, message: `Section "${s.title}" is empty.` }));
    },
  },

  {
    id: "no-unsafe-blocks",
    description: "No tables, images, raw HTML, code blocks, or deep headings.",
    check({ outline }) {
      const out = [];
      for (const tok of outline.tokens) {
        const line = lineOf(tok);
        if (tok.type === "table_open") {
          out.push({ severity: "error", line, message: "Tables are a common cause of scrambled ATS parsing.", fix: "Rewrite as headings and bullet lists." });
        } else if (tok.type === "html_block") {
          out.push({ severity: "error", line, message: "Raw HTML is not allowed in resume source.", fix: "Use Markdown only; styling belongs in the template." });
        } else if (tok.type === "fence" || tok.type === "code_block") {
          out.push({
            severity: "error",
            line,
            message: tok.type === "code_block" ? "This text is indented 4+ spaces, so Markdown treats it as a code block." : "Code blocks don't belong in a resume.",
            fix: "Remove the indentation, or indent list continuation lines by only 2 spaces.",
          });
        } else if (tok.type === "heading_open" && ["h4", "h5", "h6"].includes(tok.tag)) {
          out.push({ severity: "warning", line, message: `${tok.tag.toUpperCase()} heading is deeper than the resume structure supports.`, fix: "Use ## for sections and ### for entries." });
        } else if (tok.type === "inline") {
          for (const child of tok.children ?? []) {
            if (child.type === "image") out.push({ severity: "error", line, message: "Images (photos, logos, icons) are not read by ATS parsers.", fix: "Remove the image." });
            if (child.type === "html_inline") out.push({ severity: "error", line, message: `Inline HTML (${child.content}) is not allowed.`, fix: "Use Markdown only." });
          }
        }
      }
      return out;
    },
  },

  {
    id: "experience-dates",
    description: "Each employer entry has a date range in its heading or the first role paragraph.",
    check({ outline }) {
      const exp = outline.sections.find(
        (section) => section.key === "experience"
      );

      if (!exp) return [];

      const { tokens } = outline;
      const out = [];

      exp.entries.forEach((entry) => {
        const meta = entryMeta(tokens, entry);
        const metaText = meta ? inlineText(meta.inline) : "";

        if (hasDateRange(metaText)) return;

        if (hasDateRange(entry.title)) {
          out.push({
            severity: "info",
            line: entry.line,
            message:
              `"${entry.title}" puts dates in the employer heading rather than the first role paragraph.`,
            fix:
              "For consistent formatting use: '### Employer' then '**Job Title** | Start–End'.",
          });

          return;
        }

        out.push({
          severity: "error",
          line: entry.line,
          message:
            `Employer entry "${entry.title}" has no date range in its heading or first role paragraph.`,
          fix:
            "Add a role paragraph under the employer heading, for example: **Support Engineer** | 10/2020–Present",
        });
      });

      return out;
    },
  },

  {
    id: "date-format-consistency",
    description: "Experience dates use one format throughout.",
    check({ outline }) {
      const exp = outline.sections.find((s) => s.key === "experience");
      if (!exp) return [];
      const { tokens } = outline;

      // Only look at entry headings and their meta lines, not bullet text.
      const seen = []; // { format, match, line }
      exp.entries.forEach((entry) => {
        const meta = entryMeta(tokens, entry);
        const candidates = [{ text: entry.title, line: entry.line }];
        if (meta) candidates.push({ text: inlineText(meta.inline), line: lineOf(meta.open) });
        for (const c of candidates) {
          if (!hasDateRange(c.text)) continue;
          for (const d of detectDateFormats(c.text)) seen.push({ ...d, line: c.line });
        }
      });

      const counts = {};
      for (const d of seen) counts[d.format] = (counts[d.format] ?? 0) + 1;
      const formats = Object.keys(counts); // insertion order = first appearance
      if (formats.length <= 1) return [];

      // Most common format wins; on a tie, the one used first (your newest role) wins.
      const dominant = formats.reduce((best, f) => (counts[f] > counts[best] ? f : best));

      // One finding per line, listing each date that differs and its rewrite.
      const byLine = new Map();
      for (const d of seen.filter((d) => d.format !== dominant)) {
        if (!byLine.has(d.line)) byLine.set(d.line, []);
        byLine.get(d.line).push(d);
      }
      return [...byLine].map(([line, ds]) => {
        const rewrites = ds.map((d) => { const to = convertDate(d.match, dominant); return to ? `"${d.match}" → "${to}"` : `"${d.match}"`; });
        return {
          severity: "warning",
          line,
          message: `${ds.map((d) => `"${d.match}"`).join(", ")} ${ds.length > 1 ? "use" : "uses"} ${[...new Set(ds.map((d) => d.format))].join("/")}; most of your dates use ${dominant}.`,
          fix: `Use one format everywhere: ${rewrites.join(", ")}. Mixed formats can confuse tenure calculations.`,
        };
      });
    },
  },

  {
    id: "first-person",
    description: "Bullets avoid first-person pronouns.",
    check({ outline }) {
      return listItems(outline.tokens)
        .map((item) => ({ item, hit: item.text.match(/\b(I|I'm|I've|me|my|we|our|ours|us)\b/) }))
        .filter(({ hit }) => hit)
        .map(({ item, hit }) => ({
          severity: "warning",
          line: item.line,
          message: `Bullet uses first person ("${hit[0]}").`,
          fix: "Drop the pronoun, e.g. 'our SaaS product' → 'the company's SaaS product'.",
        }));
    },
  },

  {
    id: "weak-openers",
    description: "Bullets start with an action verb instead of a duty phrase.",
    check({ outline }) {
      const weak = /^(responsible for|helped|worked on|assisted( with)?|tasked with|duties included|in charge of)\b/i;
      return listItems(outline.tokens)
        .filter((item) => weak.test(item.text.replace(/^\*\*[^*]+\*\*\s*/, "").trim()))
        .map((item) => ({
          severity: "info",
          line: item.line,
          message: `Bullet opens with a duty phrase ("${item.text.split(" ").slice(0, 2).join(" ")}…").`,
          fix: "Lead with what you did: Built, Reduced, Automated, Resolved…",
        }));
    },
  },

  {
    id: "long-bullets",
    description: "Bullets stay under ~300 characters so they scan in a few seconds.",
    check({ outline }) {
      return listItems(outline.tokens)
        .filter((item) => item.text.length > 300)
        .map((item) => ({
          severity: "info",
          line: item.line,
          message: `Bullet is ${item.text.length} characters long.`,
          fix: "Split it, or trim to the action, the scope, and the result.",
        }));
    },
  },

  {
    id: "decorative-characters",
    description: "No emoji or icon glyphs.",
    check({ lines }) {
      const out = [];
      lines.forEach((text, i) => {
        const hit = text.match(/[\p{Extended_Pictographic}\u2605\u2606\u2713\u2714\u260E\u2709]/u);
        if (hit) out.push({ severity: "warning", line: i + 1, message: `Decorative character "${hit[0]}" may be dropped or garbled.`, fix: "Use plain words instead of icons." });
      });
      return out;
    },
  },
];
