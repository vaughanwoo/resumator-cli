# ATS formatting rules

Every rule lives in `src/validate/rules.js` and has unit tests in `test/validate.test.js`.

## Severities

- **error**: likely to break parsing. `build` refuses to export; CI fails.
- **warning**: a real risk worth fixing. Fails only with `check --strict`.
- **info**: an editorial suggestion. Never fails anything.

## Rules

| Rule | Severity | What it checks |
| --- | --- | --- |
| `name-heading` | error | Exactly one `#` heading (your name) at the top |
| `contact-line` | error / warning | Email present (error); phone present, no bare "LinkedIn" labels, no URLs hidden behind link text (warnings) |
| `required-sections` | error | Sections listed in `requiredSections` exist (aliases accepted) |
| `no-unsafe-blocks` | error / warning | No tables, images, raw HTML, or code blocks (incl. accidental 4-space indents); no `####` headings |
| `experience-dates` | error / info | Each experience entry has a date range; info when dates sit in the heading instead of the meta line |
| `date-format-consistency` | warning | Entry dates share one format, with a suggested rewrite |
| `first-person` | warning | No I/me/my/we/our in bullets (the summary is exempt) |
| `empty-section` | warning | No empty sections |
| `decorative-characters` | warning | No emoji or icon glyphs |
| `standard-headings` | info | Section names map to standard fields |
| `weak-openers` | info | Bullets don't start with "Responsible for", "Helped", etc. |
| `long-bullets` | info | Bullets under ~300 characters |

## What this does not claim

ATS products differ, so no checker can guarantee how a specific employer's system
parses a file. These rules target the most common, well-documented failure causes:
nonstandard structure, tables, images, hidden text, and inconsistent dates.

## Adding a rule

1. Add an object `{ id, description, check(ctx) }` to the `rules` array.
2. `ctx` has `markdown`, `lines`, `outline` (tokens + sections), and `target` (config).
3. Return `[{ severity, line, message, fix }]`.
4. Add a passing and a failing case to `test/validate.test.js`, and a row here.
