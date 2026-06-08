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
  it("defines mobile progression toolbar button size overrides", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.toolbar-button\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.delete-button\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.grouped-button\s*\{[^}]*height:\s*var\(--control-height\)/s,
    );
  });

  it("defines mobile root-quality flex row, lock-label sr-only, and lock-toggle size overrides", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.root-quality-row\s*\{[^}]*display:\s*flex/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.lock-label\s*\{[^}]*clip-path:\s*inset\(50%\)/s,
    );
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.lock-toggle\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
  });

  it("defines mobile editor pager button size", () => {
    expect(css).toMatch(
      /:global\(\.app-container\[data-layout-tier="mobile"\]\)\s+\.pager-button\s*\{[^}]*width:\s*var\(--control-height\)/s,
    );
  });
});


