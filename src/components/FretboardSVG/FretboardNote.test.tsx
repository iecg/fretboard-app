// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNote } from "./FretboardNote";
import { getNoteVisuals } from "./utils/semantics";
import {
  GLOW_RADIUS_SCALE_SQUIRCLE,
  reduceCircleRadius,
  reduceSquircleRadius,
} from "./utils/noteSizing";
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
    const glowColor = "var(--note-incoming)" as `var(--${string})`;
    const { container } = renderNote(
      makeNote({
        transitionRole: "guide-target",
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor },
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

describe("FretboardNote — always-rendered glow underlay", () => {
  it("renders the underlay circle even when there is no glowColor (data-glow='off')", () => {
    const { container } = renderNote(
      makeNote({ applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 } }),
    );
    // Use attribute selector since CSS-module class names may be hashed
    const underlay = container.querySelector("[data-glow]");
    expect(underlay).not.toBeNull();
    expect(underlay?.getAttribute("data-glow")).toBe("off");
    expect(underlay?.getAttribute("aria-hidden")).toBe("true");
    // No inline fill style when there's no glow color
    const style = underlay?.getAttribute("style");
    expect(style ?? "").not.toContain("fill");
  });

  it("renders the underlay circle with data-glow='on' when glowColor is set", () => {
    const glowColor = "var(--note-glow-hold)" as `var(--${string})`;
    const { container } = renderNote(
      makeNote({
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor },
      }),
    );
    const underlay = container.querySelector("[data-glow]");
    expect(underlay).not.toBeNull();
    expect(underlay?.getAttribute("data-glow")).toBe("on");
    expect(underlay?.getAttribute("aria-hidden")).toBe("true");
    // Inline fill style is set to the glowColor token
    const style = underlay?.getAttribute("style") ?? "";
    expect(style).toContain("fill");
  });
});

describe("FretboardNote — guide-target ring", () => {
  it("renders a guide-target ring when the note's transition role is guide-target", () => {
    const glowColor = "var(--note-incoming)" as `var(--${string})`;
    const note = makeNote({
      transitionRole: "guide-target",
      applyLensEmphasis: { glowColor, radiusBoost: 1.15, opacityBoost: 1, transitionRole: "guide-target" },
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
        glowColor: "var(--note-incoming)" as `var(--${string})`,
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

describe("FretboardNote — glow underlay sizing", () => {
  // noteBubblePx is 40 in renderNote → baseRadius (noteBubblePx/2) = 20.
  const BASE_RADIUS = 20;

  it("enlarges the underlay for squircle notes so the halo clears the filled shape", () => {
    const { container } = renderNote(makeNote({ noteClass: "chord-tone-in-scale" }));
    const underlayR = parseFloat(container.querySelector("[data-glow]")!.getAttribute("r")!);
    const shapeR = reduceSquircleRadius(BASE_RADIUS * getNoteVisuals("chord-tone-in-scale").radiusScale);
    expect(underlayR).toBeGreaterThan(shapeR);
    expect(underlayR).toBeCloseTo(shapeR * GLOW_RADIUS_SCALE_SQUIRCLE, 5);
  });

  it("keeps the underlay at the shape radius for circle notes", () => {
    const { container } = renderNote(makeNote({ noteClass: "note-active" }));
    const underlayR = parseFloat(container.querySelector("[data-glow]")!.getAttribute("r")!);
    const shapeR = reduceCircleRadius(BASE_RADIUS * getNoteVisuals("note-active").radiusScale);
    expect(underlayR).toBeCloseTo(shapeR, 5);
  });
});

