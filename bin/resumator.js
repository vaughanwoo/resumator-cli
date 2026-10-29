#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, resolveTargets, UsageError } from "../src/config.js";
import { validateTarget } from "../src/validate/index.js";
import { printReport, printAnnotations, writeStepSummary } from "../src/report.js";
import { buildTargets, FORMATS } from "../src/build.js";
import { startPreview } from "../src/preview.js";

const HELP = `resumator: Markdown resumes → ATS-checked DOCX, PDF, and offline HTML

Usage
  yarn resumator <command> [resume-id...] [options]

Commands
  list                       Show the resumes registered in resume.config.json
  check   <id...> | --all    Run formatting checks
  build   <id...> | --all    Check, then export to dist/<id>/<export-name>/
  preview <id>               Live preview at http://localhost:4321

Options
  --all                      Select every registered resume
  --strict                   check: treat warnings as failures
  --format <list>            build: comma-separated subset of ${FORMATS.join(",")}
  --name <name>              build: prefix folder/files; append build timestamp
  --force                    build: export even if checks report errors
  --clean                    build: replace this export-name folder first
  --port <n>                 preview: port number (default 4321)
  --no-open                  preview: don't open a browser
  --json                     check: print machine-readable results

Examples
  yarn resumator check support-engineer
  yarn resumator build --all
  yarn resumator build support-engineer --format pdf,docx
  yarn resumator build support-engineer --name platform-role
  yarn resumator preview support-engineer
`;

async function main(argv) {
  const { values: opts, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      all: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      clean: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      format: { type: "string" },
      name: { type: "string" },
      port: { type: "string", default: "4321" },
      "no-open": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const [command, ...ids] = positionals;
  if (opts.help || !command || command === "help") {
    console.log(HELP);
    return 0;
  }

  const config = loadConfig();
  const inCI = Boolean(process.env.GITHUB_ACTIONS);

  switch (command) {
    case "list": {
      for (const t of config.targets.values()) console.log(`${t.id.padEnd(28)} ${t.source}${t.title ? `  (${t.title})` : ""}`);
      return 0;
    }

    case "check": {
      const targets = resolveTargets(config, ids, { all: opts.all });
      const results = targets.map(validateTarget);

      if (opts.json) {
        console.log(JSON.stringify(results.map(({ target, findings, errors, warnings, infos }) => ({ id: target.id, source: target.source, errors, warnings, infos, findings })), null, 2));
      } else {
        results.forEach((r) => printReport(r, config.root));
      }
      if (inCI) {
        results.forEach((r) => printAnnotations(r, config.root));
        writeStepSummary(results, config.root);
      }

      const failed = results.some((r) => r.errors > 0 || (opts.strict && r.warnings > 0));
      if (failed && !opts.json) console.log(`\nChecks failed${opts.strict ? " (strict mode: warnings count)" : ""}.`);
      return failed ? 1 : 0;
    }

    case "build": {
      const targets = resolveTargets(config, ids, { all: opts.all });
      const formats = opts.format?.split(",").map((s) => s.trim()).filter(Boolean);
      const outcomes = await buildTargets(targets, {
        formats,
        name: opts.name,
        force: opts.force,
        clean: opts.clean,
        onResult: (r) => printReport(r, config.root),
      });

      console.log("");
      for (const o of outcomes) {
        if (o.skipped) {
          console.log(`✗ ${o.target.id}: not exported because of ${o.result.errors} error(s). Fix them or pass --force.`);
        } else {
          console.log(`✓ ${o.target.id}`);
          o.files.forEach((f) => console.log(`    ${path.relative(config.root, f)}`));
        }
      }
      return outcomes.some((o) => o.skipped) ? 1 : 0;
    }

    case "preview": {
      if (ids.length > 1 || opts.all) throw new UsageError("preview shows one resume at a time.");
      const [target] = resolveTargets(config, ids);
      startPreview(target, {
        port: Number(opts.port),
        open: !opts["no-open"],
        templateDir: path.join(config.root, "templates", target.template ?? "classic"),
      });
      return null; // keep running
    }

    default:
      throw new UsageError(`Unknown command "${command}".\n\n${HELP}`);
  }
}

main(process.argv.slice(2))
  .then((code) => {
    if (code !== null) process.exitCode = code;
  })
  .catch((err) => {
    if (err instanceof UsageError || err.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      console.error(err.message);
      process.exitCode = 2;
    } else {
      console.error(err);
      process.exitCode = 1;
    }
  });
