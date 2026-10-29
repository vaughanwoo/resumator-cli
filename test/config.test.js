import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, resolveTargets, UsageError } from "../src/config.js";

function project(config, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resumator-"));
  fs.writeFileSync(path.join(dir, "resume.config.json"), JSON.stringify(config));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

const CONFIG = {
  defaults: { template: "classic", outputDir: "dist" },
  resumes: {
    "support-engineer": { source: "resumes/support-engineer.md" },
    "junior-software-engineer": { source: "resumes/junior-software-engineer.md", template: "minimal" },
  },
};
const FILES = { "resumes/support-engineer.md": "# A", "resumes/junior-software-engineer.md": "# B" };

test("targets inherit defaults and can override them", () => {
  const { targets } = loadConfig(project(CONFIG, FILES));
  assert.equal(targets.get("support-engineer").template, "classic");
  assert.equal(targets.get("junior-software-engineer").template, "minimal");
  assert.match(targets.get("support-engineer").outputPath, /dist[/\\]support-engineer$/);
});

test("no selection is an error that lists available resumes", () => {
  const config = loadConfig(project(CONFIG, FILES));
  assert.throws(() => resolveTargets(config, []), (err) => err instanceof UsageError && /support-engineer/.test(err.message) && /junior-software-engineer/.test(err.message));
});

test("--all selects every resume", () => {
  const config = loadConfig(project(CONFIG, FILES));
  assert.equal(resolveTargets(config, [], { all: true }).length, 2);
});

test("unknown ids and missing source files are reported", () => {
  const config = loadConfig(project(CONFIG, { "resumes/support-engineer.md": "# A" }));
  assert.throws(() => resolveTargets(config, ["nope"]), /Unknown resume "nope"/);
  assert.throws(() => resolveTargets(config, ["junior-software-engineer"]), /does not exist/);
});

test("ids must be lowercase-hyphenated", () => {
  assert.throws(() => loadConfig(project({ resumes: { "Support Engineer": { source: "x.md" } } })), /lowercase/);
});
