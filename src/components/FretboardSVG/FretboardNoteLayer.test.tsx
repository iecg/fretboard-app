// @vitest-environment jsdom
import { memo, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { FretboardNoteLayer } from "./FretboardNoteLayer";
import { axe } from "../../test-utils/a11y";

// Per-note render attribution: spy on FretboardNote, recording the note key each
// time it actually renders. The spy is wrapped in `memo` so it bails on
// unchanged props exactly like the real component — without that, it would
// record every note on every layer render and defeat the assertion.
const noteRenders = vi.hoisted(() => [] as string[]);
vi.mock("./FretboardNote", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./FretboardNote")>();
  return {
    FretboardNote: memo((props: ComponentProps<typeof actual.FretboardNote>) => {
      noteRenders.push(`${props.note.stringIndex}-${props.note.fretIndex}`);
      return <actual.FretboardNote {...props} />;
    }),
  };
});
import type { RenderedFretboardNote } from "./hooks/useAnimatedFretboardView";
import {
  CIRCLE_RADIUS_REDUCTION_PX,
  taperAwareRadiusScale,
} from "./utils/noteSizing";
import { getNoteVisuals } from "./utils/semantics";
import { formatAccidental } from "@fretflow/core";

type NoteClass =
  | "chord-root"
  | "chord-root-outside"
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
    noteRenders.length = 0;
  });

  const fourStableNotes = (): RenderedFretboardNote[] => [
    makeNote("note-active", { stringIndex: 0, fretIndex: 0, cx: 10 }),
    makeNote("note-active", { stringIndex: 1, fretIndex: 1, cx: 20 }),
    makeNote("note-active", { stringIndex: 2, fretIndex: 2, cx: 30 }),
    makeNote("note-active", { stringIndex: 3, fretIndex: 3, cx: 40 }),
  ];

  it("re-renders only the note whose object reference changed", () => {
    const notes = fourStableNotes();

    const { rerender } = render(
      <svg>
        <FretboardNoteLayer notes={notes} noteBubblePx={40} displayFormat="notes" />
      </svg>,
    );

    // Initial render: every note rendered once.
    expect(noteRenders).toHaveLength(notes.length);
    noteRenders.length = 0;

    // Swap exactly ONE note's object reference; all others keep identity.
    const nextNotes = notes.slice();
    nextNotes[2] = makeNote("note-active", { stringIndex: 2, fretIndex: 2, cx: 99 });

    rerender(
      <svg>
        <FretboardNoteLayer notes={nextNotes} noteBubblePx={40} displayFormat="notes" />
      </svg>,
    );

    // Only the single changed note should re-render — memo skips the other 3.
    expect(noteRenders).toEqual(["2-2"]);
  });

});

