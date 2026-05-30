import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "SongControls.module.css"), "utf8");

describe("SongControls button chrome", () => {
  it("toolbar button composes the control surface", () => {
    expect(css).toMatch(/\.toolbar-button\s*\{[^}]*composes:\s*surface--control/s);
  });
  it("delete button is neutral at rest and turns destructive on hover", () => {
    // Neutral resting surface (no destructive tone at rest)…
    expect(css).toMatch(/\.delete-button\s*\{[^}]*background-color:\s*var\(--dc-bg\)/s);
    // …revealing the destructive tone only on hover.
    expect(css).toMatch(/\.delete-button:hover:not\(:disabled\)\s*\{[^}]*var\(--destructive-control-fg\)/s);
  });
});
