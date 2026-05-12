// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import type { NoteData } from "./hooks/useNoteData";
import {
  CHORD_ROOT_HALO_RADIUS_PX,
  CIRCLE_RADIUS_REDUCTION_PX,
  SQUIRCLE_RADIUS_REDUCTION_PX,
  squirclePath,
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
  it("renders squircle as a superellipse path, not a rounded rect", () => {
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

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);

    const haloPath = paths[0]!;
    const mainPath = paths[1]!;

    expect(mainPath.getAttribute("d")).toBe(squirclePath(100, 50, visualRadius));
    expect(haloPath.getAttribute("d")).toBe(
      squirclePath(100, 50, visualRadius + CHORD_ROOT_HALO_RADIUS_PX),
    );

    expect(container.querySelectorAll("rect").length).toBe(0);

    const label = container.querySelector("text")!;
    expect(label.textContent).toBe("C");
    expect(label.getAttribute("x")).toBe("100");
    expect(label.getAttribute("y")).toBe("50");
  });

  it("reduces circular note geometry by CIRCLE_RADIUS_REDUCTION_PX", () => {
    const noteBubblePx = 40;
    const rawCircleRadius = (noteBubblePx / 2) * 0.82;
    const expectedCircleRadius = rawCircleRadius - CIRCLE_RADIUS_REDUCTION_PX;

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
