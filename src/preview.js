import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { validateTarget } from "./validate/index.js";
import { renderHtml } from "./render/html.js";

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Validation results as a panel pinned to the top of the preview (preview only, never exported). */
function findingsPanel(result) {
  const items = result.findings
    .map((f) => `<li class="rz-${f.severity}"><b>${f.severity}</b> line ${f.line}: ${escapeHtml(f.message)}${f.fix ? `<br><small>→ ${escapeHtml(f.fix)}</small>` : ""}</li>`)
    .join("");
  const summary = result.findings.length ? `${result.errors} error(s), ${result.warnings} warning(s), ${result.infos} suggestion(s)` : "No formatting issues found";
  return `<aside id="rz-panel"><details ${result.errors ? "open" : ""}><summary>${summary}</summary><ul>${items}</ul></details></aside>`;
}

const PREVIEW_HEAD = `<style>
#rz-panel{position:sticky;top:0;z-index:9;max-width:8.5in;margin:0 auto 1rem;font:13px/1.4 system-ui,sans-serif;background:#fff;border:1px solid #d0d7de;border-radius:6px;padding:.5rem .8rem}
#rz-panel summary{cursor:pointer;font-weight:600}#rz-panel ul{margin:.5rem 0 0;padding-left:1rem;max-height:40vh;overflow:auto}
#rz-panel li{margin:.3rem 0}.rz-error b{color:#cf222e}.rz-warning b{color:#9a6700}.rz-info b{color:#0969da}
@media print{#rz-panel{display:none}}
</style>`;

// Server-Sent Events: the server pushes "reload" when the file changes.
const RELOAD_SCRIPT = `<script>new EventSource("/events").onmessage=()=>location.reload();</script>`;

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

/**
 * Live preview: serves the rendered resume on localhost and reloads the page
 * whenever the Markdown or template changes.
 */
export function startPreview(target, { port = 4321, open = true, templateDir } = {}) {
  const clients = new Set();

  const page = () => {
    const result = validateTarget(target);
    return renderHtml(result.markdown, {
      template: target.template,
      headExtra: PREVIEW_HEAD,
      bodyExtra: RELOAD_SCRIPT,
    }).replace('<main class="resume">', `${findingsPanel(result)}\n<main class="resume">`);
  };

  const server = http.createServer((req, res) => {
    if (req.url === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    try {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page());
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Preview failed:\n\n${err.stack}`);
    }
  });

  // Editors often write a file in several steps; debounce to reload once.
  let timer;
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const c of clients) c.write("data: reload\n\n");
      console.log(`  ↻ ${new Date().toLocaleTimeString()} change detected, reloading`);
    }, 120);
  };
  const watchers = [fs.watch(target.sourcePath, onChange)];
  if (templateDir && fs.existsSync(templateDir)) watchers.push(fs.watch(templateDir, onChange));

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(`Previewing ${target.id} at ${url}\nEditing ${target.source} reloads the page. Press Ctrl+C to stop.`);
    if (open) openBrowser(url);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") console.error(`Port ${port} is in use. Try: yarn resume preview ${target.id} --port ${port + 1}`);
    else console.error(err);
    process.exit(1);
  });

  return { server, close: () => { watchers.forEach((w) => w.close()); server.close(); } };
}
