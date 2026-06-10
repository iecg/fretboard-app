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

  it("gives the timeline a duration-driven minimum width on all tiers", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "ProgressionTrack.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.timeline[\s\S]*min-width:\s*max\(100%,\s*var\(--mobile-timeline-min-width/,
    );
  });

  it("removes top border on mobile track", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "ProgressionTrack.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      /:global\(\[data-layout-tier="mobile"\]\)\s+\.track\s*\{[^}]*border-top:\s*none/s,
    );
  });
});
