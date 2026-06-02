// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RADIUS_SCALE_CHORD_TONE, RADIUS_SCALE_NOTE_ACTIVE } from "@fretflow/core";
import { FretboardNote } from "./FretboardNote";
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
  it("renders data-transition-role='incoming' on <g> when transitionRole is 'incoming'", () => {
    const glowColor = "var(--note-incoming)" as `var(--${string})`;
    const { container } = renderNote(
      makeNote({
        transitionRole: "incoming",
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor },
      }),
    );
    const g = container.querySelector("g[data-note-shape]");
    expect(g).not.toBeNull();
    expect(g?.getAttribute("data-transition-role")).toBe("incoming");
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

describe("FretboardNote — glow underlay sizing", () => {
  // noteBubblePx is 40 in renderNote → baseRadius (noteBubblePx/2) = 20.
  const BASE_RADIUS = 20;

  it("enlarges the underlay for squircle notes so the halo clears the filled shape", () => {
    const { container } = renderNote(makeNote({ noteClass: "chord-tone-in-scale" }));
    const underlayR = parseFloat(container.querySelector("[data-glow]")!.getAttribute("r")!);
    const shapeR = reduceSquircleRadius(BASE_RADIUS * RADIUS_SCALE_CHORD_TONE);
    expect(underlayR).toBeGreaterThan(shapeR);
    expect(underlayR).toBeCloseTo(shapeR * GLOW_RADIUS_SCALE_SQUIRCLE, 5);
  });

  it("keeps the underlay at the shape radius for circle notes", () => {
    const { container } = renderNote(makeNote({ noteClass: "note-active" }));
    const underlayR = parseFloat(container.querySelector("[data-glow]")!.getAttribute("r")!);
    const shapeR = reduceCircleRadius(BASE_RADIUS * RADIUS_SCALE_NOTE_ACTIVE);
    expect(underlayR).toBeCloseTo(shapeR, 5);
  });
});
