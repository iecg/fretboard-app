import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Inspector.module.css", () => {
  it("no longer composes the faceplate surface", () => {
    const css = readFileSync(
      join(__dirname, "Inspector.module.css"),
      "utf8",
    );
    expect(css).not.toMatch(/composes:\s*faceplate/);
  });

  it("hides inactive tab panels (forceMount keep-alive needs explicit hiding)", () => {
    const css = readFileSync(
      join(__dirname, "Inspector.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.tabPanel\[data-state="inactive"\]\s*\{[^}]*display:\s*none/s,
    );
  });

  it("defines mobile cardHeadActions order and flex behavior", () => {
    const css = readFileSync(
      join(__dirname, "InspectorCard.module.css"),
      "utf8",
    );
    // The mobile-tier selector shares its rule with the sheet-placement hook,
    // so allow additional selectors between it and the block.
    expect(css).toMatch(
      /:global\(\[data-layout-tier="mobile"\]\)\s+\.cardHeadActions\s*[^{]*\{[^}]*order:\s*3/s,
    );
  });
});

