import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(
  join(__dirname, "ProgressionStepList.module.css"),
  "utf8",
);

describe("ProgressionStepList.module.css mobile rules", () => {
  it("removes the inner list scroll cap on mobile", () => {
    expect(css).toMatch(
      /data-layout-tier="mobile"[\s\S]*\.list[\s\S]*max-height:\s*none/,
    );
  });

  it("hides the scroll edge fades on mobile", () => {
    expect(css).toMatch(
      /data-layout-tier="mobile"[\s\S]*\.scroll::before[\s\S]*display:\s*none/,
    );
  });
});
