import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

describe("ProgressionTrack.module.css", () => {
  it("does not compose the faceplate surface", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "ProgressionTrack.module.css"),
      "utf8",
    );
    expect(css).not.toMatch(/composes:\s*faceplate/);
  });

  it("gives mobile progression timelines a duration-driven minimum width", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "ProgressionTrack.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      /data-layout-tier="mobile"[\s\S]*\.timeline[\s\S]*--mobile-timeline-min-width/,
    );
  });
});
