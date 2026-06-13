// scripts/check-fretboard-boundaries.mjs
// @fretflow/fretboard must be consumable by both Vite (web) and Metro (Expo
// DOM island). Enforce on PRODUCTION (non-test) files: (1) no relative import
// escapes the package's src/, (2) no import.meta (Metro cannot parse it).
// Test files (*.test.*, *.spec.*) are exempt — Metro never bundles them.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";

const ROOT = resolve("packages/fretboard/src");
const errors = [];

function isTestFile(name) {
  return name.includes(".test.") || name.includes(".spec.");
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // line comments (avoid eating http://)
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !isTestFile(name)) check(p);
  }
}

function check(file) {
  const text = readFileSync(file, "utf-8");
  if (stripComments(text).includes("import.meta")) {
    errors.push(`${file}: uses import.meta (Metro cannot parse it — use env.ts)`);
  }
  const specRe =
    /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
  for (const m of text.matchAll(specRe)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec.startsWith(".")) continue;
    const target = resolve(dirname(file), spec);
    if (!(target + sep).startsWith(ROOT + sep) && target !== ROOT) {
      errors.push(`${file}: relative import escapes package: "${spec}"`);
    }
  }
}

walk(ROOT);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("fretboard package boundaries OK");
