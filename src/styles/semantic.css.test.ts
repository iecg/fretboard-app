import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "semantic.css"), "utf8");

describe("semantic.css --dc-* control-surface tokens", () => {
  it("dark/default resting surface reads against flat cards", () => {
    expect(css).toContain("--dc-bg: rgb(77 228 255 / 0.05);");
    expect(css).toContain("--dc-border: rgb(77 228 255 / 0.28);");
  });

  it("light-mode resting surface reads against flat cards", () => {
    expect(css).toContain("--dc-bg: rgb(20 112 136 / 0.06);");
    expect(css).toContain("--dc-border: rgb(20 112 136 / 0.32);");
  });

  it("keeps both dark occurrences (root + modern-dark) in sync", () => {
    const matches = css.match(/--dc-border: rgb\(77 228 255 \/ 0\.28\);/g) ?? [];
    expect(matches.length).toBe(2);
  });
});
