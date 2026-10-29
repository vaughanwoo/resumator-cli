import fs from "node:fs";
import path from "node:path";
import { validateTarget } from "./validate/index.js";
import { renderHtml } from "./render/html.js";
import { renderDocx } from "./export/docx.js";
import { renderZip } from "./export/package.js";
import { PdfRenderer } from "./export/pdf.js";
import { buildBaseName, localDate, localTimestamp, slugify } from "./export/filenames.js";

export const FORMATS = ["html", "pdf", "docx", "zip"];

/**
 * Validate, then export each target. A target with validation errors is
 * skipped (unless force) so a broken resume never silently becomes a PDF.
 * Returns [{ target, result, files: [paths], skipped }].
 */
export async function buildTargets(targets, { formats, name, force = false, clean = false, now = new Date(), onResult } = {}) {
  const pdf = new PdfRenderer();
  const outcomes = [];
  const date = localDate(now);
  const timestamp = localTimestamp(now);

  try {
    for (const target of targets) {
      const result = validateTarget(target);
      onResult?.(result);

      if (result.errors > 0 && !force) {
        outcomes.push({ target, result, files: [], skipped: true });
        continue;
      }

      const wanted = new Set(formats?.length ? formats : target.formats ?? FORMATS);
      for (const f of wanted) if (!FORMATS.includes(f)) throw new Error(`Unknown format "${f}". Choose from: ${FORMATS.join(", ")}.`);

      const requestedName = slugify(name);
      const baseName = requestedName
        ? `${requestedName}-${timestamp}`
        : buildBaseName(target.filename ?? "{target}-{timestamp}", {
          name: result.outline.name,
          target: target.id,
          date,
          timestamp,
        });
      const outputPath = path.join(target.outputPath, baseName);
      if (clean) fs.rmSync(outputPath, { recursive: true, force: true });
      fs.mkdirSync(outputPath, { recursive: true });

      const html = renderHtml(result.markdown, { template: target.template });
      // The zip bundles the PDF and DOCX, so render them if the zip is wanted.
      const pdfBuf = wanted.has("pdf") || wanted.has("zip") ? await pdf.render(html, { pageSize: target.pageSize }) : null;
      const docxBuf = wanted.has("docx") || wanted.has("zip") ? await renderDocx(result.markdown) : null;

      const files = [];
      const write = (ext, data) => {
        const file = path.join(outputPath, `${baseName}.${ext}`);
        fs.writeFileSync(file, data);
        files.push(file);
      };

      if (wanted.has("html")) write("html", html);
      if (wanted.has("pdf")) write("pdf", pdfBuf);
      if (wanted.has("docx")) write("docx", docxBuf);
      if (wanted.has("zip")) write("zip", await renderZip({ html, pdf: pdfBuf, docx: docxBuf, baseName, name: result.outline.name }));

      outcomes.push({ target, result, files, skipped: false });
    }
  } finally {
    await pdf.close();
  }
  return outcomes;
}
