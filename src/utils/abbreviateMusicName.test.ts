import { describe, it, expect } from "vitest";
import { abbreviateMusicName } from "./abbreviateMusicName";

describe("abbreviateMusicName", () => {
  it("abbreviates common quality words", () => {
    expect(abbreviateMusicName("C Major")).toBe("C Maj");
    expect(abbreviateMusicName("A Natural Minor")).toBe("A Nat Min");
    expect(abbreviateMusicName("G Dominant 7th")).toBe("G Dom 7th");
    expect(abbreviateMusicName("C Melodic Minor")).toBe("C Mel Min");
  });

  it("drops the word 'Triad' entirely", () => {
    expect(abbreviateMusicName("C Major Triad")).toBe("C Maj");
    expect(abbreviateMusicName("A Minor Triad")).toBe("A Min");
  });

  it("matches words case-insensitively", () => {
    expect(abbreviateMusicName("c MAJOR")).toBe("c Maj");
  });

  it("leaves words with no abbreviation untouched", () => {
    expect(abbreviateMusicName("D Dorian")).toBe("D Dorian");
    expect(abbreviateMusicName("E Phrygian")).toBe("E Phrygian");
  });

  it("collapses whitespace left by dropped words", () => {
    expect(abbreviateMusicName("C  Major   Triad")).toBe("C Maj");
  });
});
