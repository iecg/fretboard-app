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
    // --fb-home-stroke: var(--note-ring-tonic); --note-ring-tonic: #b1431b
    expect(resolveVar(light["--fb-home-stroke"], light)).toBe("#b1431b");
  });

  it("computes APCA Lc with the expected sign and magnitude", () => {
    // Black text on white bg → APCA ≈ 106 (light-context, large positive)
    expect(Math.round(contrastAPCA("#000000", "#ffffff"))).toBeGreaterThan(100);
    // White text on black bg → APCA ≈ -108 (dark-context, large negative)
    expect(Math.round(contrastAPCA("#ffffff", "#000000"))).toBeLessThan(-100);
  });
});
