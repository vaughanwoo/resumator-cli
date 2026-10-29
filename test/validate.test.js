import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMarkdown } from "../src/validate/index.js";
import { VALID, TARGET, findingsFor } from "./helpers.js";

test("the valid fixture has no errors or warnings", () => {
  const r = validateMarkdown(VALID, TARGET);
  assert.deepEqual(r.findings.filter((f) => f.severity !== "info"), []);
});

test("a missing H1 is an error", () => {
  const [f] = findingsFor(VALID.replace("# Jordan Example", "Jordan Example"), "name-heading");
  assert.equal(f.severity, "error");
});

test("missing required sections are errors", () => {
  const md = VALID.replace(/## Education[\s\S]*$/, "");
  const found = findingsFor(md, "required-sections");
  assert.equal(found.length, 1);
  assert.match(found[0].message, /education/);
});

test("section aliases count, e.g. TOOLS & TECHNOLOGY satisfies skills", () => {
  const md = VALID.replace("## Skills", "## TOOLS & TECHNOLOGY");
  assert.deepEqual(findingsFor(md, "required-sections"), []);
});

test("tables, images, and raw HTML are errors", () => {
  const md = `${VALID}\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![logo](logo.png)\n\n<div>hi</div>\n`;
  const found = findingsFor(md, "no-unsafe-blocks");
  assert.equal(found.filter((f) => f.severity === "error").length, 3);
});

test("accidental 4-space indentation is caught as a code block", () => {
  const md = VALID.replace("## Skills\n\nJavaScript", "## Skills\n\n    JavaScript");
  const [f] = findingsFor(md, "no-unsafe-blocks");
  assert.match(f.message, /indented 4\+ spaces/);
});

test("a bare LinkedIn label is a warning", () => {
  const md = VALID.replace("linkedin.com/in/jordan-example", "LinkedIn");
  const [f] = findingsFor(md, "contact-line");
  assert.equal(f.severity, "warning");
  assert.match(f.message, /LinkedIn/);
});

test("a link whose text hides its URL is a warning", () => {
  const md = VALID.replace("linkedin.com/in/jordan-example", "[LinkedIn](https://linkedin.com/in/jordan-example)");
  assert.equal(findingsFor(md, "contact-line").length, 1);
});

test("a missing email is an error", () => {
  const md = VALID.replace("jordan@example.com | ", "");
  assert.ok(findingsFor(md, "contact-line").some((f) => f.severity === "error"));
});

test("an experience entry without dates is an error", () => {
  const md = VALID.replace("**Sample LLC** | 06/2019–12/2021", "**Sample LLC**");
  const [f] = findingsFor(md, "experience-dates");
  assert.equal(f.severity, "error");
  assert.equal(f.line, 15); // reported on the entry heading
});

test("mixed date formats are flagged with a suggested rewrite", () => {
  const md = VALID.replace("06/2019–12/2021", "June 2019–12/2021");
  const [f] = findingsFor(md, "date-format-consistency");
  assert.equal(f.severity, "warning");
  assert.match(f.fix, /"June 2019" → "6\/2019"/);
});

test("dates inside bullets don't count toward entry date formats", () => {
  const md = VALID.replace("- Resolved API", "- Led a 2018–2019 migration. Resolved API");
  assert.deepEqual(findingsFor(md, "date-format-consistency"), []);
});

test("first-person pronouns in bullets are warnings", () => {
  const md = VALID.replace("Resolved API integration issues", "Resolved our API integration issues");
  assert.equal(findingsFor(md, "first-person").length, 1);
});

test("first person in the summary paragraph is allowed", () => {
  const md = VALID.replace("Support engineer who", "I am a support engineer who");
  assert.deepEqual(findingsFor(md, "first-person"), []);
});

test("emoji are flagged", () => {
  const md = VALID.replace("Pittsburgh, PA", "📍 Pittsburgh, PA");
  assert.equal(findingsFor(md, "decorative-characters").length, 1);
});

test("findings are sorted errors first", () => {
  const md = VALID.replace("# Jordan Example", "Jordan").replace("Resolved API", "Resolved our API");
  const sev = validateMarkdown(md, TARGET).findings.map((f) => f.severity);
  assert.deepEqual(sev, [...sev].sort((a, b) => ["error", "warning", "info"].indexOf(a) - ["error", "warning", "info"].indexOf(b)));
});

test("an employer-first entry accepts dates in its role paragraph", () => {
  const markdown = `# Jordan Example

## Experience

### Example Company

**Support Engineer** | 04/2025–Present

- Investigated API issues.
`;

  assert.deepEqual(
    findingsFor(markdown, "experience-dates"),
    []
  );
});

test("an employer-first entry without role dates reports the new guidance", () => {
  const markdown = `# Jordan Example

## Experience

### Example Company

**Support Engineer**

- Investigated API issues.
`;

  const found = findingsFor(markdown, "experience-dates");

  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "error");
  assert.match(found[0].message, /Example Company/);
  assert.match(found[0].fix, /\*\*Support Engineer\*\*/);
});

test("multiple dated roles can be grouped under one employer", () => {
  const markdown = `# Jordan Example

## Experience

### Example Company

**Support Engineer** | 10/2020–Present

- Investigated API issues.

**Customer Technical Support Specialist** | 03/2020–10/2020

- Resolved customer support tickets.
`;

  assert.deepEqual(
    findingsFor(markdown, "experience-dates"),
    []
  );
});
