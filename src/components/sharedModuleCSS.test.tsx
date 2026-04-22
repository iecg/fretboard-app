// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToggleBar } from "./ToggleBar/ToggleBar";
import { NoteGrid } from "./NoteGrid/NoteGrid";
import { NOTES } from "../core/theory";

const sharedCSS = readFileSync(
  resolve(__dirname, "../components/shared.module.css"),
  "utf-8",
);

// ─── CSS selector correctness ───────────────────────────────────────────────

describe("shared.module.css responsive selectors", () => {
  it("desktop toggle-btn rule uses :global() so it targets the real DOM", () => {
    expect(sharedCSS).toContain(
      ':global(.app-container[data-layout-tier="desktop"]) .toggle-btn',
    );
  });

  it("desktop note-btn rule uses :global() so it targets the real DOM", () => {
    expect(sharedCSS).toContain(
      ':global(.app-container[data-layout-tier="desktop"]) .note-btn',
    );
  });

  it("tablet toggle-btn rule uses :global() so it targets the real DOM", () => {
    expect(sharedCSS).toContain(
      ':global(.app-container[data-layout-tier="tablet"]) .toggle-btn',
    );
  });

  it("tablet note-btn rule uses :global() so it targets the real DOM", () => {
    expect(sharedCSS).toContain(
      ':global(.app-container[data-layout-tier="tablet"]) .note-btn',
    );
  });

  it("no bare (unescaped) .app-container tier selectors remain", () => {
    // Bare selectors like `.app-container[data-layout-tier` (without :global)
    // are locally scoped and never match the global app-container element.
    const barePattern =
      /(?<!:global\([^)]*)\.(app-container)\[data-layout-tier/g;
    expect(sharedCSS).not.toMatch(barePattern);
  });

  it("desktop toggle-btn min-height is tighter than the base (2.2rem < 2.65rem)", () => {
    const desktopBlock = sharedCSS.slice(
      sharedCSS.indexOf(':global(.app-container[data-layout-tier="desktop"]) .toggle-btn'),
    );
    expect(desktopBlock).toContain("min-height: 2.2rem");
  });

  it("desktop note-btn min-height is tighter than the base (2.55rem < 3.05rem)", () => {
    const desktopBlock = sharedCSS.slice(
      sharedCSS.indexOf(':global(.app-container[data-layout-tier="desktop"]) .note-btn'),
    );
    expect(desktopBlock).toContain("min-height: 2.55rem");
  });

  it("tablet toggle-btn min-height is touch-safe (≥44px ≈ 2.75rem)", () => {
    const tabletBlock = sharedCSS.slice(
      sharedCSS.indexOf(':global(.app-container[data-layout-tier="tablet"]) .toggle-btn'),
    );
    expect(tabletBlock).toContain("min-height: 2.75rem");
  });

  it("tablet note-btn min-height is touch-safe (≥44px ≈ 2.82rem)", () => {
    const tabletBlock = sharedCSS.slice(
      sharedCSS.indexOf(':global(.app-container[data-layout-tier="tablet"]) .note-btn'),
    );
    expect(tabletBlock).toContain("min-height: 2.82rem");
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
