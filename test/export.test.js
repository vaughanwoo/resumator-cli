import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHtml } from "../src/render/html.js";
import { renderDocx } from "../src/export/docx.js";
import { buildBaseName, localTimestamp, slugify } from "../src/export/filenames.js";
import { VALID } from "./helpers.js";

test("HTML export is self-contained", () => {
  const html = renderHtml(VALID);
  assert.match(html, /<style>/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /src="https?:/);
});

test("HTML wraps each H2 in a labeled section", () => {
  const html = renderHtml(VALID);
  assert.match(html, /<section class="section-experience">/);
  assert.match(html, /<section class="section-skills">/);
  assert.match(html, /<title>Jordan Example – Resume<\/title>/);
});

test("DOCX export produces a valid zip container", async () => {
  const buf = await renderDocx(VALID);
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  assert.ok(buf.length > 2000);
});

test("filenames expand tokens", () => {
  assert.equal(slugify("Vaughan Woolsey"), "vaughan-woolsey");
  assert.equal(buildBaseName("{name}-{target}-{date}", { name: "Vaughan Woolsey", target: "support-engineer", date: "2026-10-26" }), "vaughan-woolsey-support-engineer-2026-10-26");
  assert.equal(buildBaseName("{target}-{timestamp}", { name: "Vaughan Woolsey", target: "support-engineer", timestamp: "20261026142307" }), "support-engineer-20261026142307");
  assert.throws(() => buildBaseName("{nope}", { name: "x", target: "y", date: "z" }), /Unknown filename token/);
});

test("local timestamps use compact local calendar time", () => {
  assert.equal(localTimestamp(new Date(2026, 9, 26, 14, 23, 7)), "20261026142307");
});
