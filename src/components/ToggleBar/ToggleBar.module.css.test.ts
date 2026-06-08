import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("ToggleBar.module.css", () => {
  it("uses --control-height token in mobile-tab min-height", () => {
    const css = readFileSync(join(__dirname, "ToggleBar.module.css"), "utf8");
    expect(css).toMatch(
      /\.mobile-tab-bar\s+\.mobile-tab\s*\{[^}]*min-height:\s*var\(--control-height\)/s,
    );
  });
});
