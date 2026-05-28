import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("control-surface composition", () => {
  it("StepperShell .shell composes surface--control", () => {
    const css = readFileSync(join(__dirname, "StepperShell.module.css"), "utf8");
    expect(css).toMatch(/\.shell\s*\{[^}]*composes:\s*surface--control\s+from/s);
  });
  it("LabeledSelect trigger composes surface--control", () => {
    const css = readFileSync(
      join(__dirname, "../LabeledSelect/LabeledSelect.module.css"),
      "utf8",
    );
    expect(css).toMatch(/composes:\s*surface--control\s+from/);
  });
});
