#!/usr/bin/env node
// Undefined CSS custom-property ("design token") checker.
//
// WHY: across the mobile redesign the same failure recurred — a stylesheet
// referenced `var(--some-token)` that was never defined anywhere, so the
// browser silently resolved it to nothing (e.g. `var(--border-subtle)` made a
// panel divider render transparent). Nothing caught it. This script is the
// deterministic, dev-time guard: it flags every `var(--x)` in the project's
// CSS whose `--x` has no `--x: …` declaration in any project stylesheet.
//
// SCOPE (intentional, documented limits — keep zero false positives):
//   • A token counts as DEFINED if it is declared in any CSS file under src/
//     (`--x: …`) OR injected as a React inline-style key in any .ts/.tsx under
//     src/ (`"--x": value` — e.g. FretboardNote sets `"--note-r": r`). Both
//     mechanisms are real in this project, so both are scanned.
//   • Definitions are pooled GLOBALLY across all files (custom properties
//     cascade), so a module-local `--x` defined and used in the same module is
//     valid and never flagged.
//   • `var(--x, fallback)` references are tolerant by design: an undefined one
//     is a WARNING, not an error (the fallback is intentional). Only undefined
//     references WITHOUT a fallback are errors and set a non-zero exit code.
//   • EXTERNAL_TOKEN_PREFIXES lists tokens defined at runtime by third-party
//     libraries (Radix injects `--radix-*` onto its portals). They are treated
//     as defined.
//
// Not a CI gate — run on demand via `pnpm run ui:tokens` or the `/ui-review`
// skill. See docs/design/mobile-ui-contract.md for the rule this enforces.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Token name prefixes defined at runtime by external libraries, not in CSS. */
export const EXTERNAL_TOKEN_PREFIXES = ["--radix-"];

/** Replace `/* … *\/` comments with same-length blanks (preserves line numbers
 *  and offsets) so neither declarations nor references are read out of them. */
function blankComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
}

/**
 * Collect every custom-property *declaration* name from a CSS string.
 * A `--name:` is always a declaration: a `var(--name)` reference is never
 * followed by `:` (it is followed by `)` or `,`), so matching `--name:`
 * captures declarations and only declarations — including ones that follow a
 * comment, which a `;`/`{`-anchored match would miss.
 */
export function parseDefinitions(cssText) {
  const names = [];
  for (const m of blankComments(cssText).matchAll(/(--[\w-]+)\s*:/g)) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Collect every `var(--name …)` *reference* from a CSS string, with its line
 * number and whether it carries a fallback (a comma before the closing paren).
 */
export function parseReferences(cssText) {
  const refs = [];
  for (const m of blankComments(cssText).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const line = cssText.slice(0, m.index).split("\n").length;
    refs.push({ name: m[1], line, hasFallback: Boolean(m[2]) });
  }
  return refs;
}

/**
 * Collect custom-property names injected as React inline-style object keys in a
 * JS/TS string — `"--name": value` or `'--name': value`. These are real token
 * definitions (set at runtime on the element) that never appear in CSS.
 */
export function parseInlineDefinitions(jsText) {
  const names = [];
  for (const m of jsText.matchAll(/['"](--[\w-]+)['"]\s*:/g)) {
    names.push(m[1]);
  }
  return names;
}

function isExternal(name) {
  return EXTERNAL_TOKEN_PREFIXES.some((p) => name.startsWith(p));
}

/**
 * Given a Set of defined token names and a list of references, return the
 * references whose token is neither defined nor externally provided.
 */
export function findUndefined(definedSet, refs) {
  return refs.filter((r) => !definedSet.has(r.name) && !isExternal(r.name));
}

/** Recursively list files under a directory whose name ends with one of the
 *  given extensions (e.g. [".css"] or [".ts", ".tsx"]). */
export function listFiles(dir, extensions) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "__snapshots__") continue;
      out.push(...listFiles(join(dir, ent.name), extensions));
    } else if (extensions.some((ext) => ent.name.endsWith(ext))) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

/** Global union of all token names declared across the given files: CSS
 *  declarations from `.css` files and React inline-style keys from `.ts`/`.tsx`
 *  files (dispatched by extension). */
export function collectDefinedTokens(files) {
  const defined = new Set();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const names = file.endsWith(".css")
      ? parseDefinitions(text)
      : parseInlineDefinitions(text);
    for (const name of names) defined.add(name);
  }
  return defined;
}

/** All `var()` references across the given CSS files, tagged with file. */
export function collectReferences(files) {
  const refs = [];
  for (const file of files) {
    for (const ref of parseReferences(readFileSync(file, "utf8"))) {
      refs.push({ ...ref, file });
    }
  }
  return refs;
}

function main() {
  const srcDir = fileURLToPath(new URL("../src", import.meta.url));
  // Fretboard tokens (--fb-*, --chord-connector-*, wood/wire/etc.) were
  // extracted into @fretflow/fretboard so the package is self-contained for
  // styling. The app's HelpModal diagrams still reference --fb-* from src/, so
  // the package's stylesheets must be pooled into the DEFINITIONS scan or those
  // references would be flagged undefined. References are still collected from
  // src/ only — the package's own var() usage carries inline fallbacks and
  // runtime-injected tokens the src-scoped checker is not designed to resolve.
  const pkgFretboardDir = fileURLToPath(
    new URL("../packages/fretboard/src", import.meta.url),
  );
  const cssFiles = listFiles(srcDir, [".css"]);
  // Token definitions live in CSS *and* in React inline-style keys (.ts/.tsx);
  // references only live in CSS.
  const defined = collectDefinedTokens([
    ...cssFiles,
    ...listFiles(srcDir, [".ts", ".tsx"]),
    ...listFiles(pkgFretboardDir, [".css"]),
    ...listFiles(pkgFretboardDir, [".ts", ".tsx"]),
  ]);
  const refs = collectReferences(cssFiles);
  const undefinedRefs = findUndefined(defined, refs);

  const errors = undefinedRefs.filter((r) => !r.hasFallback);
  const warnings = undefinedRefs.filter((r) => r.hasFallback);

  const fmt = (r) =>
    `  ${relative(process.cwd(), r.file)}:${r.line}  var(${r.name})`;
  const sortRefs = (a, b) =>
    a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name);

  if (errors.length === 0 && warnings.length === 0) {
    console.log(
      `✓ ui-tokens: all var() references resolve (${defined.size} tokens defined, ${refs.length} references across ${cssFiles.length} CSS files).`,
    );
    return 0;
  }

  if (errors.length > 0) {
    console.error(
      `\n✗ ui-tokens: ${errors.length} undefined token reference(s) with no fallback:\n`,
    );
    for (const r of [...errors].sort(sortRefs)) console.error(fmt(r));
    console.error(
      "\nDefine these in src/styles/tokens.css or semantic.css, or add an intentional fallback.\n",
    );
  }
  if (warnings.length > 0) {
    console.warn(
      `\n⚠ ui-tokens: ${warnings.length} undefined token reference(s) WITH a fallback (tolerated; confirm the fallback is intended):\n`,
    );
    for (const r of [...warnings].sort(sortRefs)) console.warn(fmt(r));
    console.warn("");
  }
  return errors.length > 0 ? 1 : 0;
}

// Guarded CLI entry — only runs when executed directly, never on import (so
// the Vitest spec can import the pure functions without side effects).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
