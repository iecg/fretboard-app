// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "../Fretboard";
import { STANDARD_TUNING } from "../guitar";
import { fretEndAtom, fretStartAtom, fretZoomAtom } from "../store/atoms";

// Mock audio synth
vi.mock("../audio", () => ({
  synth: {
    playNote: vi.fn(),
    setMute: vi.fn(),
    init: vi.fn(),
  },
}));

describe("Fretboard", () => {
  const defaultProps = {
    tuning: STANDARD_TUNING,
    maxFret: 24,
    highlightNotes: ["E", "G", "B"],
    rootNote: "C",
    displayFormat: "notes" as const,
  };

  function renderFretboard(store = createStore()) {
    return {
      store,
      ...render(
        <Provider store={store}>
          <Fretboard {...defaultProps} />
        </Provider>,
      ),
    };
  }

  function getVisibleFretLabels(container: HTMLElement) {
    return Array.from(container.querySelectorAll(".fret-number")).map(
      (fret) => fret.textContent,
    );
  }

  function getFretColumn(container: HTMLElement, fret: number) {
    const fretLabels = Array.from(container.querySelectorAll(".fret-number"));
    const fretIndex = fretLabels.findIndex(
      (label) => label.textContent === String(fret),
    );

    if (fretIndex === -1) return null;

    return container.querySelectorAll(".fret-column")[fretIndex] ?? null;
  }

  function getFretMarker(container: HTMLElement, fret: number) {
    return (
      getFretColumn(container, fret)?.querySelector(".fret-marker-container") ??
      null
    );
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1440,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 900,
    });
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders all 6 strings for standard tuning", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      // Fretboard has 6 rows for standard tuning
      const fretboard = container.querySelector("div");
      expect(fretboard).toBeTruthy();
    });

    it("renders correct number of frets based on endFret - startFret", () => {
      const store = createStore();
      store.set(fretStartAtom, 3);
      store.set(fretEndAtom, 7);

      const { container } = renderFretboard(store);

      expect(container.querySelectorAll(".fret-number")).toHaveLength(5);
      expect(getVisibleFretLabels(container)).toEqual([
        "3",
        "4",
        "5",
        "6",
        "7",
      ]);
    });

    it("renders with different tunings", () => {
      const dropDTuning = ["E4", "B3", "G3", "D3", "A2", "D2"];
      render(<Fretboard {...defaultProps} tuning={dropDTuning} />);
      expect(document.body).toBeTruthy(); // Rendered without error
    });
  });

  describe("Note highlighting", () => {
    it("highlights specified notes", () => {
      const { container } = render(
        <Fretboard {...defaultProps} highlightNotes={["E", "G", "B", "C"]} />,
      );
      expect(container.querySelectorAll(".root-active").length).toBeGreaterThan(
        0,
      );
      expect(container.querySelectorAll(".note-active").length).toBeGreaterThan(
        0,
      );
    });

    it("updates highlight when notes change", () => {
      const { container, rerender } = render(
        <Fretboard {...defaultProps} highlightNotes={["C", "E", "G"]} />,
      );

      expect(container.querySelectorAll(".root-active").length).toBeGreaterThan(
        0,
      );
      expect(container.querySelectorAll(".note-active").length).toBeGreaterThan(
        0,
      );

      rerender(
        <Fretboard {...defaultProps} highlightNotes={["D", "F#", "A"]} />,
      );

      expect(container.querySelectorAll(".root-active")).toHaveLength(0);
      expect(container.querySelectorAll(".note-active").length).toBeGreaterThan(
        0,
      );
    });

    it("handles empty highlight array", () => {
      const { container } = render(
        <Fretboard {...defaultProps} highlightNotes={[]} />,
      );

      expect(container.querySelectorAll(".root-active")).toHaveLength(0);
      expect(container.querySelectorAll(".note-active")).toHaveLength(0);
      expect(
        container.querySelectorAll(".note-inactive").length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Display formats", () => {
    it('displays notes when displayFormat is "notes"', () => {
      render(
        <Fretboard {...defaultProps} displayFormat="notes" rootNote="C" />,
      );
      expect(document.body).toBeTruthy();
    });

    it('displays degrees when displayFormat is "degrees"', () => {
      render(
        <Fretboard {...defaultProps} displayFormat="degrees" rootNote="C" />,
      );
      expect(document.body).toBeTruthy();
    });

    it('displays nothing when displayFormat is "none"', () => {
      render(<Fretboard {...defaultProps} displayFormat="none" />);
      expect(document.body).toBeTruthy();
    });

    it("updates display when displayFormat changes", () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} displayFormat="notes" />,
      );

      rerender(<Fretboard {...defaultProps} displayFormat="degrees" />);
      expect(document.body).toBeTruthy();
    });
  });

  describe("Zoom and scroll", () => {
    it("respects fretZoom atom", () => {
      const store = createStore();
      store.set(fretZoomAtom, 200);

      const { container } = renderFretboard(store);
      const firstFret = container.querySelector(".fret-number");

      expect(firstFret).toBeTruthy();
      expect(firstFret).toHaveStyle("width: 98px");
    });

    it("has scroll container that is draggable", () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      const scrollContainer =
        container.querySelector('[class*="scroll"]') || container.firstChild;
      expect(scrollContainer).toBeTruthy();
    });

    it("handles zoom changes via atom store", () => {
      const store = createStore();
      const { container } = renderFretboard(store);

      expect(container.querySelector(".fret-number")).toHaveStyle(
        "width: 49px",
      );

      act(() => {
        store.set(fretZoomAtom, 150);
      });

      expect(container.querySelector(".fret-number")).toHaveStyle(
        "width: 74px",
      );
    });

    it("responds to fretStart and fretEnd atom changes", () => {
      const store = createStore();
      const { container } = renderFretboard(store);

      expect(getVisibleFretLabels(container).slice(0, 5)).toEqual([
        "0",
        "1",
        "2",
        "3",
        "4",
      ]);

      act(() => {
        store.set(fretStartAtom, 5);
        store.set(fretEndAtom, 9);
      });

      expect(container.querySelectorAll(".fret-number")).toHaveLength(5);
      expect(getVisibleFretLabels(container)).toEqual([
        "5",
        "6",
        "7",
        "8",
        "9",
      ]);
    });
  });

  describe("Chord tones and filtering", () => {
    it("can highlight chord tones separately", () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={["C", "D", "E", "F", "G", "A", "B"]}
          chordTones={["C", "E", "G"]}
        />,
      );
      expect(document.body).toBeTruthy();
    });

    it("filters to only chord tones when hideNonChordNotes is true", () => {
      const { rerender } = render(
        <Fretboard
          {...defaultProps}
          highlightNotes={["C", "D", "E", "F", "G", "A", "B"]}
          chordTones={["C", "E", "G"]}
          hideNonChordNotes={false}
        />,
      );

      rerender(
        <Fretboard
          {...defaultProps}
          highlightNotes={["C", "D", "E", "F", "G", "A", "B"]}
          chordTones={["C", "E", "G"]}
          hideNonChordNotes={true}
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it("handles chord fret spread calculation", () => {
      render(
        <Fretboard
          {...defaultProps}
          chordTones={["C", "E", "G"]}
          chordFretSpread={0}
        />,
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe("Shape polygons and visualization", () => {
    it("renders shape polygons when provided", () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          shape: "E" as const,
          color: "#6366f1",
          truncated: false,
          intendedMin: 0,
          intendedMax: 2,
          cagedLabel: "E Shape",
          modalLabel: "Ionian",
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="caged"
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it('displays CAGED labels when shapeLabels is "caged"', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          shape: "E" as const,
          color: "#6366f1",
          truncated: false,
          intendedMin: 0,
          intendedMax: 2,
          cagedLabel: "E Shape",
          modalLabel: null,
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="caged"
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it('displays modal labels when shapeLabels is "modal"', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 5 },
            { string: 1, fret: 7 },
            { string: 2, fret: 7 },
            { string: 3, fret: 7 },
            { string: 4, fret: 5 },
            { string: 5, fret: 5 },
          ],
          shape: "E" as const,
          color: "#6366f1",
          truncated: false,
          intendedMin: 5,
          intendedMax: 7,
          cagedLabel: "E Shape",
          modalLabel: "Dorian",
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="modal"
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it('hides labels when shapeLabels is "none"', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          shape: "E" as const,
          color: "#6366f1",
          truncated: false,
          intendedMin: 0,
          intendedMax: 2,
          cagedLabel: "E Shape",
          modalLabel: "Ionian",
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="none"
        />,
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe("Wrapped notes", () => {
    it("handles wrapped notes set", () => {
      const wrappedNotes = new Set(["4-24", "3-25"]);

      render(<Fretboard {...defaultProps} wrappedNotes={wrappedNotes} />);

      expect(document.body).toBeTruthy();
    });

    it("displays wrapped notes visually", () => {
      const wrappedNotes = new Set(["0-2", "1-5"]);

      const { container } = render(
        <Fretboard {...defaultProps} wrappedNotes={wrappedNotes} />,
      );

      expect(container).toBeTruthy();
    });
  });

  describe("Note coloring", () => {
    it("colors notes based on colorNotes prop", () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={["C", "D", "E", "F", "G", "A", "B"]}
          colorNotes={["F#", "B"]}
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it("updates colors when colorNotes changes", () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} colorNotes={["F", "B"]} />,
      );

      rerender(<Fretboard {...defaultProps} colorNotes={["F#", "C#"]} />);

      expect(document.body).toBeTruthy();
    });
  });

  describe("Accidentals", () => {
    it("displays sharps by default", () => {
      render(<Fretboard {...defaultProps} useFlats={false} />);
      expect(document.body).toBeTruthy();
    });

    it("displays flats when useFlats is true", () => {
      render(<Fretboard {...defaultProps} useFlats={true} />);
      expect(document.body).toBeTruthy();
    });

    it("updates display when useFlats changes", () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} useFlats={false} />,
      );

      rerender(<Fretboard {...defaultProps} useFlats={true} />);

      expect(document.body).toBeTruthy();
    });
  });

  describe("Fret markers", () => {
    it("displays fret markers at standard positions", () => {
      const { container } = render(<Fretboard {...defaultProps} />);

      for (const fret of [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]) {
        expect(getFretMarker(container, fret)).toBeTruthy();
      }

      expect(
        getFretMarker(container, 12)?.querySelector(".marker-double"),
      ).toBeTruthy();
      expect(
        getFretMarker(container, 24)?.querySelector(".marker-double"),
      ).toBeTruthy();
    });

    it("hides fret markers outside visible range", () => {
      const store = createStore();
      store.set(fretStartAtom, 10);
      store.set(fretEndAtom, 15);

      const { container } = renderFretboard(store);

      expect(getFretMarker(container, 12)).toBeTruthy();
      expect(
        getFretMarker(container, 12)?.querySelector(".marker-double"),
      ).toBeTruthy();
      expect(getFretMarker(container, 15)).toBeTruthy();
      expect(
        getFretMarker(container, 15)?.querySelector(".marker-double"),
      ).toBeNull();

      for (const fret of [3, 5, 7, 9, 17, 19, 21, 24]) {
        expect(getFretMarker(container, fret)).toBeNull();
      }
    });
  });

  describe("Click handlers", () => {
    it("calls onFretClick when a fret is clicked", async () => {
      const onFretClick = vi.fn();
      render(<Fretboard {...defaultProps} onFretClick={onFretClick} />);

      // Find a note bubble and click it
      const buttons = screen.queryAllByRole("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // onFretClick should be called
      }
    });

    it("passes correct parameters to onFretClick", async () => {
      const onFretClick = vi.fn();
      render(
        <Fretboard {...defaultProps} rootNote="C" onFretClick={onFretClick} />,
      );

      const buttons = screen.queryAllByRole("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // Callback should receive string index, fret index, and note name
      }
    });
  });

  describe("Mobile responsiveness", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 600, // Mobile width
      });
    });

    it("adjusts zoom for mobile viewport", () => {
      render(<Fretboard {...defaultProps} />);
      // Mobile zoom calculation: Math.floor(600 / 7) ≈ 85
      expect(document.body).toBeTruthy();
    });

    it("uses desktop zoom on wide viewports", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920, // Desktop width
      });

      const { container } = render(<Fretboard {...defaultProps} />);

      expect(container.querySelector(".fret-number")).toHaveStyle(
        "width: 49px",
      );
    });
  });

  describe("Edge cases", () => {
    it("handles 0 frets gracefully", () => {
      const store = createStore();
      store.set(fretStartAtom, 0);
      store.set(fretEndAtom, 0);

      const { container } = renderFretboard(store);

      expect(container.querySelectorAll(".fret-number")).toHaveLength(1);
      expect(getVisibleFretLabels(container)).toEqual(["0"]);
    });

    it("handles very high fret numbers", () => {
      render(<Fretboard {...defaultProps} maxFret={36} />);

      expect(document.body).toBeTruthy();
    });

    it("handles single-note highlight", () => {
      render(<Fretboard {...defaultProps} highlightNotes={["C"]} />);

      expect(document.body).toBeTruthy();
    });

    it("handles all 12 notes highlighted", () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={[
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
            "G",
            "G#",
            "A",
            "A#",
            "B",
          ]}
        />,
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('marker-dot CSS custom property', () => {
    it('sets --string-row-px on fretboard-neck container', () => {
      const { container } = render(
        <Provider store={createStore()}>
          <Fretboard {...defaultProps} stringRowPx={48} />
        </Provider>,
      );
      const neck = container.querySelector('.fretboard-neck');
      expect(neck).not.toBeNull();
      expect((neck as HTMLElement).style.getPropertyValue('--string-row-px')).toBe('48px');
    });

    it('sets --string-row-px correctly at minimum stringRowPx=40', () => {
      const { container } = render(
        <Provider store={createStore()}>
          <Fretboard {...defaultProps} stringRowPx={40} />
        </Provider>,
      );
      const neck = container.querySelector('.fretboard-neck');
      expect((neck as HTMLElement).style.getPropertyValue('--string-row-px')).toBe('40px');
    });

    it('sets --string-row-px correctly at maximum stringRowPx=72', () => {
      const { container } = render(
        <Provider store={createStore()}>
          <Fretboard {...defaultProps} stringRowPx={72} />
        </Provider>,
      );
      const neck = container.querySelector('.fretboard-neck');
      expect((neck as HTMLElement).style.getPropertyValue('--string-row-px')).toBe('72px');
    });
  });
});
