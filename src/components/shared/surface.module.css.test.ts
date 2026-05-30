import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "shared.module.css"), "utf8");

describe("shared.module.css surface composables", () => {
  it("defines the control surface and its interaction states", () => {
    expect(css).toMatch(/\.surface--control\s*\{/);
    // Hover lift is guarded against disabled consumers (single source of truth —
    // no per-consumer reset). Match the hover selector regardless of guards.
    expect(css).toMatch(/\.surface--control:hover[^{]*\{/);
    expect(css).toMatch(/\.surface--control:hover:not\(:disabled\):not\(\[data-disabled\]\)/);
    expect(css).toMatch(/\.surface--control:focus-within\s*\{/);
  });

  it("defines the chrome surface and its hover state", () => {
    expect(css).toMatch(/\.surface--chrome\s*\{/);
    expect(css).toMatch(/\.surface--chrome:hover\s*\{/);
  });

  it("defines a destructive tone modifier", () => {
    expect(css).toMatch(/\.tone--destructive\s*\{/);
  });
});

describe("shared.module.css icon-button size scale", () => {
  const css = readFileSync(join(__dirname, "shared.module.css"), "utf8");
  it("defines sm/md size variants", () => {
    expect(css).toMatch(/\.icon-button--sm\s*\{[^}]*width:\s*2rem;[^}]*height:\s*2rem;/s);
    expect(css).toMatch(/\.icon-button--md\s*\{[^}]*width:\s*2\.75rem;/s);
  });
  it("makes .icon-button compose the chrome surface", () => {
    expect(css).toMatch(/\.icon-button\s*\{[^}]*composes:\s*surface--chrome/s);
  });
});

describe("shared.module.css chip resting border (regression)", () => {
  const css = readFileSync(join(__dirname, "shared.module.css"), "utf8");
  // The base `.toggle-btn` sets `border: 1px solid transparent` and appears
  // later in the file, so a single-class `.toggle-btn--chip` border loses on
  // source order. The chip border must be declared with the higher-specificity
  // compound `.toggle-btn.toggle-btn--chip` selector so it actually renders.
  it("declares the chip resting border via the compound selector", () => {
    expect(css).toMatch(
      /\.toggle-btn\.toggle-btn--chip:not\(\.active\)\s*\{[^}]*border-color:\s*var\(--dc-border\)/s,
    );
  });
});
