import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { parseResume } from "../parse.js";

const FONT = "Calibri";
const ACCENT = "0B4F8A";
const MUTED = "57606A";
const pt = (n) => n * 2; // docx sizes are in half-points
const inch = (n) => Math.round(n * 1440); // and page measures in twentieths of a point

/**
 * Convert markdown-it inline children into docx runs, tracking bold/italic
 * state and turning links into real hyperlinks.
 */
function inlineRuns(inline, base = {}) {
  const runs = [];
  let bold = false;
  let italics = false;
  let link = null; // { href, runs }

  const push = (run) => (link ? link.runs : runs).push(run);

  for (const t of inline?.children ?? []) {
    switch (t.type) {
      case "strong_open": bold = true; break;
      case "strong_close": bold = false; break;
      case "em_open": italics = true; break;
      case "em_close": italics = false; break;
      case "text":
      case "code_inline":
        push(new TextRun({ ...base, text: t.content, bold: bold || base.bold, italics: italics || base.italics, ...(link ? { color: ACCENT, underline: {} } : {}) }));
        break;
      case "softbreak": push(new TextRun({ ...base, text: " " })); break;
      case "hardbreak": push(new TextRun({ ...base, break: 1 })); break;
      case "link_open": link = { href: t.attrGet("href"), runs: [] }; break;
      case "link_close":
        runs.push(new ExternalHyperlink({ link: link.href, children: link.runs }));
        link = null;
        break;
      default: break;
    }
  }
  return runs;
}

/**
 * Build a .docx with real Word heading and list styles (not just big bold
 * text), which is what ATS parsers and screen readers look for.
 */
export async function renderDocx(markdown, { title } = {}) {
  const outline = parseResume(markdown);
  const { tokens } = outline;
  const children = [];
  let listDepth = 0;
  let contactDone = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "bullet_list_open" || t.type === "ordered_list_open") listDepth++;
    else if (t.type === "bullet_list_close" || t.type === "ordered_list_close") listDepth--;
    else if (t.type === "heading_open") {
      const inline = tokens[i + 1];

      const inExperience = outline.sections.some(
        (sec) =>
          sec.key === "experience" &&
          i > sec.start &&
          i < sec.end
      );

      const isEmployer = inExperience && t.tag === "h3";

      const heading = {
        h1: HeadingLevel.TITLE,
        h2: HeadingLevel.HEADING_1,
        h3: HeadingLevel.HEADING_2,
      }[t.tag] ?? HeadingLevel.HEADING_3;

      children.push(
        new Paragraph({
          heading,
          alignment: t.tag === "h1" ? AlignmentType.CENTER : undefined,
          children: inlineRuns(inline)
        })
      );

      i += 2;
    } else if (t.type === "paragraph_open") {
      const inline = tokens[i + 1];
      const inHeader = i < outline.headerEnd;
      const prev = tokens[i - 1];
      const isContact = inHeader && !contactDone;
      const inExperience = outline.sections.some((sec) => sec.key === "experience" && i > sec.start && i < sec.end);
      const isEntryMeta = inExperience && prev?.type === "heading_close" && prev.tag === "h3";

      if (listDepth > 0) {
        children.push(new Paragraph({ numbering: { reference: "bullets", level: Math.min(listDepth - 1, 2) }, children: inlineRuns(inline), spacing: { after: 40 } }));
      } else if (isContact) {
        contactDone = true;
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: inlineRuns(inline, { color: MUTED }) }));
      } else {
        children.push(new Paragraph({ spacing: { after: isEntryMeta ? 60 : 100 }, children: inlineRuns(inline, isEntryMeta ? { color: MUTED } : {}) }));
      }
      i += 2;
    }
  }

  const doc = new Document({
    creator: outline.name ?? "resumator",
    title: title ?? (outline.name ? `${outline.name} – Resume` : "Resume"),
    styles: {
      default: { document: { run: { font: FONT, size: pt(10.5) }, paragraph: { spacing: { line: 336 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: pt(22), bold: true }, paragraph: { spacing: { after: 40 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: pt(11.5), bold: true, color: ACCENT, allCaps: true }, paragraph: { spacing: { before: 240, after: 80 }, border: { bottom: { style: "single", size: 6, color: "D0D7DE", space: 2 } }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: pt(11), bold: true }, paragraph: { spacing: { before: 140, after: 0 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["•", "◦", "▪"][level],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: inch(0.25 * (level + 1)), hanging: inch(0.18) } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: inch(8.5), height: inch(11) }, margin: { top: inch(0.5), bottom: inch(0.5), left: inch(0.6), right: inch(0.6) } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
