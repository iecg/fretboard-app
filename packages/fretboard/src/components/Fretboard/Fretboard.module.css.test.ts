import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(join(__dirname, "Fretboard.module.css"), "utf8");

describe("Fretboard.module.css scroll rules", () => {
  it("clips the wrapper by default to contain sub-pixel paint bleed", () => {
    expect(css).toMatch(/\.fretboard-wrapper\s*\{[^}]*overflow:\s*clip/);
  });

  // Regression: desktop was missing from the scroll override, so an
  // overflowing board stayed `overflow: clip` and could not scroll, while
  // tablet/mobile scrolled fine.
  it("enables horizontal scroll on desktop when the board overflows", () => {
    expect(css).toMatch(
      /data-layout-tier="desktop"\]\)\s*\.fretboard-wrapper[\s\S]*?overflow-x:\s*auto/,
    );
  });

  it("enables horizontal scroll on tablet", () => {
    expect(css).toMatch(
      /data-layout-tier="tablet"\]\)\s*\.fretboard-wrapper[\s\S]*?overflow-x:\s*auto/,
    );
  });

  it("enables horizontal scroll on mobile", () => {
    expect(css).toMatch(
      /data-layout-tier="mobile"\]\)\s*\.fretboard-wrapper[\s\S]*?overflow-x:\s*auto/,
    );
  });
});
