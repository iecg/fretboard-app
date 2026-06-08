import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(
  join(__dirname, "ProgressionStepList.module.css"),
  "utf8",
);

describe("ProgressionStepList.module.css mobile rules", () => {
  it("sizes the list column to its content height on mobile", () => {
    // Guards the flex-basis-axis bug: when the master-detail flips to a column,
    // `.col`'s desktop `flex: 5 1 13rem` would otherwise cap the list at 13rem
    // tall and overflow onto the editor panel below it.
    expect(css).toMatch(
      /data-layout-tier="mobile"[\s\S]*\.col\s*\{[^}]*flex:\s*0 0 auto/,
    );
  });

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
