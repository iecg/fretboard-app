// @vitest-environment node
import { describe, it, expect } from "vitest";
import { differenceEuclidean, parse, converter } from "culori";
import { readThemeBlock, resolveVar } from "./cssTokens";

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
