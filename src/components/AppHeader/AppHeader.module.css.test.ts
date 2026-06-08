import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("AppHeader.module.css", () => {
  it("tightens mobile actions gap to 0.15rem", () => {
    const css = readFileSync(join(__dirname, "AppHeader.module.css"), "utf8");
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.app-header-actions\s*\{[^}]*gap:\s*0\.15rem/s,
    );
  });
});