describe("FretboardNoteLayer", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderLayer([makeNote("note-active")]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders chord-root as a single circle marker with no concentric halo ring", () => {
    const noteBubblePx = 40;
    const visualRadius = (noteBubblePx / 2) * getNoteVisuals("chord-root").radiusScale - CIRCLE_RADIUS_REDUCTION_PX;
    const { container } = renderLayer([makeNote("chord-root")], { bubblePx: noteBubblePx });

    const g = container.querySelector('g[data-note-role="chord-root"]')!;
    expect(g.getAttribute("data-note-shape")).toBe("circle");

    // Exactly one marker circle — no second halo-ring circle.
    // The marker carries the reduced visual radius.
    const markerCircle = g.querySelector("circle")!;
    expect(Number(markerCircle.getAttribute("r"))).toBeCloseTo(visualRadius);
    expect(g.querySelectorAll("circle").length).toBe(1);
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelectorAll("rect").length).toBe(0);

    const label = container.querySelector("text")!;
    expect(label.textContent).toBe("C");
    expect(label.getAttribute("x")).toBe("100");
    expect(label.getAttribute("y")).toBe("50");
  });

  it("reduces circular note geometry by CIRCLE_RADIUS_REDUCTION_PX", () => {
    const noteBubblePx = 40;
    const expectedCircleRadius = (noteBubblePx / 2) * getNoteVisuals("note-active").radiusScale - CIRCLE_RADIUS_REDUCTION_PX;
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

  it("renders chord-root and chord-tone-in-scale each as a single circle marker, no halo paths", () => {
    const { container } = renderLayer(
      [
        makeNote("chord-root", { stringIndex: 0, fretIndex: 1 }),
        makeNote("chord-tone-in-scale", { stringIndex: 1, fretIndex: 2, cx: 200, cy: 30 }),
      ],
    );
    // Both are circle-shape markers now — no superellipse paths, no halo rings.
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelectorAll("circle").length).toBe(2);
    expect(container.querySelectorAll("rect").length).toBe(0);
    expect(container.querySelectorAll("text").length).toBe(2);
  });

  // Each role maps to a single SVG primitive — verify the others stay absent.
  it.each<{ role: NoteClass; primitive: "circle" | "polygon" | "path"; shapeCount: number }>([
    { role: "note-active", primitive: "circle", shapeCount: 1 },
    { role: "chord-tone-outside-scale", primitive: "polygon", shapeCount: 1 },
    { role: "note-blue", primitive: "polygon", shapeCount: 1 },
  ])("$role renders exactly $shapeCount <$primitive> shape element", ({ role, primitive, shapeCount }) => {
    const { container } = renderLayer([makeNote(role)]);
    // No path or polygon where not expected
    const otherShapes = (["polygon", "path"] as const).filter((p) => p !== primitive);
    expect(container.querySelectorAll(primitive).length).toBe(shapeCount);
    otherShapes.forEach((p) => expect(container.querySelectorAll(p).length).toBe(0));
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
    expect(shapeFor("chord-root")).toBe("circle");
    expect(shapeFor("note-active")).toBe("circle");
    expect(shapeFor("chord-tone-outside-scale")).toBe("diamond");
    expect(shapeFor("note-blue")).toBe("diamond");
  });

  it.each<{ role: NoteClass }>([
    { role: "chord-root" },
    { role: "chord-tone-in-scale" },
  ])("$role renders a circle marker reduced by CIRCLE_RADIUS_REDUCTION_PX", ({ role }) => {
    const noteBubblePx = 40;
    const expectedRadius = (noteBubblePx / 2) * getNoteVisuals(role).radiusScale - CIRCLE_RADIUS_REDUCTION_PX;
    const { container } = renderLayer([makeNote(role)], { bubblePx: noteBubblePx });
    expect(container.querySelectorAll("path").length).toBe(0);
    const markerCircle = container.querySelector("circle")!;
    expect(Number(markerCircle.getAttribute("r"))).toBeCloseTo(expectedRadius);
  });

  it("hidden notes do not render with data-note-role and are aria-hidden", () => {
    const { container } = renderLayer([makeNote("note-active", { isHidden: true })]);
    expect(container.querySelector("g[aria-hidden='true']")).toBeTruthy();
  });

  it("lens emphasis radiusBoost is applied as CSS transform scale, not baked into SVG geometry", () => {
    const noteBubblePx = 40, radiusBoost = 1.15;
    // Radius is computed WITHOUT radiusBoost — boost goes to --emph-scale CSS var instead
    const expectedBaseRadius = (noteBubblePx / 2) * getNoteVisuals("note-active").radiusScale - CIRCLE_RADIUS_REDUCTION_PX;
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

  // Regression: marker jitter on chord transition (Task 10).
  // The note F is `chord-root-outside` (diamond, radius-tier 0.95) under an F
  // chord and `chord-tone-outside-scale` (diamond, radius-tier 0.80) under Dm.
  // Its fret is fixed, so its CENTER must not translate across the change — only
  // its size/shape/color may. The animated `<g>` carries
  // `transform: scale(var(--emph-scale))`; that scale must pivot about the note's
  // FIXED geometric center (cx,cy). With `transform-box: fill-box` the pivot is
  // the element's bounding-box center, which moves when r shrinks (the bbox is
  // asymmetric: guide label/ring/text extend it past (cx,cy)). The fix pins the
  // origin to the note center in user space, so the pivot is identical in both
  // states and the size change animates with zero positional drift.
  describe("marker stays centered across a chord transition (no jitter)", () => {
    const diamondCentroid = (container: HTMLElement) => {
      const pts = container
        .querySelector("polygon")!
        .getAttribute("points")!
        .trim()
        .split(/\s+/)
        .map((p) => p.split(",").map(Number));
      const cx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
      const cy = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
      return { cx, cy };
    };

    const noteG = (container: HTMLElement) =>
      container.querySelector("g[data-note-shape='diamond']") as HTMLElement;

    it("F diamond centroid is the fixed (cx,cy) in BOTH chord states even as radius changes", () => {
      const cx = 120, cy = 70, bubblePx = 40;
      const fChord = renderLayer([makeNote("chord-root-outside", { cx, cy })], { bubblePx });
      const dmChord = renderLayer([makeNote("chord-tone-outside-scale", { cx, cy })], { bubblePx });

      const a = diamondCentroid(fChord.container);
      const b = diamondCentroid(dmChord.container);

      // Radius tiers differ (0.95 vs 0.80) — the markers are NOT the same size.
      expect(getNoteVisuals("chord-root-outside").radiusScale).not.toBe(
        getNoteVisuals("chord-tone-outside-scale").radiusScale,
      );
      // ...but the geometric center is identical and equals the note's fixed center.
      expect(a).toEqual(b);
      expect(a).toEqual({ cx, cy });
    });

    it("the scale transform pivots about the note center, not the asymmetric bounding box", () => {
      const cx = 120, cy = 70;
      const { container } = renderLayer([makeNote("chord-root-outside", { cx, cy })]);
      const g = noteG(container);

      // The scale() origin must be pinned to the note's fixed center in user
      // space. `transform-box: fill-box` would pivot about the (asymmetric,
      // size-dependent) bounding-box center and drift the marker on resize, so
      // it must NOT be used for the scale layer.
      expect(g.style.transformBox).not.toBe("fill-box");
      expect(g.style.transformOrigin).toBe(`${cx}px ${cy}px`);
    });
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

  it("shrinks near-nut bubbles but leaves the far neck pixel-identical", () => {
    const noteBubblePx = 40;
    const layout = { neckWidthPx: 1000, neckHeight: 300, numStrings: 6 };
    const fullRadius =
      (noteBubblePx / 2) * getNoteVisuals("note-active").radiusScale -
      CIRCLE_RADIUS_REDUCTION_PX;

    const { container } = render(
      <svg>
        <FretboardNoteLayer
          notes={[
            makeNote("note-active", { stringIndex: 0, fretIndex: 0, cx: 0, cy: 30 }),
            makeNote("note-active", { stringIndex: 1, fretIndex: 12, cx: 1000, cy: 60 }),
          ]}
          noteBubblePx={noteBubblePx}
          displayFormat="notes"
          {...layout}
        />
      </svg>,
    );

    const markers = [...container.querySelectorAll('circle:not([data-glow])')];
    expect(markers).toHaveLength(2);
    const [nutR, bridgeR] = markers.map((c) => Number(c.getAttribute("r")));

    // Far end: unchanged (scale === 1).
    expect(bridgeR).toBeCloseTo(fullRadius);
    // Nut end: strictly smaller.
    expect(nutR).toBeLessThan(bridgeR);
    // Nut end: the helper's scale applied to rawRadius BEFORE the px reduction.
    // Deriving the scale from the helper (rather than a hardcoded constant) keeps
    // this test stable if the taper tuning constants change.
    const nutScale = taperAwareRadiusScale({ x: 0, ...layout, noteBubblePx });
    const expectedNut =
      (noteBubblePx / 2) * getNoteVisuals("note-active").radiusScale * nutScale -
      CIRCLE_RADIUS_REDUCTION_PX;
    expect(nutR).toBeCloseTo(expectedNut, 2);
  });
});

describe("FretboardNote a11y contract (issue #493)", () => {
  const renderNote = (
    note: RenderedFretboardNote,
    opts: {
      displayFormat?: "notes" | "degrees" | "none";
    } = {},
  ) =>
    render(
      <svg>
        <FretboardNoteLayer
          notes={[note]}
          noteBubblePx={40}
          displayFormat={opts.displayFormat ?? "notes"}
        />
      </svg>,
    );

  const noteGroup = (container: HTMLElement) =>
    container.querySelector<SVGGElement>('g[class*="fretboard-note"]')!;

  describe("aria-label uses the visible display spelling, not internal sharps", () => {
    it("announces the flat spelling when the visible label is a flat", () => {
      // Internal storage is sharps ("A#"); the visible label resolves to the
      // scale-aware flat ("Bb"). The screen-reader label must match what is seen.
      const { container } = renderNote(
        makeNote("note-active", { noteName: "A#", displayName: "Bb", octave: 4 }),
      );
      const label = noteGroup(container).getAttribute("aria-label") ?? "";
      expect(label).toContain(formatAccidental("Bb")); // "B♭"
      expect(label).not.toContain("A#");
      expect(label).not.toContain("A♯");
    });

    it("uses displayName for the pitch even in degrees display mode", () => {
      // displayValue (visible text) is a degree in degrees mode, but the spoken
      // label must still announce the pitch — sourced from displayName.
      const { container } = renderNote(
        makeNote("note-active", {
          noteName: "C#",
          displayName: "Db",
          displayValue: "2",
          octave: 5,
        }),
        { displayFormat: "degrees" },
      );
      const label = noteGroup(container).getAttribute("aria-label") ?? "";
      expect(label).toContain(`${formatAccidental("Db")}5`); // "D♭5"
    });
  });

  describe("the decorative layer is never focusable", () => {
    // FretboardNoteLayer takes no onNoteClick, so FretboardNote's interactive
    // branch is never taken: the visible <g> stays non-focusable (no role /
    // tabIndex). A focusable element inside the aria-hidden SVG would be invalid
    // ARIA and a dead duplicate tab stop next to the real hit-target button.
    it("active notes have no button role and no tabIndex", () => {
      const { container } = renderNote(makeNote("note-active"));
      const g = noteGroup(container);
      expect(g.getAttribute("role")).toBeNull();
      expect(g.getAttribute("tabindex")).toBeNull();
    });

    it("hidden notes are aria-hidden with no button role and no tabIndex", () => {
      const { container } = renderNote(makeNote("note-inactive", { isHidden: true }));
      const g = noteGroup(container);
      expect(g.getAttribute("aria-hidden")).toBe("true");
      expect(g.getAttribute("role")).toBeNull();
      expect(g.getAttribute("tabindex")).toBeNull();
    });
  });
});
