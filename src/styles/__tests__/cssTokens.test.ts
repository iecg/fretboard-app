// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readThemeBlock, resolveVar, contrastAPCA } from "./cssTokens";

describe("cssTokens helper", () => {
  it("extracts a custom property from a theme block", () => {
    const light = readThemeBlock("modern-light");
    expect(light["--fb-home-fill"]).toBeDefined();
  });

  it("one-hop resolves a var() reference within the block", () => {
    const light = readThemeBlock("modern-light");
    // --fb-connector-accent: var(--chord-connector-color-2); --chord-connector-color-2: #D55E00
    expect(resolveVar(light["--fb-connector-accent"], light)).toBe("#D55E00");
  });

  it("computes APCA Lc with the expected sign and magnitude", () => {
    // Black text on white bg → APCA ≈ 106 (light-context, large positive)
    expect(Math.round(contrastAPCA("#000000", "#ffffff"))).toBeGreaterThan(100);
    // White text on black bg → APCA ≈ -108 (dark-context, large negative)
    expect(Math.round(contrastAPCA("#ffffff", "#000000"))).toBeLessThan(-100);
  });
});
