// @vitest-environment node
import { describe, it, expect } from "vitest";
// The checker lives in scripts/ (a plain .mjs run via `node scripts/ui-tokens.mjs`).
// These tests cover only its pure parsing/diff functions, deterministically —
// they do NOT assert anything about the repo's current tokens, so this spec can
// never silently become a CI gate (the owner's decision: the script is a
// dev-time tool, not a merge blocker).
import {
  parseDefinitions,
  parseReferences,
  parseInlineDefinitions,
  findUndefined,
  EXTERNAL_TOKEN_PREFIXES,
} from "../../../scripts/ui-tokens.mjs";

describe("parseDefinitions", () => {
  it("collects declared tokens and ignores var() references in values", () => {
    const css = ":root { --a: 1px; --b: var(--a); }";
    expect(parseDefinitions(css)).toEqual(["--a", "--b"]);
  });

  it("finds declarations across nested blocks (@media, [data-*])", () => {
    const css = `
      :root { --a: 1; }
      @media (max-width: 767px) { :root { --b: 2; } }
      [data-theme="light"] { --c: 3; }
    `;
    expect(parseDefinitions(css).sort()).toEqual(["--a", "--b", "--c"]);
  });
});

describe("parseReferences", () => {
  it("captures each var() with line number and fallback presence", () => {
    const css = "a {\n  color: var(--x);\n  background: var(--y, #fff);\n}";
    expect(parseReferences(css)).toEqual([
      { name: "--x", line: 2, hasFallback: false },
      { name: "--y", line: 3, hasFallback: true },
    ]);
  });

  it("captures both names in a nested var() fallback chain", () => {
    const css = "a { color: var(--a, var(--b)); }";
    const names = parseReferences(css).map((r) => r.name);
    expect(names).toEqual(["--a", "--b"]);
  });
});

describe("parseInlineDefinitions", () => {
  it("collects React inline-style token keys (single or double quoted)", () => {
    const tsx = `const style = { "--note-r": r, '--guide-duration': ms, color: x };`;
    expect(parseInlineDefinitions(tsx).sort()).toEqual([
      "--guide-duration",
      "--note-r",
    ]);
  });

  it("ignores var() references written in a TS string", () => {
    const tsx = `const s = "var(--x)";`;
    expect(parseInlineDefinitions(tsx)).toEqual([]);
  });
});

describe("findUndefined", () => {
  const defined = new Set(["--a"]);

  it("flags references with no matching definition", () => {
    const refs = [
      { name: "--a", line: 1, hasFallback: false, file: "x.css" },
      { name: "--does-not-exist", line: 2, hasFallback: false, file: "x.css" },
    ];
    expect(findUndefined(defined, refs).map((r) => r.name)).toEqual([
      "--does-not-exist",
    ]);
  });

  it("preserves the fallback flag so callers can downgrade those to warnings", () => {
    const refs = [{ name: "--missing", line: 1, hasFallback: true, file: "x.css" }];
    const [hit] = findUndefined(defined, refs);
    expect(hit.hasFallback).toBe(true);
  });

  it("treats externally-injected tokens (e.g. --radix-*) as defined", () => {
    expect(EXTERNAL_TOKEN_PREFIXES).toContain("--radix-");
    const refs = [
      {
        name: "--radix-select-trigger-width",
        line: 1,
        hasFallback: false,
        file: "x.css",
      },
    ];
    expect(findUndefined(defined, refs)).toEqual([]);
  });
});
