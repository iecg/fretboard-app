import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Inspector.module.css", () => {
  it("no longer composes the faceplate surface", () => {
    const css = readFileSync(
      join(__dirname, "Inspector.module.css"),
      "utf8",
    );
    expect(css).not.toMatch(/composes:\s*faceplate/);
  });
});
