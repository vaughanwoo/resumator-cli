import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildTargets } from "../src/build.js";
import { VALID } from "./helpers.js";

test("builds timestamped or named exports into separate folders", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resumator-build-"));
  const sourcePath = path.join(root, "resume.md");
  const outputPath = path.join(root, "dist", "support-engineer");
  fs.writeFileSync(sourcePath, VALID);

  const target = {
    id: "support-engineer",
    sourcePath,
    outputPath,
    requiredSections: ["experience", "education", "skills"],
  };

  try {
    const now = new Date(2026, 9, 26, 14, 23, 7);
    const [timestamped] = await buildTargets([target], { formats: ["html"], now });
    assert.deepEqual(timestamped.files.map((file) => path.relative(root, file)), [
      path.join("dist", "support-engineer", "support-engineer-20261026142307", "support-engineer-20261026142307.html"),
    ]);

    const otherExport = path.join(outputPath, "previous-export");
    fs.mkdirSync(otherExport, { recursive: true });
    fs.writeFileSync(path.join(otherExport, "keep.txt"), "keep");

    const [named] = await buildTargets([target], {
      formats: ["html"],
      name: "Platform/API Role",
      clean: true,
      now,
    });
    assert.deepEqual(named.files.map((file) => path.relative(root, file)), [
      path.join("dist", "support-engineer", "platform-api-role-20261026142307", "platform-api-role-20261026142307.html"),
    ]);
    assert.equal(fs.readFileSync(path.join(otherExport, "keep.txt"), "utf8"), "keep");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
