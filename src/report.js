import fs from "node:fs";
import path from "node:path";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const LABEL = {
  error: paint("31;1", "error  "),
  warning: paint("33;1", "warning"),
  info: paint("36", "info   "),
};

/** Human-readable terminal output, grouped by resume. */
export function printReport(result, root) {
  const rel = path.relative(root, result.target.sourcePath);
  console.log(`\n${paint("1", result.target.id)} ${paint("2", rel)}`);

  if (result.findings.length === 0) {
    console.log(`  ${paint("32", "✓ No formatting issues found.")}`);
    return;
  }
  for (const f of result.findings) {
    console.log(`  ${LABEL[f.severity]} ${paint("2", `${rel}:${f.line}`)}  ${f.message} ${paint("2", `[${f.rule}]`)}`);
    if (f.fix) console.log(`          ${paint("2", "→ " + f.fix)}`);
  }
  console.log(`  ${result.errors} error(s), ${result.warnings} warning(s), ${result.infos} suggestion(s)`);
}

/**
 * GitHub Actions workflow commands. These show up as inline annotations on the
 * PR's "Files changed" tab, on the exact line that needs attention.
 * https://docs.github.com/actions/reference/workflow-commands-for-github-actions
 */
export function printAnnotations(result, root) {
  const file = path.relative(root, result.target.sourcePath);
  const level = { error: "error", warning: "warning", info: "notice" };
  const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  for (const f of result.findings) {
    const body = f.fix ? `${f.message}\n→ ${f.fix}` : f.message;
    console.log(`::${level[f.severity]} file=${file},line=${f.line},title=${esc(f.rule)}::${esc(body)}`);
  }
}

/** Markdown report appended to the job summary page. */
export function writeStepSummary(results, root) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const icon = { error: "🔴", warning: "🟡", info: "🔵" };
  let out = "## Resume formatting checks\n\n";
  for (const r of results) {
    const rel = path.relative(root, r.target.sourcePath);
    out += `### ${r.target.id} (\`${rel}\`)\n\n`;
    out += `${r.errors} error(s) · ${r.warnings} warning(s) · ${r.infos} suggestion(s)\n\n`;
    if (r.findings.length) {
      out += "| | Line | Rule | Issue | Suggested fix |\n|---|---|---|---|---|\n";
      for (const f of r.findings) {
        const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
        out += `| ${icon[f.severity]} | ${f.line} | \`${f.rule}\` | ${cell(f.message)} | ${cell(f.fix)} |\n`;
      }
      out += "\n";
    }
  }
  fs.appendFileSync(file, out);
}
