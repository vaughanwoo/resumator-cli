# resumator

Write resumes in Markdown, check them for ATS formatting problems, and export
each one to **DOCX**, **PDF**, a **self-contained HTML page**, and a **ZIP** of all three.
Resume checks and exports run locally through the CLI; pull-request CI runs unit tests only.

```text
resumes/*.md ──► parse ──► validate ──► render ──► dist/<resume-id>/<export-name>/
                              │                    ├─ <export-name>.docx
                              │                    ├─ <export-name>.pdf
                              ▼                    ├─ <export-name>.html  (double-click, works offline)
                           local CLI                └─ <export-name>.zip
```

## Quick start

Requires Node.js 20+ (`.nvmrc` pins 22) and Yarn 4 via Corepack (`corepack enable`).
The exact Yarn version is pinned in `package.json` under `packageManager`.

```bash
yarn install                                  # also downloads headless Chrome for PDFs
yarn resumator list                              # registered resumes
yarn resumator check support-engineer            # formatting checks
yarn resumator preview support-engineer          # live preview, reloads on save
yarn resumator build support-engineer            # timestamped exports
yarn resumator build support-engineer --name platform-role
yarn resumator build --all                 # export every resume
```

Yarn passes everything after the script name straight to the CLI, so no `--` is needed.

Puppeteer is allow-listed in `dependenciesMeta` because Yarn 4 blocks dependency
install scripts by default, and Puppeteer's install script is what downloads Chrome.

### Linux PDF setup: sandbox restrictions

> [!IMPORTANT]
> Automated PDF export uses Puppeteer and its separately downloaded Chrome
> rendering engine. You do not need to install Chrome as your personal browser
> or change your default browser.
>
> On Ubuntu 23.10+ and some other Linux configurations, security policies may
> prevent the downloaded browser from starting. The error typically includes
> `No usable sandbox!`. A build that includes PDF export can fail at this step.
>
> An optional workaround grants a specific browser executable permission to
> create user namespaces through an AppArmor profile. This keeps Chrome's own
> sandbox enabled, but relaxes an Ubuntu security restriction for that executable.
> Because the downloaded executable is in a user-writable cache, replacing it
> could allow other code to use the same exception. Review the tradeoff before
> changing your system policy; consult your administrator on managed computers.
>
> See [Chromium's AppArmor guidance](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md)
> and [Puppeteer's troubleshooting guide](https://pptr.dev/troubleshooting)
> for diagnosis and configuration options. This is not a required step for every
> Linux user. Do not disable AppArmor globally or use `--no-sandbox` as a routine
> fix. Resumator should not make these security changes automatically.

To export without invoking the PDF renderer, select HTML and DOCX explicitly:

```bash
yarn resumator build support-engineer --format html,docx
```

A missing-browser error (`Could not find Chrome`) is a separate installation
problem, not a reason to change AppArmor. Ensure Puppeteer's browser installation
succeeds before investigating sandbox permissions.

## Commands

| Command | What it does |
| --- | --- |
| `list` | Show resumes in `resume.config.json` |
| `check <id...> \| --all` | Run checks. Exit code 1 on errors (or warnings with `--strict`) |
| `build <id...> \| --all` | Check, then export. Skips a resume with errors unless `--force` |
| `preview <id>` | Serve at `http://localhost:4321` with a findings panel and live reload |

Build options: `--name <name>` (prefix the export folder and files; a timestamp is always
appended; otherwise defaults to `<resume-id>-<yyyymmddhhmmss>`), `--format pdf,docx` (subset), and `--clean`
(replace only that export-name folder).
Check options: `--strict`, `--json`.

`resumes/support-engineer.md` is personal, local-only content and is ignored by
Git. The checked-in config still points to that path, so create or restore the
file locally before running its `check`, `preview`, or `build` commands. The
resume itself is never checked or exported by CI.

## Adding a resume

1. Create `resumes/junior-software-engineer.md` (see [docs/resume-format.md](docs/resume-format.md)).
2. Register it:

   ```json
   "junior-software-engineer": {
     "title": "Junior Software Engineer",
     "source": "resumes/junior-software-engineer.md"
   }
   ```

3. `yarn resumator check junior-software-engineer`

Each entry inherits `defaults` (template, filename pattern, formats, page size,
required sections) and can override any of them.

The default export name uses `{target}-{timestamp}` where `timestamp` is local
time in `yyyymmddhhmmss` format. Filename patterns also support `{name}` and
`{date}` (local build date). Passing `--name` uses the sanitized, lowercase name
followed by the timestamp, for both the output folder and exported files.

## Local resume workflow

```bash
# edit resumes/support-engineer.md locally
yarn resumator preview support-engineer
yarn resumator check support-engineer
yarn resumator build support-engineer
```

The local check and exported files are not uploaded by CI. GitHub Actions runs
the unit tests in [`.github/workflows/resume-ci.yml`](.github/workflows/resume-ci.yml)
without loading the personal resume.

If the resume was previously committed, adding it to `.gitignore` does not
remove it from earlier Git history. Removing past copies from a remote requires
a separate history-rewrite and coordinated force-push.

## How it works

| Path | Responsibility |
| --- | --- |
| `bin/resumator.js` | CLI: argument parsing, exit codes |
| `src/config.js` | Load `resume.config.json`, resolve which resumes to process |
| `src/parse.js` | One markdown-it parser shared by checks and exports, plus a section outline |
| `src/validate/` | Rule engine; each rule is a small, tested function ([docs/ats-rules.md](docs/ats-rules.md)) |
| `src/render/html.js` | Single-file HTML with inlined CSS, no scripts or external requests |
| `src/export/` | PDF (headless Chrome, tagged), DOCX (real Word heading/list styles), ZIP |
| `src/preview.js` | Local server with Server-Sent Events live reload |
| `templates/classic/` | Visual styling only; content never lives here |

Checks and exports share one parser, so the file that passes validation is
exactly the file that gets exported.

## Tests

```bash
yarn test         # node:test, no extra framework
yarn lint:md      # markdownlint-cli2 on resumes/
```

## Roadmap

- [ ] Junior software engineer resume
- [ ] Job-description keyword comparison
- [ ] Only rebuild resumes affected by a PR
- [ ] Verify extracted PDF text matches the source
- [ ] Browser editor UI on top of the same engine
