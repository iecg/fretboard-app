import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "shared.module.css"), "utf8");

describe("shared.module.css surface composables", () => {
  it("defines the control surface and its interaction states", () => {
    expect(css).toMatch(/\.surface--control\s*\{/);
    expect(css).toMatch(/\.surface--control:hover\s*\{/);
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
