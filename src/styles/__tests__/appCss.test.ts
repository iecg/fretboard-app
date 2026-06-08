import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("App.css layout", () => {
  it("uses 0.35rem gap for app-container on mobile viewports", () => {
    const css = readFileSync(join(__dirname, "../App.css"), "utf8");
    expect(css).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)\s*\{[^}]*\.app-container\s*\{[^}]*gap:\s*0\.35rem/s);
  });
});
