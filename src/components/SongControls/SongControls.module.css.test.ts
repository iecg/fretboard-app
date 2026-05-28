import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "SongControls.module.css"), "utf8");

describe("SongControls button chrome", () => {
  it("toolbar button composes the control surface", () => {
    expect(css).toMatch(/\.toolbar-button\s*\{[^}]*composes:\s*surface--control/s);
  });
  it("delete button composes the control surface with the destructive tone", () => {
    expect(css).toMatch(/\.delete-button\s*\{[^}]*composes:\s*surface--control\s+tone--destructive/s);
  });
});
