import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("ProgressionTrack.module.css", () => {
  it("does not compose the faceplate surface", () => {
    const css = readFileSync(
      join(__dirname, "ProgressionTrack.module.css"),
      "utf8",
    );
    expect(css).not.toMatch(/composes:\s*faceplate/);
  });
});
