import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { md, parseResume } from "../parse.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadTemplateCss(template = "classic") {
  const file = path.join(ROOT, "templates", template, "style.css");
  if (!fs.existsSync(file)) throw new Error(`Template "${template}" not found (expected ${path.relative(ROOT, file)}).`);
  return fs.readFileSync(file, "utf8");
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Render resume Markdown to one self-contained HTML document:
 * CSS is inlined, there are no external requests, and no JavaScript is
 * needed to read it, so the file opens correctly from a double-click.
 *
 * The heading block becomes <header>, each H2 becomes a <section>.
 */
export function renderHtml(markdown, { template = "classic", title, headExtra = "", bodyExtra = "" } = {}) {
  const outline = parseResume(markdown);
  const { tokens } = outline;
  const render = (from, to) => md.renderer.render(tokens.slice(from, to), md.options, {});

  const header = render(0, outline.headerEnd);
  const sections = outline.sections
    .map((s) => {
      const cls = s.key ? ` class="section-${s.key}"` : "";
      return `<section${cls}>\n${render(s.start, s.end)}</section>`;
    })
    .join("\n");

  const docTitle = title ?? (outline.name ? `${outline.name} – Resume` : "Resume");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="resumator">
${outline.name ? `<meta name="author" content="${escapeHtml(outline.name)}">` : ""}
<title>${escapeHtml(docTitle)}</title>
<style>
${loadTemplateCss(template)}
</style>
${headExtra}
</head>
<body>
<main class="resume">
<header>
${header}</header>
${sections}
</main>
${bodyExtra}
</body>
</html>
`;
}
