import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMarkdown } from "../src/validate/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", name), "utf8");
export const VALID = fixture("valid.md");
export const TARGET = { requiredSections: ["experience", "education", "skills"] };

/** Validate and return only findings for one rule. */
export function findingsFor(markdown, rule) {
  return validateMarkdown(markdown, TARGET).findings.filter((f) => f.rule === rule);
}
