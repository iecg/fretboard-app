import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("StepperControl.module.css", () => {
  it("uses --control-height token in mobile stepper-btn", () => {
    const css = readFileSync(join(__dirname, "StepperControl.module.css"), "utf8");
    expect(css).toMatch(
      /\.stepper-control\.mobile\s+\.stepper-btn\s*\{[^}]*min-height:\s*var\(--control-height\)/s,
    );
  });
});
