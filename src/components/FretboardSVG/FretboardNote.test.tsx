// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNote } from "./FretboardNote";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";

function makeNote(overrides: Partial<RenderedFretboardNote> = {}): RenderedFretboardNote {
  return {
    stringIndex: 0,
    fretIndex: 5,
    cx: 100,
    cy: 50,
    noteName: "C",
    octave: 4,
    noteClass: "note-active",
    displayName: "C",
    displayValue: "C",
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isInRegion: true,
    isHidden: false,
    isTension: false,
    isGuideTone: false,
    ...overrides,
  };
}

function renderNote(note: RenderedFretboardNote) {
  return render(
    <svg>
      <FretboardNote
        note={note}
        noteBubblePx={40}
        displayFormat="notes"
      />
    </svg>,
  );
}

describe("FretboardNote — transition-role data attribute", () => {
  it("renders data-transition-role='guide-target' on <g> when transitionRole is 'guide-target'", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "guide-target",
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
      }),
    );
    const g = container.querySelector("g[data-note-shape]");
    expect(g).not.toBeNull();
    expect(g?.getAttribute("data-transition-role")).toBe("guide-target");
  });

  it("does not emit data-transition-role when transitionRole is undefined", () => {
    const { container } = renderNote(makeNote({ transitionRole: undefined }));
    const g = container.querySelector("g[data-note-shape]");
    expect(g?.getAttribute("data-transition-role")).toBeNull();
  });
});

describe("FretboardNote — in-region data attribute", () => {
  it("renders data-in-region='true' when isInRegion is true", () => {
    const { container } = renderNote(makeNote({ isInRegion: true }));
    const g = container.querySelector("g[data-note-shape]");
    expect(g?.getAttribute("data-in-region")).toBe("true");
  });

  it("omits data-in-region when isInRegion is false", () => {
    const { container } = renderNote(makeNote({ isInRegion: false }));
    const g = container.querySelector("g[data-note-shape]");
    expect(g?.getAttribute("data-in-region")).toBeNull();
  });
});


describe("FretboardNote — guide-target ring", () => {
  it("renders a guide-target ring when the note's transition role is guide-target", () => {
    const note = makeNote({
      transitionRole: "guide-target",
      applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1, transitionRole: "guide-target" },
    });
    const { container } = renderNote(note);
    expect(container.querySelector("[data-guide-ring]")).not.toBeNull();
  });

  it("renders no guide-target ring for a normal note", () => {
    const note = makeNote({ transitionRole: undefined });
    const { container } = renderNote(note);
    expect(container.querySelector("[data-guide-ring]")).toBeNull();
  });
});

describe("FretboardNote — guide-target interval label", () => {
  it("renders the guide-target interval label", () => {
    const note = makeNote({
      transitionRole: "guide-target",
      applyLensEmphasis: {
        radiusBoost: 1.15,
        opacityBoost: 1,
        transitionRole: "guide-target",
        guideTargetLabel: "3",
      },
    });
    const { container } = renderNote(note);
    expect(container.querySelector("[data-guide-label]")?.textContent).toBe("3");
  });
});

describe("FretboardNote — full-chord mode no longer recolors by shape", () => {
  it("does not recolor notes by CAGED shape in full-chord mode", () => {
    const { container } = renderNote(
      makeNote({ noteClass: "chord-tone-in-scale", fullChordShape: "E" }),
    );
    const g = container.querySelector("g[data-note-shape]") as SVGGElement;
    expect((g.style as CSSStyleDeclaration).getPropertyValue("--shape-fill")).toBe("");
  });
});

describe("FretboardNote — chromatic diamond rendering", () => {
  it("renders a chord-tone-outside-scale note as a diamond <polygon>", () => {
    const { container } = renderNote(makeNote({ noteClass: "chord-tone-outside-scale" }));
    const g = container.querySelector("g[data-note-shape]");
    expect(g).not.toBeNull();
    expect(g?.getAttribute("data-note-shape")).toBe("diamond");
    expect(g?.querySelector("polygon")).not.toBeNull();
  });

  it("renders a note-blue note as a diamond <polygon>", () => {
    const { container } = renderNote(makeNote({ noteClass: "note-blue" }));
    const g = container.querySelector("g[data-note-shape]");
    expect(g?.getAttribute("data-note-shape")).toBe("diamond");
    expect(g?.querySelector("polygon")).not.toBeNull();
  });

  it("renders a chord-root-outside note as a diamond <polygon>", () => {
    const { container } = renderNote(makeNote({ noteClass: "chord-root-outside" }));
    const g = container.querySelector("g[data-note-shape]");
    expect(g).not.toBeNull();
    expect(g?.getAttribute("data-note-shape")).toBe("diamond");
    expect(g?.querySelector("polygon")).not.toBeNull();
  });
});


describe("FretboardNote — two-phase guide ring", () => {
  it("renders the ring with data-guide-phase='preview' for a guide-preview note", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "guide-preview",
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, guideTargetLabel: "3" },
      }),
    );
    const ring = container.querySelector("[data-guide-ring]");
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("data-guide-phase")).toBe("preview");
  });

  it("renders the ring with data-guide-phase='landing' for a guide-target note", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target" }),
    );
    const ring = container.querySelector("[data-guide-ring]");
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("data-guide-phase")).toBe("landing");
  });

  it("renders no guide ring when there is no transition role", () => {
    const { container } = renderNote(makeNote({ transitionRole: undefined }));
    expect(container.querySelector("[data-guide-ring]")).toBeNull();
  });
});

