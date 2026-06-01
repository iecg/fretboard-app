// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import { __getFretboardNoteRenderCount, __resetFretboardNoteRenderCount } from "./fretboardNoteRenderCounter";
import { axe } from "../../test-utils/a11y";
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";
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

function makeNote(noteClass: NoteClass, overrides: Partial<RenderedFretboardNote> = {}): RenderedFretboardNote {
  return {
    stringIndex: 0,
    fretIndex: 5,
    cx: 100,
    cy: 50,
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

function renderLayer(
  notes: RenderedFretboardNote[],
  opts: {
    bubblePx?: number;
    displayFormat?: "notes" | "none";
  } = {},
) {
  const {
    bubblePx = 40,
    displayFormat = "notes",
  } = opts;
  return render(
    <svg>
      <FretboardNoteLayer
        notes={notes}
        noteBubblePx={bubblePx}
        displayFormat={displayFormat}
      />
    </svg>,
  );
}

describe("FretboardNoteLayer per-note memoization", () => {
  beforeEach(() => {
    __resetFretboardNoteRenderCount();
  });

  it("re-renders only the note whose object reference changed", () => {
    // Stable references for all notes.
    const notes: RenderedFretboardNote[] = [
      makeNote("note-active", { stringIndex: 0, fretIndex: 0, cx: 10 }),
      makeNote("note-active", { stringIndex: 1, fretIndex: 1, cx: 20 }),
      makeNote("note-active", { stringIndex: 2, fretIndex: 2, cx: 30 }),
      makeNote("note-active", { stringIndex: 3, fretIndex: 3, cx: 40 }),
    ];

    const { rerender } = render(
      <svg>
        <FretboardNoteLayer notes={notes} noteBubblePx={40} displayFormat="notes" />
      </svg>,
    );

    // Initial render: every note rendered once.
    expect(__getFretboardNoteRenderCount()).toBe(notes.length);
    __resetFretboardNoteRenderCount();

    // Swap exactly ONE note's object reference; all others keep identity.
    const nextNotes = notes.slice();
    nextNotes[2] = makeNote("note-active", { stringIndex: 2, fretIndex: 2, cx: 99 });

    rerender(
      <svg>
        <FretboardNoteLayer notes={nextNotes} noteBubblePx={40} displayFormat="notes" />
      </svg>,
    );

    // Only the single changed note should re-render — memo skips the other 3.
    expect(__getFretboardNoteRenderCount()).toBe(1);
  });
});

describe("FretboardNoteLayer", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderLayer([makeNote("note-active")]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders squircle as a superellipse path with halo for chord-root", () => {
    const noteBubblePx = 40;
    const visualRadius = (noteBubblePx / 2) * 0.86 - SQUIRCLE_RADIUS_REDUCTION_PX;
    const { container } = renderLayer([makeNote("chord-root")], { bubblePx: noteBubblePx });

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
    expect(paths[1]!.getAttribute("d")).toBe(squirclePath(100, 50, visualRadius));
    expect(paths[0]!.getAttribute("d")).toBe(
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
    const expectedCircleRadius = (noteBubblePx / 2) * 0.82 - CIRCLE_RADIUS_REDUCTION_PX;
    const { container } = renderLayer([makeNote("note-active")], { bubblePx: noteBubblePx });
    expect(Number(container.querySelector("circle")!.getAttribute("r"))).toBeCloseTo(expectedCircleRadius);
  });

  it("renders text label at note center coordinates", () => {
    const cx = 120, cy = 60;
    const { container } = renderLayer([makeNote("note-active", { cx, cy })]);
    const label = container.querySelector("text")!;
    expect(label.textContent).toBe("C");
    expect(label.getAttribute("x")).toBe(String(cx));
    expect(label.getAttribute("y")).toBe(String(cy));
  });

  it("omits text label when displayFormat is none", () => {
    const { container } = renderLayer([makeNote("note-active")], { displayFormat: "none" });
    expect(container.querySelectorAll("text").length).toBe(0);
  });

  it("renders chord-root with squircle+halo and chord-tone with squircle but no halo", () => {
    const { container } = renderLayer(
      [
        makeNote("chord-root", { stringIndex: 0, fretIndex: 1 }),
        makeNote("chord-tone-in-scale", { stringIndex: 1, fretIndex: 2, cx: 200, cy: 30 }),
      ],
    );
    expect(container.querySelectorAll("path").length).toBe(3); // chord-root halo+main, chord-tone main
    expect(container.querySelectorAll("rect").length).toBe(0);
    expect(container.querySelectorAll("text").length).toBe(2);
  });

  // Each role maps to a single SVG primitive — verify the others stay absent.
  it.each<{ role: NoteClass; primitive: "circle" | "polygon" | "path"; count: number }>([
    { role: "note-active", primitive: "circle", count: 1 },
    { role: "chord-tone-outside-scale", primitive: "polygon", count: 1 },
    { role: "note-blue", primitive: "polygon", count: 1 },
  ])("$role renders exactly $count <$primitive> element with no other shape primitive", ({ role, primitive, count }) => {
    const { container } = renderLayer([makeNote(role)]);
    const other = (["circle", "polygon", "path"] as const).filter((p) => p !== primitive);
    expect(container.querySelectorAll(primitive).length).toBe(count);
    other.forEach((p) => expect(container.querySelectorAll(p).length).toBe(0));
  });

  it("applies correct data-note-role attribute for non-inactive notes", () => {
    const { container } = renderLayer(
      [
        makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
        makeNote("note-active", { stringIndex: 1, fretIndex: 1, cx: 150, cy: 30 }),
        makeNote("note-inactive", { stringIndex: 2, fretIndex: 2, cx: 200, cy: 60 }),
      ],
    );
    // note-inactive should NOT have data-note-role; chord-root and note-active should
    const groups = container.querySelectorAll("g[data-note-role]");
    expect(groups.length).toBe(2);
    const roles = Array.from(groups).map((g) => g.getAttribute("data-note-role"));
    expect(roles).toContain("chord-root");
    expect(roles).toContain("note-active");
  });

  it("applies correct data-note-shape attribute for each shape type", () => {
    const { container } = renderLayer(
      [
        makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
        makeNote("note-active", { stringIndex: 1, fretIndex: 1, cx: 150, cy: 30 }),
        makeNote("chord-tone-outside-scale", { stringIndex: 2, fretIndex: 2, cx: 200, cy: 60 }),
        makeNote("note-blue", { stringIndex: 3, fretIndex: 3, cx: 250, cy: 90 }),
      ],
    );
    const shapeFor = (role: string) =>
      container.querySelector(`g[data-note-role="${role}"]`)?.getAttribute("data-note-shape");
    expect(shapeFor("chord-root")).toBe("squircle");
    expect(shapeFor("note-active")).toBe("circle");
    expect(shapeFor("chord-tone-outside-scale")).toBe("diamond");
    expect(shapeFor("note-blue")).toBe("hexagon");
  });

  it.each<{ role: NoteClass; scale: number; pathIndex: number; totalPaths: number }>([
    { role: "chord-root", scale: RADIUS_SCALE_CHORD_ROOT, pathIndex: 1, totalPaths: 2 },
    { role: "chord-tone-in-scale", scale: RADIUS_SCALE_CHORD_TONE, pathIndex: 0, totalPaths: 1 },
  ])("$role squircle radius reduced by SQUIRCLE_RADIUS_REDUCTION_PX", ({ role, scale, pathIndex, totalPaths }) => {
    const noteBubblePx = 40;
    const expectedRadius = (noteBubblePx / 2) * scale - SQUIRCLE_RADIUS_REDUCTION_PX;
    const { container } = renderLayer([makeNote(role)], { bubblePx: noteBubblePx });
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(totalPaths);
    expect(paths[pathIndex]!.getAttribute("d")).toBe(squirclePath(100, 50, expectedRadius));
  });

  it("hidden notes do not render with data-note-role and are aria-hidden", () => {
    const { container } = renderLayer([makeNote("note-active", { isHidden: true })]);
    expect(container.querySelector("g[aria-hidden='true']")).toBeTruthy();
  });

  it("lens emphasis radiusBoost is applied as CSS transform scale, not baked into SVG geometry", () => {
    const noteBubblePx = 40, radiusBoost = 1.15;
    // Radius is computed WITHOUT radiusBoost — boost goes to --emph-scale CSS var instead
    const expectedBaseRadius = (noteBubblePx / 2) * RADIUS_SCALE_NOTE_ACTIVE - CIRCLE_RADIUS_REDUCTION_PX;
    const { container } = renderLayer(
      [makeNote("note-active", { applyLensEmphasis: { radiusBoost, opacityBoost: 1 } })],
      { bubblePx: noteBubblePx },
    );
    // Circle r should be the base radius (no boost baked in)
    expect(Number(container.querySelector("circle")!.getAttribute("r"))).toBeCloseTo(expectedBaseRadius);
    // The note <g> should carry --emph-scale set to the boost value
    const noteG = container.querySelector("g[data-note-shape]") as HTMLElement;
    expect(noteG.style.getPropertyValue("--emph-scale")).toBe(String(radiusBoost));
  });

  it("renders all notes (no filter) — all notes are in a single layer", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          notes={[
            makeNote("chord-root", { stringIndex: 0, fretIndex: 0 }),
            makeNote("note-active", { stringIndex: 1, fretIndex: 1, cx: 150, cy: 30 }),
            makeNote("chord-tone-in-scale", { stringIndex: 2, fretIndex: 2, cx: 200, cy: 60 }),
          ]}
          noteBubblePx={40}
          displayFormat="notes"
        />
      </svg>,
    );
    expect(container.querySelectorAll("text").length).toBe(3);
  });

  it("renders glow underlay circle when glowColor is set", () => {
    const glowColor = "var(--note-glow-hold)" as `var(--${string})`;
    const { container } = renderLayer(
      [makeNote("note-active", { applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor } })],
    );
    const underlay = container.querySelector(".note-glow-underlay");
    expect(underlay).not.toBeNull();
    expect(underlay?.getAttribute("aria-hidden")).toBe("true");
    // Inline style fill is set to the glowColor token
    expect(underlay?.getAttribute("style")).toContain("fill");
  });

  it("does not render glow underlay when glowColor is absent", () => {
    const { container } = renderLayer([makeNote("note-active")]);
    expect(container.querySelector(".note-glow-underlay")).toBeNull();
  });

  it("marks note groups with CSS animation mode", () => {
    const { container } = render(
      <svg>
        <FretboardNoteLayer
          notes={[makeNote("note-active")]}
          noteBubblePx={40}
          displayFormat="notes"
          animationMode="css"
        />
      </svg>,
    );
    expect(container.querySelector('[data-motion="css"]')).toBeTruthy();
  });
});
