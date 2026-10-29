import MarkdownIt from "markdown-it";

/**
 * One shared parser for validation and rendering, so what we check is exactly
 * what we export. `html: true` lets us *detect* raw HTML; validation rejects it
 * before anything is rendered.
 */
export const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

/** Plain text of an inline token (what an ATS would read). */
export function inlineText(inlineToken) {
  if (!inlineToken?.children) return inlineToken?.content ?? "";
  return inlineToken.children
    .map((t) => (t.type === "softbreak" || t.type === "hardbreak" ? " " : t.content))
    .join("");
}

/**
 * Parse Markdown into tokens plus a light structural outline:
 *   { tokens, name, header: {start,end}, sections: [{ title, key, line, start, end, entries }] }
 * `start`/`end` are token indexes, `line` is 1-based for error messages.
 */
export function parseResume(markdown) {
  const tokens = md.parse(markdown, {});
  const outline = { tokens, name: null, nameLine: null, h1Count: 0, sections: [] };

  tokens.forEach((tok, i) => {
    if (tok.type !== "heading_open") return;
    const text = inlineText(tokens[i + 1]).trim();
    const line = (tok.map?.[0] ?? 0) + 1;

    if (tok.tag === "h1") {
      outline.h1Count += 1;
      if (!outline.name) {
        outline.name = text;
        outline.nameLine = line;
      }
    } else if (tok.tag === "h2") {
      outline.sections.push({ title: text, key: sectionKey(text), line, start: i, end: tokens.length, entries: [] });
    } else if (tok.tag === "h3" && outline.sections.length) {
      outline.sections.at(-1).entries.push({ title: text, line, start: i });
    }
  });

  // Close each section's token range at the next section's start.
  outline.sections.forEach((s, idx) => {
    const next = outline.sections[idx + 1];
    if (next) s.end = next.start;
  });
  outline.headerEnd = outline.sections[0]?.start ?? tokens.length;

  return outline;
}

/** Map common heading variants to a canonical key, e.g. "TOOLS & TECHNOLOGY" -> "skills". */
const SECTION_ALIASES = {
  summary: ["summary", "professional summary", "profile", "about", "objective"],
  experience: ["experience", "work experience", "professional experience", "employment", "employment history", "work history"],
  education: ["education", "education & training", "academic background"],
  skills: ["skills", "technical skills", "tools & technology", "tools and technology", "technologies", "core competencies", "tools"],
  projects: ["projects", "selected projects", "personal projects"],
  certifications: ["certifications", "licenses & certifications", "certificates"],
};

export function sectionKey(title) {
  const normalized = title.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(normalized)) return key;
  }
  return null;
}

export const KNOWN_SECTIONS = Object.keys(SECTION_ALIASES);
