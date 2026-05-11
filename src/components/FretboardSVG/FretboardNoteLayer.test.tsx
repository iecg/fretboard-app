// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import type { NoteData } from "./hooks/useNoteData";
import {
  CHORD_ROOT_HALO_RADIUS_PX,
  SQUIRCLE_RADIUS_REDUCTION_PX,
} from "./utils/noteSizing";

function makeNote(noteClass: string): NoteData {
  return {
    stringIndex: 0,
    fretIndex: 5,
    noteName: "C",
    octave: 4,
    noteClass,
    displayValue: "C",
    applyDimOpacity: false,
    applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
    isHidden: false,
    isTension: false,
    isGuideTone: false,
  };
}

describe("FretboardNoteLayer", () => {
  it("reduces squircle geometry without changing the label position or content", () => {
    const noteBubblePx = 40;
    const rawChordRootRadius = (noteBubblePx / 2) * 0.86;
    const visualRadius = rawChordRootRadius - SQUIRCLE_RADIUS_REDUCTION_PX;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("chord-root")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={noteBubblePx}
          displayFormat="notes"
        />
      </svg>,
    );

    const rects = container.querySelectorAll("rect");
    const halo = rects[0]!;
    const squircle = rects[1]!;
    const label = container.querySelector("text")!;

    expect(Number(squircle.getAttribute("x"))).toBeCloseTo(100 - visualRadius);
    expect(Number(squircle.getAttribute("width"))).toBeCloseTo(visualRadius * 2);
    expect(Number(halo.getAttribute("x"))).toBeCloseTo(
      100 - visualRadius - CHORD_ROOT_HALO_RADIUS_PX,
    );
    expect(Number(halo.getAttribute("width"))).toBeCloseTo(
      (visualRadius + CHORD_ROOT_HALO_RADIUS_PX) * 2,
    );
    expect(label.textContent).toBe("C");
    expect(label.getAttribute("x")).toBe("100");
    expect(label.getAttribute("y")).toBe("50");
  });

  it("does not reduce circular note geometry", () => {
    const noteBubblePx = 40;
    const expectedCircleRadius = (noteBubblePx / 2) * 0.82;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-active")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={noteBubblePx}
          displayFormat="notes"
        />
      </svg>,
    );

    const circle = container.querySelector("circle")!;
    expect(Number(circle.getAttribute("r"))).toBeCloseTo(expectedCircleRadius);
  });
});
