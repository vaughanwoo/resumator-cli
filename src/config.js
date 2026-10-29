import fs from "node:fs";
import path from "node:path";

export const CONFIG_FILE = "resume.config.json";

/** A user-facing error: the CLI prints the message without a stack trace. */
export class UsageError extends Error {}

/**
 * Read resume.config.json and merge each target with the shared defaults.
 * Returns { root, defaults, targets: Map<id, target> }.
 */
export function loadConfig(root = process.cwd()) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    throw new UsageError(`Could not find ${CONFIG_FILE} in ${root}. Run commands from the project root.`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new UsageError(`${CONFIG_FILE} is not valid JSON: ${err.message}`);
  }

  const defaults = raw.defaults ?? {};
  const entries = Object.entries(raw.resumes ?? {});
  if (entries.length === 0) {
    throw new UsageError(`${CONFIG_FILE} has no entries under "resumes".`);
  }

  const targets = new Map();
  for (const [id, entry] of entries) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
      throw new UsageError(`Resume id "${id}" must be lowercase words separated by hyphens, e.g. "support-engineer".`);
    }
    if (!entry.source) {
      throw new UsageError(`Resume "${id}" is missing a "source" path.`);
    }
    const merged = { ...defaults, ...entry, id };
    merged.sourcePath = path.resolve(root, merged.source);
    merged.outputPath = path.resolve(root, merged.outputDir ?? "dist", id);
    targets.set(id, merged);
  }

  return { root, defaults, targets };
}

/**
 * Turn CLI input (an id, several ids, or --all) into a list of targets.
 * Refuses to guess: no selection is an error that lists what's available.
 */
export function resolveTargets(config, ids = [], { all = false } = {}) {
  const available = [...config.targets.keys()];
  const hint = `\n\nAvailable resumes:\n${available.map((id) => `  ${id}`).join("\n")}`;

  if (all) return [...config.targets.values()];
  if (ids.length === 0) {
    throw new UsageError(`Please select a resume, or pass --all.${hint}\n\nExample:\n  yarn resume build ${available[0]}`);
  }

  return ids.map((id) => {
    const target = config.targets.get(id);
    if (!target) throw new UsageError(`Unknown resume "${id}".${hint}`);
    if (!fs.existsSync(target.sourcePath)) {
      throw new UsageError(`Resume "${id}" points to ${target.source}, but that file does not exist.`);
    }
    return target;
  });
}
