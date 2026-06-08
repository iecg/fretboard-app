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

function renderNote(
  note: RenderedFretboardNote,
  extra?: { countdownTicks?: number[] },
) {
  return render(
    <svg>
      <FretboardNote
        note={note}
        noteBubblePx={40}
        displayFormat="notes"
        countdownTicks={extra?.countdownTicks}
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
  it("renders no ring for a note without a transition role", () => {
    const { container } = renderNote(makeNote({ transitionRole: undefined }));
    expect(container.querySelector("[data-guide-ring]")).toBeNull();
  });

  it("renders beat-tick notches for a primary guide-target note when ticks are provided", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target", isInRegion: true }),
      { countdownTicks: [0.25, 0.5, 0.75] },
    );
    expect(container.querySelectorAll("[data-guide-tick]")).toHaveLength(3);
  });

  it("renders no notches for a secondary (out-of-region) guide-target note", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target", isInRegion: false }),
      { countdownTicks: [0.25, 0.5, 0.75] },
    );
    expect(container.querySelectorAll("[data-guide-tick]")).toHaveLength(0);
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

  it("renders the ring as halo + core + on-beat flash circles for a target note", () => {
    const { container } = renderNote(makeNote({ transitionRole: "guide-target" }));
    const ring = container.querySelector("[data-guide-ring]");
    // dark halo track, draining green core, and the on-beat flash ring
    expect(ring?.querySelectorAll("circle")).toHaveLength(3);
  });

  it("marks a target as primary when it is inside the active shape region", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target", isInRegion: true }),
    );
    const ring = container.querySelector("[data-guide-ring]");
    expect(ring?.getAttribute("data-guide-primary")).toBe("true");
  });

  it("marks a target as non-primary (quiet static marker) when outside the region", () => {
    const { container } = renderNote(
      makeNote({ transitionRole: "guide-target", isInRegion: false }),
    );
    const ring = container.querySelector("[data-guide-ring]");
    expect(ring?.getAttribute("data-guide-primary")).toBe("false");
  });

  it("renders the incoming-hue backing disc tagged with the phase for a target note", () => {
    const { container } = renderNote(makeNote({ transitionRole: "guide-target" }));
    const backing = container.querySelector("[data-guide-phase]:not([data-guide-ring])");
    expect(backing).not.toBeNull();
    expect(backing?.tagName.toLowerCase()).toBe("circle");
    expect(backing?.getAttribute("data-guide-phase")).toBe("landing");
  });

  it("renders no backing disc when there is no transition role", () => {
    const { container } = renderNote(makeNote({ transitionRole: undefined }));
    expect(container.querySelector("[data-guide-phase]")).toBeNull();
  });

  it("paints the ring AFTER the marker shape so a filled note can't occlude it", () => {
    const { container } = renderNote(makeNote({ transitionRole: "guide-target" }));
    const noteG = container.querySelector("g[data-note-shape]");
    const kids = [...noteG!.children];
    const ringIdx = kids.findIndex((k) => k.getAttribute("data-guide-ring"));
    // The marker is the shape element (circle/polygon) that is neither the
    // backing disc (data-guide-phase) nor the ring group (data-guide-ring).
    const markerIdx = kids.findIndex(
      (k) =>
        (k.tagName === "circle" || k.tagName === "polygon") &&
        !k.getAttribute("data-guide-phase") &&
        !k.getAttribute("data-guide-ring"),
    );
    expect(markerIdx).toBeGreaterThanOrEqual(0);
    expect(ringIdx).toBeGreaterThan(markerIdx);
  });
});

function renderNoteWithTicks(note: RenderedFretboardNote, countdownTicks: number[]) {
  return render(
    <svg>
      <FretboardNote
        note={note}
        noteBubblePx={40}
        displayFormat="notes"
        countdownTicks={countdownTicks}
      />
    </svg>,
  );
}

describe("FretboardNote — common-hold ring", () => {
  it("maps transitionRole 'hold-common' to data-guide-phase='hold' on the ring", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "hold-common",
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
    );
    const ring = container.querySelector('g[data-guide-ring="true"]');
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("data-guide-phase")).toBe("hold");
  });

  it("renders no interval label for a common-hold note (no guideTargetLabel)", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "hold-common",
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
    );
    expect(container.querySelector('[data-guide-label="true"]')).toBeNull();
  });

  it("renders NO beat-tick notches on a hold ring (ticks belong to the guide countdown)", () => {
    const { container } = renderNoteWithTicks(
      makeNote({
        transitionRole: "hold-common",
        isInRegion: true,
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
      [0.25, 0.5, 0.75],
    );
    expect(container.querySelector('[data-guide-tick="true"]')).toBeNull();
  });

  it("still renders beat-tick notches on a guide-target (landing) ring", () => {
    const { container } = renderNoteWithTicks(
      makeNote({
        transitionRole: "guide-target",
        isInRegion: true,
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, guideTargetLabel: "3" },
      }),
      [0.25, 0.5, 0.75],
    );
    expect(container.querySelector('[data-guide-tick="true"]')).not.toBeNull();
  });

  it("applies the size hold via --emph-scale", () => {
    const { container } = renderNote(
      makeNote({
        transitionRole: "hold-common",
        applyLensEmphasis: { radiusBoost: 1.15, opacityBoost: 1 },
      }),
    );
    const g = container.querySelector("g[data-note-shape]") as SVGGElement;
    expect(g.style.getPropertyValue("--emph-scale")).toBe("1.15");
  });
});

