import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("control-surface composition", () => {
  it("LabeledSelect trigger composes surface--control", () => {
    const css = readFileSync(join(__dirname, "LabeledSelect.module.css"), "utf8");
    expect(css).toMatch(/composes:\s*surface--control\s+from/);
  });

  it("defines mobile item height override", () => {
    const css = readFileSync(join(__dirname, "LabeledSelect.module.css"), "utf8");
    expect(css).toMatch(
      /:global\(\[data-layout-tier="mobile"\]\)\s+\.labeled-select-item\s*\{[^}]*min-height:\s*var\(--control-height\)/s,
    );
  });
});
