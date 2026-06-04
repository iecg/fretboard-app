// @vitest-environment node
import { describe, it, expect } from "vitest";
import { differenceEuclidean, parse, converter, formatHex } from "culori";
import { readThemeBlock, resolveVar } from "./cssTokens";
import { contrastAPCA } from "./cssTokens";

const toRgb = converter("rgb");
const deltaE = differenceEuclidean("oklab");

// The migration MUST be visually equivalent to these pre-migration resolved values.
const EXPECTED = {
  "modern-light": {
    "--fb-home-fill": "#b5670a",
    "--fb-home-stroke": "#b1431b",
    "--fb-guide-fill": "#cfeefb",
    "--fb-guide-stroke": "#1583a6",
    "--fb-neutral-fill": "#e3ddd8",
    "--fb-neutral-stroke": "#574d40",
  },
  "modern-dark": {
    "--fb-home-fill": "#b5670a",
    "--fb-home-stroke": "#FF9A4D", // dark resolves through :root --neon-orange, not #b1431b
    "--fb-guide-fill": "#1f5876",
    "--fb-guide-stroke": "#7cecff",
    "--fb-neutral-fill": "#1b232c",
    "--fb-neutral-stroke": "#9aa3ab",
  },
} as const;

describe("--fb-* tokens migrated to equivalent OKLCH", () => {
  for (const [theme, tokens] of Object.entries(EXPECTED)) {
    const block = readThemeBlock(theme);
    for (const [token, hex] of Object.entries(tokens)) {
      it(`${theme} ${token} ≈ ${hex} (ΔE<0.02)`, () => {
        const raw = resolveVar(block[token], block);
        expect(raw, `${token} should be an oklch() value`).toMatch(/oklch\(/);
        const got = toRgb(parse(raw));
        const want = toRgb(parse(hex));
        expect(got).toBeTruthy();
        expect(want).toBeTruthy();
        expect(deltaE(got!, want!)).toBeLessThan(0.02);
      });
    }
  }
});

// Resolve an oklch()/hex token to a hex string the APCA helper accepts.
const hexOf = (v: string) => formatHex(parse(v)) ?? v;

/**
 * Glyph-on-fill text gate. The note-number glyph IS text and sits on the solid
 * marker fills, so a real APCA text-tier threshold applies here (|Lc| ≥ 45 for
 * the bold ~14px label). This is the legibility check that matters — distinct
 * from the informational fill-vs-wood audit (see
 * docs/superpowers/specs/2026-06-03-fb-marker-apca-audit.md), which does NOT
 * gate because marker discs are not text and carry a stroke for edge definition.
 *
 * Glyph colors are taken from the ACTUAL per-role rules in
 * src/components/FretboardSVG/FretboardSVG.module.css:
 *  - Home markers (.chord-root/.chord-root-outside/.key-tonic text) render a
 *    white #ffffff glyph in BOTH themes (lines 81-82) — the generic light-mode
 *    ink override is superseded by this more-specific rule.
 *  - Light-theme guide/neutral filled markers render the INK glyph
 *    var(--note-label-on-color) (lines 130-134, 156-159).
 *  - Dark-theme guide/neutral filled markers render white #ffffff
 *    (lines 65, 141-149).
 *
 * Only FILLED markers are gated; hollow/recessed glyph-on-wood notes are out of
 * scope (halo-assisted, not a solid-fill text gate).
 */
const APCA_TEXT_MIN = 45;

describe("APCA: glyph legible on solid marker fills (text gate)", () => {
  // Per-theme glyph color resolver for the three filled-marker roles.
  const glyphFor = (
    theme: "modern-light" | "modern-dark",
    token: string,
    block: Record<string, string>,
  ): string => {
    if (theme === "modern-dark") return "#ffffff";
    // light theme
    if (token === "--fb-home-fill") return "#ffffff"; // CSS literal, lines 81-82
    return resolveVar(block["--note-label-on-color"], block); // INK token
  };

  for (const theme of ["modern-light", "modern-dark"] as const) {
    const block = readThemeBlock(theme);
    const fills = ["--fb-home-fill", "--fb-guide-fill", "--fb-neutral-fill"];
    for (const token of fills) {
      it(`${theme} glyph on ${token} |Lc|≥${APCA_TEXT_MIN}`, () => {
        const fillHex = hexOf(resolveVar(block[token], block));
        const glyphHex = hexOf(glyphFor(theme, token, block));
        const lc = Math.abs(contrastAPCA(glyphHex, fillHex));
        expect(lc).toBeGreaterThanOrEqual(APCA_TEXT_MIN);
      });
    }
  }
});
