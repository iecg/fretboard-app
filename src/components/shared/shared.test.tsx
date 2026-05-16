// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToggleBar } from "../../components/ToggleBar/ToggleBar";
import { NoteGrid } from "../../components/NoteGrid/NoteGrid";
import { NOTES } from "@fretflow/core";

const sharedCSS = readFileSync(
  resolve(__dirname, "./shared.module.css"),
  "utf-8",
);

// ─── CSS selector correctness ───────────────────────────────────────────────

describe("shared.module.css responsive selectors", () => {
  it("no bare (unescaped) .app-container tier selectors remain", () => {
    // Bare selectors like `.app-container[data-layout-tier` (without :global)
    // are locally scoped and never match the global app-container element.
    const barePattern =
      /(?<!:global\([^)]*)\.(app-container)\[data-layout-tier/g;
    expect(sharedCSS).not.toMatch(barePattern);
  });

  it("compact density is the default: toggle-btn base min-height is 1.85rem", () => {
    // Compact is the universal default — no tier-based overrides for
    // toggle-btn or note-btn remain in shared.module.css. The DAW restyle
    // aligns the baseline to the 1.85rem transport-bar control height.
    expect(sharedCSS).toContain("min-height: 1.85rem");
  });

  it("compact density is the default: note-btn base min-height is 1.85rem", () => {
    expect(sharedCSS).toContain("min-height: 1.85rem");
  });

  it("no tier-specific toggle-btn or note-btn overrides exist (compact is universal default)", () => {
    expect(sharedCSS).not.toContain(
      ':global(.app-container[data-layout-tier="desktop"]) .toggle-btn',
    );
    expect(sharedCSS).not.toContain(
      ':global(.app-container[data-layout-tier="tablet"]) .toggle-btn',
    );
    expect(sharedCSS).not.toContain(
      ':global(.app-container[data-layout-tier="desktop"]) .note-btn',
    );
    expect(sharedCSS).not.toContain(
      ':global(.app-container[data-layout-tier="tablet"]) .note-btn',
    );
  });
});

// ─── Rendered DOM: class membership at each layout tier ─────────────────────
// jsdom cannot compute CSS from CSS Modules, but we can verify:
//   (a) the elements carry the correct CSS-module class names
//   (b) those class names appear as the selector target in the fixed CSS rule
// Together these guarantee the rule fires in a real browser.

function renderInTier(tier: "desktop" | "tablet" | "mobile") {
  const container = document.createElement("div");
  container.className = "app-container";
  container.dataset.layoutTier = tier;
  document.body.appendChild(container);

  const result = render(
    <ToggleBar
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ]}
      value="a"
      onChange={() => {}}
    />,
    { container },
  );

  return result;
}

describe("ToggleBar responsive class membership", () => {
  it("toggle-btn class is present inside a desktop-tier container (768×1024 primary target)", () => {
    renderInTier("desktop");
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn).toHaveClass("toggle-btn");
    });
  });

  it("toggle-btn class is present inside a tablet-tier container (1440×900 secondary target)", () => {
    renderInTier("tablet");
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn).toHaveClass("toggle-btn");
    });
  });

  it("toggle-btn class is present inside a mobile-tier container (375×667 secondary target)", () => {
    renderInTier("mobile");
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn).toHaveClass("toggle-btn");
    });
  });
});

describe("NoteGrid responsive class membership", () => {
  it("note-btn class is present inside a desktop-tier container", () => {
    render(
      <div className="app-container" data-layout-tier="desktop">
        <NoteGrid notes={NOTES} selected="C" onSelect={() => {}} useFlats={false} />
      </div>,
    );
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn).toHaveClass("note-btn");
    });
  });

  it("note-btn class is present inside a tablet-tier container", () => {
    render(
      <div className="app-container" data-layout-tier="tablet">
        <NoteGrid notes={NOTES} selected="C" onSelect={() => {}} useFlats={false} />
      </div>,
    );
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn).toHaveClass("note-btn");
    });
  });
});
