// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parse, converter, formatHex } from "culori";
import { readThemeBlock, contrastAPCA } from "./cssTokens";

const toRgb = converter("rgb");

/** Alpha-composite a (possibly translucent) CSS color over an opaque bg hex. */
function compositeOver(fg: string, bgHex: string): string {
  const f = toRgb(parse(fg));
  const b = toRgb(parse(bgHex));
  if (!f || !b) throw new Error(`unparseable color: ${fg} / ${bgHex}`);
  const a = f.alpha ?? 1;
  return formatHex({
    mode: "rgb",
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  });
}

// On light maple the casing is the load-bearing element: a dark outline that
// stays visible regardless of the (pale) core color. Floor = "clearly visible".
const LIGHT_CASING_FLOOR = 45;
// On dark rosewood the colors carry directly; the floor guards against a future
// dark-palette swap going too dark. Current min is blue (slot 6) at 27.
const DARK_COLOR_FLOOR = 25;
// Dark wood mid lives in tokens.css :root, not themes.css. Source:
// src/styles/tokens.css --fretboard-wood-mid.
const DARK_WOOD_MID = "#0d0805";
// CONNECTOR_PALETTE_ROTATION = [0,5,3,6,1,4] → render adds 1 → CSS slots below.
// (Gray slot 3 and yellow slot 8 are excluded from the rotation and never render.)
const ROTATION_SLOTS = [1, 6, 4, 7, 2, 5];

describe("connector legibility on wood", () => {
  it("light theme: composited dark casing clears the visibility floor on maple", () => {
    const light = readThemeBlock("modern-light");
    const wood = light["--fretboard-wood-mid"];
    const casing = light["--fb-connector-halo"];
    expect(wood, "--fretboard-wood-mid in modern-light").toBeDefined();
    expect(casing, "--fb-connector-halo in modern-light").toBeDefined();
    const effective = compositeOver(casing, wood);
    expect(Math.abs(contrastAPCA(effective, wood))).toBeGreaterThanOrEqual(
      LIGHT_CASING_FLOOR,
    );
  });

  it("dark theme: every rotation palette color clears the floor on rosewood", () => {
    const dark = readThemeBlock("modern-dark");
    for (const slot of ROTATION_SLOTS) {
      const color = dark[`--chord-connector-color-${slot}`];
      expect(color, `slot ${slot} defined`).toBeDefined();
      expect(
        Math.abs(contrastAPCA(color, DARK_WOOD_MID)),
        `slot ${slot} (${color}) vs rosewood`,
      ).toBeGreaterThanOrEqual(DARK_COLOR_FLOOR);
    }
  });
});
