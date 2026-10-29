import fs from "node:fs";
import { parseResume } from "../parse.js";
import { rules } from "./rules.js";

const ORDER = { error: 0, warning: 1, info: 2 };

/** Validate Markdown text. Pure function: easy to unit test. */
export function validateMarkdown(markdown, target = {}) {
  const outline = parseResume(markdown);
  const ctx = { markdown, lines: markdown.split(/\r?\n/), outline, target };

  const findings = rules
    .flatMap((rule) => rule.check(ctx).map((f) => ({ rule: rule.id, ...f })))
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line);

  const count = (sev) => findings.filter((f) => f.severity === sev).length;
  return { outline, findings, errors: count("error"), warnings: count("warning"), infos: count("info") };
}

/** Validate a configured target's source file. */
export function validateTarget(target) {
  const markdown = fs.readFileSync(target.sourcePath, "utf8");
  return { target, markdown, ...validateMarkdown(markdown, target) };
}
