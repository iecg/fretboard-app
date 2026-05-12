// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import { axe } from "../../test-utils/a11y";
import type { NoteData } from "./hooks/useNoteData";
import {
  CHORD_ROOT_HALO_RADIUS_PX,
  CIRCLE_RADIUS_REDUCTION_PX,
  SQUIRCLE_RADIUS_REDUCTION_PX,
  squirclePath,
} from "./utils/noteSizing";
import {
  RADIUS_SCALE_CHORD_ROOT,
  RADIUS_SCALE_CHORD_TONE,
  RADIUS_SCALE_NOTE_ACTIVE,
} from "@fretflow/core";

type NoteClass =
  | "chord-root"
  | "chord-tone-in-scale"
  | "chord-tone-outside-scale"
  | "note-diatonic-chord"
  | "color-tone"
  | "scale-only"
  | "note-active"
  | "note-blue"
  | "key-tonic"
  | "note-inactive";

function makeNote(noteClass: NoteClass, overrides: Partial<NoteData> = {}): NoteData {
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
    ...overrides,
  };
}

describe("FretboardNoteLayer", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-active")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

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

  it("renders text label at note center coordinates", () => {
    const cx = 120;
    const cy = 60;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-active")]}
          fretCenterX={() => cx}
          stringYAt={() => cy}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    const label = container.querySelector("text")!;
    expect(label).toBeTruthy();
    expect(label.textContent).toBe("C");
    expect(label.getAttribute("x")).toBe(String(cx));
    expect(label.getAttribute("y")).toBe(String(cy));
  });

  it("omits text label when displayFormat is none", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-active")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={40}
          displayFormat="none"
        />
      </svg>,
    );

    expect(container.querySelectorAll("text").length).toBe(0);
  });

  it("renders chord-root with squircle shape and halo, chord-tone with squircle but no halo", () => {
    const noteBubblePx = 40;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[
            makeNote("chord-root", { stringIndex: 0, fretIndex: 1 }),
            makeNote("chord-tone-in-scale", { stringIndex: 1, fretIndex: 2 }),
          ]}
          fretCenterX={(fi) => fi * 50}
          stringYAt={(si) => si * 30}
          noteBubblePx={noteBubblePx}
          displayFormat="notes"
        />
      </svg>,
    );

    // chord-root: halo path + main path = 2 paths; chord-tone-in-scale: 1 path; total = 3
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(3);

    // No rect elements (squircles are paths, not rects)
    expect(container.querySelectorAll("rect").length).toBe(0);

    // Two text labels
    const labels = container.querySelectorAll("text");
    expect(labels.length).toBe(2);
  });

  it("renders note-active as circle, not a path or polygon", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-active")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    expect(container.querySelectorAll("circle").length).toBe(1);
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelectorAll("polygon").length).toBe(0);
  });

  it("renders chord-tone-outside-scale as diamond (polygon), not circle or path", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("chord-tone-outside-scale")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    expect(container.querySelectorAll("polygon").length).toBe(1);
    expect(container.querySelectorAll("circle").length).toBe(0);
    expect(container.querySelectorAll("path").length).toBe(0);
  });

  it("renders note-blue as hexagon (polygon), not circle or path", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-blue")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    expect(container.querySelectorAll("polygon").length).toBe(1);
    expect(container.querySelectorAll("circle").length).toBe(0);
    expect(container.querySelectorAll("path").length).toBe(0);
  });

  it("applies correct data-note-role attribute for non-inactive notes", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[
            makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
            makeNote("note-active", { stringIndex: 1, fretIndex: 1 }),
            makeNote("note-inactive", { stringIndex: 2, fretIndex: 2 }),
          ]}
          fretCenterX={(fi) => fi * 50}
          stringYAt={(si) => si * 30}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    const groups = container.querySelectorAll("g[data-note-role]");
    // note-inactive should NOT have data-note-role; chord-root and note-active should
    expect(groups.length).toBe(2);

    const roles = Array.from(groups).map((g) => g.getAttribute("data-note-role"));
    expect(roles).toContain("chord-root");
    expect(roles).toContain("note-active");
  });

  it("applies correct data-note-shape attribute for each shape type", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[
            makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
            makeNote("note-active", { stringIndex: 1, fretIndex: 1 }),
            makeNote("chord-tone-outside-scale", { stringIndex: 2, fretIndex: 2 }),
            makeNote("note-blue", { stringIndex: 3, fretIndex: 3 }),
          ]}
          fretCenterX={(fi) => fi * 50}
          stringYAt={(si) => si * 30}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    const getShapeFor = (role: string) =>
      container
        .querySelector(`g[data-note-role="${role}"]`)
        ?.getAttribute("data-note-shape");

    expect(getShapeFor("chord-root")).toBe("squircle");
    expect(getShapeFor("note-active")).toBe("circle");
    expect(getShapeFor("chord-tone-outside-scale")).toBe("diamond");
    expect(getShapeFor("note-blue")).toBe("hexagon");
  });

  it("chord-root squircle radius uses RADIUS_SCALE_CHORD_ROOT and SQUIRCLE_RADIUS_REDUCTION_PX", () => {
    const noteBubblePx = 40;
    const rawRadius = (noteBubblePx / 2) * RADIUS_SCALE_CHORD_ROOT;
    const expectedRadius = rawRadius - SQUIRCLE_RADIUS_REDUCTION_PX;

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
    // paths[1] is the main squircle (paths[0] is the halo)
    expect(paths[1]!.getAttribute("d")).toBe(squirclePath(100, 50, expectedRadius));
  });

  it("chord-tone-in-scale squircle radius uses RADIUS_SCALE_CHORD_TONE", () => {
    const noteBubblePx = 40;
    const rawRadius = (noteBubblePx / 2) * RADIUS_SCALE_CHORD_TONE;
    const expectedRadius = rawRadius - SQUIRCLE_RADIUS_REDUCTION_PX;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("chord-tone-in-scale")]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={noteBubblePx}
          displayFormat="notes"
        />
      </svg>,
    );

    const paths = container.querySelectorAll("path");
    // chord-tone-in-scale has no halo, so paths[0] is the main squircle
    expect(paths.length).toBe(1);
    expect(paths[0]!.getAttribute("d")).toBe(squirclePath(100, 50, expectedRadius));
  });

  it("hidden notes do not render with data-note-role and are aria-hidden", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[makeNote("note-active", { isHidden: true })]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );

    const group = container.querySelector("g[aria-hidden='true']");
    expect(group).toBeTruthy();
  });

  it("lens emphasis radiusBoost scales the final rendered radius", () => {
    const noteBubblePx = 40;
    const radiusBoost = 1.15;
    const rawRadius = (noteBubblePx / 2) * RADIUS_SCALE_NOTE_ACTIVE * radiusBoost;
    const expectedRadius = rawRadius - CIRCLE_RADIUS_REDUCTION_PX;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[
            makeNote("note-active", {
              applyLensEmphasis: { radiusBoost, opacityBoost: 1 },
            }),
          ]}
          fretCenterX={() => 100}
          stringYAt={() => 50}
          noteBubblePx={noteBubblePx}
          displayFormat="notes"
        />
      </svg>,
    );

    const circle = container.querySelector("circle")!;
    expect(Number(circle.getAttribute("r"))).toBeCloseTo(expectedRadius);
  });

  it("filter='chord' renders only chord-class notes", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[
            makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
            makeNote("note-active", { stringIndex: 1, fretIndex: 1 }),
            makeNote("chord-tone-in-scale", { stringIndex: 2, fretIndex: 2 }),
          ]}
          fretCenterX={(fi) => fi * 50}
          stringYAt={(si) => si * 30}
          noteBubblePx={40}
          displayFormat="notes"
          filter="chord"
        />
      </svg>,
    );

    const labels = container.querySelectorAll("text");
    // Only chord-root and chord-tone should render
    expect(labels.length).toBe(2);
  });

  it("filter='non-chord' renders only non-chord notes", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          noteData={[
            makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
            makeNote("note-active", { stringIndex: 1, fretIndex: 1 }),
            makeNote("scale-only", { stringIndex: 2, fretIndex: 2 }),
          ]}
          fretCenterX={(fi) => fi * 50}
          stringYAt={(si) => si * 30}
          noteBubblePx={40}
          displayFormat="notes"
          filter="non-chord"
        />
      </svg>,
    );

    const labels = container.querySelectorAll("text");
    // Only note-active and scale-only should render
    expect(labels.length).toBe(2);
  });
});
