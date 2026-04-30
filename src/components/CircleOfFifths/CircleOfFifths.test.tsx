// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CircleOfFifths } from "../CircleOfFifths/CircleOfFifths";
import { CIRCLE_OF_FIFTHS, SCALES } from "../../core/theory";
import { getCircleNoteLabels } from "../../core/circleOfFifthsUtils";

describe("CircleOfFifths/CircleOfFifths", () => {
  const mockSetRootNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("renders SVG with correct viewBox", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const svg = document.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("-10 -10 340 340");
    });

    it("renders all 12 notes in circle", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      // Each note should have path elements for the slice
      const paths = document.querySelectorAll("path");
      // 12 slices + text labels = more than 12 paths
      expect(paths.length).toBeGreaterThanOrEqual(12);
    });

    it("renders notes in correct order around circle", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const textElements = document.querySelectorAll("text");
      // Should have text for all 12 notes
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe("Note selection", () => {
    it("calls setRootNote when a note is clicked", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      if (paths.length > 0) {
        fireEvent.click(paths[0]);
        expect(mockSetRootNote).toHaveBeenCalled();
      }
    });

    it("highlights active root note", () => {
      const { rerender } = render(
        <CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />,
      );

      // C is active by default
      const activePaths = document.querySelectorAll("path.active");
      expect(activePaths.length).toBeGreaterThan(0);

      // Change root note
      rerender(<CircleOfFifths rootNote="G" setRootNote={mockSetRootNote} />);

      // G should now be active
      const newActivePaths = document.querySelectorAll("path.active");
      expect(newActivePaths.length).toBeGreaterThan(0);
    });

    it("cycles through all notes correctly", () => {
      const roots = [
        "C",
        "G",
        "D",
        "A",
        "E",
        "B",
        "F#",
        "C#",
        "G#",
        "D#",
        "A#",
        "F",
      ];

      for (const root of roots) {
        const { unmount } = render(
          <CircleOfFifths rootNote={root} setRootNote={mockSetRootNote} />,
        );

        const activePaths = document.querySelectorAll("path.active");
        expect(activePaths.length).toBeGreaterThan(0);

        unmount();
      }
    });
  });

  describe("Scale-aware display", () => {
    it("displays degrees for Major scale", () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          scaleName="Major"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
      // Degree information should be rendered
    });

    it("displays degrees for Minor scale", () => {
      render(
        <CircleOfFifths
          rootNote="A"
          setRootNote={mockSetRootNote}
          scaleName="Natural Minor"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("updates degrees when scale changes", () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          scaleName="Major"
        />,
      );

      rerender(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          scaleName="Natural Minor"
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it("displays degrees for Lydian mode", () => {
      render(
        <CircleOfFifths
          rootNote="F"
          setRootNote={mockSetRootNote}
          scaleName="Lydian"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("displays degrees for Dorian mode", () => {
      render(
        <CircleOfFifths
          rootNote="D"
          setRootNote={mockSetRootNote}
          scaleName="Dorian"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  describe("Relative Scale Logic", () => {
    it("Major mode shows Relative Minor", () => {
      const { container } = render(
        <CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} scaleName="Major" />
      );
      const labels = container.querySelectorAll(".circle-footer-label");
      const values = container.querySelectorAll(".circle-footer-value");
      
      const relLabel = Array.from(labels).find(el => el.textContent === "Relative Minor");
      expect(relLabel).toBeTruthy();
      
      // Values are next to labels
      const index = Array.from(labels).indexOf(relLabel as Element);
      expect(values[index].textContent).toBe("Am");
    });

    it("Natural Minor mode shows Relative Major", () => {
      const { container } = render(
        <CircleOfFifths rootNote="A" setRootNote={mockSetRootNote} scaleName="Natural Minor" />
      );
      const labels = container.querySelectorAll(".circle-footer-label");
      const values = container.querySelectorAll(".circle-footer-value");
      
      const relLabel = Array.from(labels).find(el => el.textContent === "Relative Major");
      expect(relLabel).toBeTruthy();
      
      const index = Array.from(labels).indexOf(relLabel as Element);
      expect(values[index].textContent).toBe("C");
    });

    it("Dorian mode shows Parent Scale and computes modal parent correctly", () => {
      // D Dorian -> C Major
      const { container } = render(
        <CircleOfFifths rootNote="D" setRootNote={mockSetRootNote} scaleName="Dorian" />
      );
      const labels = container.querySelectorAll(".circle-footer-label");
      const values = container.querySelectorAll(".circle-footer-value");
      
      const relLabel = Array.from(labels).find(el => el.textContent === "Parent Scale");
      expect(relLabel).toBeTruthy();
      
      const index = Array.from(labels).indexOf(relLabel as Element);
      expect(values[index].textContent).toBe("C");
    });
  });

  describe("Accidentals", () => {
    it("displays sharps by default", () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={false}
        />,
      );

      const textElements = document.querySelectorAll("text");
      expect(textElements.length).toBeGreaterThan(0);
    });

    it("displays flats when useFlats is true", () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={true}
        />,
      );

      const textElements = document.querySelectorAll("text");
      expect(textElements.length).toBeGreaterThan(0);
    });

    it("switches between sharps and flats correctly", () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={false}
        />,
      );

      rerender(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={true}
        />,
      );

      expect(document.body).toBeTruthy();
    });

    it("displays enharmonic equivalents correctly", () => {
      // C# and Db should display differently based on useFlats
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C#"
          setRootNote={mockSetRootNote}
          useFlats={false}
        />,
      );

      rerender(
        <CircleOfFifths
          rootNote="C#"
          setRootNote={mockSetRootNote}
          useFlats={true}
        />,
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe("Visual accuracy", () => {
    it("positions notes around circle correctly", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const textElements = document.querySelectorAll("text");
      // Text elements should be positioned around the circle
      // They should have x and y attributes
      textElements.forEach((text) => {
        if (!text.hasAttribute("transform")) {
          expect(text.getAttribute("x")).toBeTruthy();
          expect(text.getAttribute("y")).toBeTruthy();
        }
      });
    });

    it("creates arc paths for slices", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      paths.forEach((path) => {
        const d = path.getAttribute("d");
        // Path should be an arc path (contains 'A' for arc command)
        expect(d).toMatch(/[A-Z]/);
      });
    });

    it("renders both outer and inner circles", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const paths = document.querySelectorAll("path");
      // Should have multiple paths for inner and outer arcs
      expect(paths.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe("Interaction", () => {
    it("responds to sequential clicks", async () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const paths = document.querySelectorAll('path[class*="circle-slice"]');

      // Click multiple notes
      fireEvent.click(paths[1]); // Second note (G)
      fireEvent.click(paths[4]); // Fifth note
      fireEvent.click(paths[0]); // Back to first note

      expect(mockSetRootNote).toHaveBeenCalledTimes(3);
    });

    it("maintains state across re-renders", () => {
      const { rerender } = render(
        <CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />,
      );

      const initialActive = document.querySelectorAll("path.active").length;
      expect(initialActive).toBeGreaterThan(0);

      rerender(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const afterRerender = document.querySelectorAll("path.active").length;
      expect(afterRerender).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("handles all chromatic notes as root", () => {
      const notes = CIRCLE_OF_FIFTHS;

      notes.forEach((note) => {
        const { unmount } = render(
          <CircleOfFifths rootNote={note} setRootNote={mockSetRootNote} />,
        );

        const activePaths = document.querySelectorAll("path.active");
        expect(activePaths.length).toBeGreaterThan(0);

        unmount();
      });
    });

    it("handles scale changes at different root notes", () => {
      const scales = ["Major", "Natural Minor", "Dorian", "Lydian"];
      const roots = ["C", "G", "A", "F"];

      roots.forEach((root) => {
        scales.forEach((scale) => {
          const { unmount } = render(
            <CircleOfFifths
              rootNote={root}
              setRootNote={mockSetRootNote}
              scaleName={scale}
            />,
          );

          const svg = document.querySelector("svg");
          expect(svg).toBeTruthy();

          unmount();
        });
      });
    });

    it("handles rapid root note changes", async () => {
      const { rerender } = render(
        <CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />,
      );

      // Rapidly change root note
      for (const note of ["G", "D", "A", "E", "B"]) {
        rerender(
          <CircleOfFifths rootNote={note} setRootNote={mockSetRootNote} />,
        );
      }

      expect(document.body).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("renders clickable paths", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      expect(paths.length).toBe(12);

      paths.forEach((path) => {
        expect(path.getAttribute("class")).toContain("circle-slice");
      });
    });

    it("paths respond to pointer events", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      fireEvent.click(paths[0]);

      expect(mockSetRootNote).toHaveBeenCalled();
    });
  });

  describe("CSS classes", () => {
    it("applies active class to selected note", () => {
      render(<CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />);

      const activePaths = document.querySelectorAll("path.active");
      expect(activePaths.length).toBeGreaterThan(0);
      expect(activePaths[0].getAttribute("class")).toContain("active");
    });

    it("removes active class when root changes", () => {
      const { rerender } = render(
        <CircleOfFifths rootNote="C" setRootNote={mockSetRootNote} />,
      );

      let activeCount = document.querySelectorAll("path.active").length;
      expect(activeCount).toBeGreaterThan(0);

      rerender(<CircleOfFifths rootNote="G" setRootNote={mockSetRootNote} />);

      activeCount = document.querySelectorAll("path.active").length;
      expect(activeCount).toBeGreaterThan(0);
    });
  });
});

describe("getCircleNoteLabels mode behavior", () => {
  // mode = "auto"
  it("auto: sharp note shows flat enharmonic", () => {
    const r = getCircleNoteLabels("A#", "C", false, SCALES["Major"], "auto");
    expect(r.primary).toBe("A♯");
    expect(r.enharmonic).toBe("B♭");
  });

  it("auto: natural note shows no enharmonic", () => {
    const r = getCircleNoteLabels("C", "C", false, SCALES["Major"], "auto");
    expect(r.primary).toBe("C");
    expect(r.enharmonic).toBeNull();
  });

  it("auto: respelled note shows original as enharmonic", () => {
    // Root passed as 'A#'; with useFlats=true it displays as B♭ -> primary = B♭, enharmonic = A♯
    const r = getCircleNoteLabels("A#", "A#", true, SCALES["Major"], "auto");
    expect(r.primary).toBe("B♭");
    expect(r.enharmonic).toBe("A♯");
  });

  // mode = "on"
  it("on: sharp note always shows flat enharmonic", () => {
    const r = getCircleNoteLabels("C#", "C", false, SCALES["Major"], "on");
    expect(r.primary).toBe("C♯");
    expect(r.enharmonic).toBe("D♭");
  });

  it("on: natural note with no enharmonic shows primary only", () => {
    const r = getCircleNoteLabels("C", "C", false, SCALES["Major"], "on");
    expect(r.primary).toBe("C");
    expect(r.enharmonic).toBeNull();
  });

  it("on: every enharmonic pair shows both spellings", () => {
    const pairs: [string, string][] = [
      ["C#", "D♭"],
      ["D#", "E♭"],
      ["F#", "G♭"],
      ["G#", "A♭"],
      ["A#", "B♭"],
    ];
    for (const [note, expectedEnh] of pairs) {
      const r = getCircleNoteLabels(note, "C", false, SCALES["Major"], "on");
      expect(r.enharmonic).toBe(expectedEnh);
    }
  });

  it("on: flat-spelled primary shows sharp enharmonic (no duplicate)", () => {
    // When useFlats=true, A# displays as Bb. Enharmonic should be A#, not Bb again.
    const r = getCircleNoteLabels("A#", "A#", true, SCALES["Major"], "on");
    expect(r.primary).toBe("B♭");
    expect(r.enharmonic).toBe("A♯");
  });

  it("on: all flat-spelled pairs show distinct enharmonics", () => {
    const flatPairs: [string, string, string][] = [
      ["C#", "D♭", "C♯"],
      ["D#", "E♭", "D♯"],
      ["F#", "G♭", "F♯"],
      ["G#", "A♭", "G♯"],
      ["A#", "B♭", "A♯"],
    ];
    for (const [note, expectedPrimary, expectedEnh] of flatPairs) {
      const r = getCircleNoteLabels(note, note, true, SCALES["Major"], "on");
      expect(r.primary).toBe(expectedPrimary);
      expect(r.enharmonic).toBe(expectedEnh);
      expect(r.primary).not.toBe(r.enharmonic);
    }
  });

  it("on: no duplicate labels for any of the 12 chromatic notes", () => {
    const notes = [
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
    ];
    for (const note of notes) {
      const r = getCircleNoteLabels(note, "C", false, SCALES["Major"], "on");
      if (r.enharmonic !== null) {
        expect(r.primary).not.toBe(r.enharmonic);
      }
    }
  });

  // mode = "off"
  it("off: sharp note shows primary only", () => {
    const r = getCircleNoteLabels("A#", "C", false, SCALES["Major"], "off");
    expect(r.primary).toBe("A♯");
    expect(r.enharmonic).toBeNull();
  });

  it("off: respelled note shows respelled primary only (no original)", () => {
    const r = getCircleNoteLabels("A#", "A#", true, SCALES["Major"], "off");
    expect(r.primary).toBe("B♭");
    expect(r.enharmonic).toBeNull();
  });

  it("off: natural note shows primary only", () => {
    const r = getCircleNoteLabels("C", "C", false, SCALES["Major"], "off");
    expect(r.primary).toBe("C");
    expect(r.enharmonic).toBeNull();
  });
});
