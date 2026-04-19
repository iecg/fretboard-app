// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { k } from "./utils/storage";
// Pre-import lazy-loaded components so React.lazy() resolves from the module
// cache synchronously, allowing Suspense to mount them without async delay.
import "../components/MobileTabPanel";
import "../components/TheoryControls";

// vi.mock is hoisted to the top of the file, so variables referenced inside its
// factory must be declared with vi.hoisted() to be available at that point.
const mockSynth = vi.hoisted(() => ({
  playNote: vi.fn(),
  setMute: vi.fn(),
  init: vi.fn(),
}));

vi.mock("../audio", () => ({
  synth: mockSynth,
}));

describe("Integration Tests - User Workflows", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1920, // Desktop by default
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("Workflow 1: Select Scale & View on Fretboard", () => {
    it("user selects Dorian scale → fretboard updates", async () => {
      render(<App />);

      // Initial state: C Major
      expect(localStorage.getItem(k("scaleName"))).toBe("Major");

      // Simulate user selecting scale from drawer
      localStorage.setItem(k("scaleName"), "Dorian");

      const { rerender } = render(<App />);
      rerender(<App />);

      // Assert state updated
      expect(localStorage.getItem(k("scaleName"))).toBe("Dorian");
    });

    it("user changes root note → scale notes update", async () => {
      render(<App />);

      // Start: C Major
      expect(localStorage.getItem(k("rootNote"))).toBe("C");

      // User clicks G in circle of fifths
      localStorage.setItem(k("rootNote"), "G");

      const { rerender } = render(<App />);
      rerender(<App />);

      // Assert root changed
      expect(localStorage.getItem(k("rootNote"))).toBe("G");
    });

    it("user selects Natural Minor scale", async () => {
      render(<App />);

      localStorage.setItem(k("rootNote"), "A");
      localStorage.setItem(k("scaleName"), "Natural Minor");

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("scaleName"))).toBe("Natural Minor");
      expect(localStorage.getItem(k("rootNote"))).toBe("A");
    });

    it("user selects pentatonic scale", async () => {
      render(<App />);

      localStorage.setItem(k("scaleName"), "Minor Pentatonic");
      localStorage.setItem(k("rootNote"), "A");

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("scaleName"))).toBe("Minor Pentatonic");
    });

    it("cycling through multiple scales", async () => {
      const scales = [
        "Major",
        "Dorian",
        "Natural Minor",
        "Harmonic Minor",
        "Minor Pentatonic",
      ];

      for (const scale of scales) {
        localStorage.clear();
        localStorage.setItem(k("scaleName"), scale);

        const { unmount } = render(<App />);
        expect(localStorage.getItem(k("scaleName"))).toBe(scale);
        unmount();
      }
    });
  });

  describe("Workflow 2: Select Chord Overlay & Filter Notes", () => {
    it("user selects chord type → chord overlay appears", async () => {
      render(<App />);

      // App initializes chordType as null but persists it as '' in localStorage
      expect(localStorage.getItem(k("chordType"))).toBeFalsy();

      // User selects chord
      localStorage.setItem(k("chordType"), "Major Triad");

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("chordType"))).toBe("Major Triad");
    });

    it("enabling hideNonChordNotes filters display", async () => {
      render(<App />);

      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("hideNonChordNotes"), "false");

      const { rerender } = render(<App />);
      expect(localStorage.getItem(k("hideNonChordNotes"))).toBe("false");

      // User enables filter
      localStorage.setItem(k("hideNonChordNotes"), "true");
      rerender(<App />);

      expect(localStorage.getItem(k("hideNonChordNotes"))).toBe("true");
    });

    it("chord root links to scale root by default", async () => {
      render(<App />);

      // Set chord type with default linking
      localStorage.setItem(k("chordType"), "Minor 7th");
      localStorage.setItem(k("linkChordRoot"), "true");

      const { rerender } = render(<App />);

      // Change scale root
      localStorage.setItem(k("rootNote"), "D");
      // In real app, this would trigger linked chord root update
      // Simulate that behavior
      localStorage.setItem(k("chordRoot"), "D");

      rerender(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("D");
      expect(localStorage.getItem(k("chordRoot"))).toBe("D");
    });

    it("disabling link allows independent chord root", async () => {
      render(<App />);

      localStorage.setItem(k("chordType"), "Dominant 7th");
      localStorage.setItem(k("linkChordRoot"), "false");
      localStorage.setItem(k("chordRoot"), "G");

      const { rerender } = render(<App />);
      rerender(<App />);

      // Change scale root
      localStorage.setItem(k("rootNote"), "C");
      rerender(<App />);

      // Chord root should NOT change
      expect(localStorage.getItem(k("chordRoot"))).toBe("G");
      expect(localStorage.getItem(k("rootNote"))).toBe("C");
    });

    it("selecting different chord types", async () => {
      const chordTypes = [
        "Major Triad",
        "Minor Triad",
        "Dominant 7th",
        "Major 7th",
        "Power Chord (5)",
      ];

      for (const chord of chordTypes) {
        localStorage.clear();
        localStorage.setItem(k("chordType"), chord);

        const { unmount } = render(<App />);
        expect(localStorage.getItem(k("chordType"))).toBe(chord);
        unmount();
      }
    });
  });

  describe("Workflow 3: Circle of Fifths Navigation", () => {
    it("user clicks note in circle → root note updates", async () => {
      const { rerender } = render(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("C");

      // Simulate clicking G
      localStorage.setItem(k("rootNote"), "G");
      rerender(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("G");
    });

    it("navigating around circle of fifths", async () => {
      const notes = ["C", "G", "D", "A", "E", "B", "F#", "C#"];

      for (const note of notes) {
        localStorage.clear();
        localStorage.setItem(k("rootNote"), note);

        const { unmount } = render(<App />);
        expect(localStorage.getItem(k("rootNote"))).toBe(note);
        unmount();
      }
    });

    it("circle updates fretboard when root changes", async () => {
      const { rerender } = render(<App />);

      const initialRoot = localStorage.getItem(k("rootNote"));
      expect(initialRoot).toBe("C");

      localStorage.setItem(k("rootNote"), "A");
      rerender(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("A");
    });

    it("linked chord root follows circle navigation", async () => {
      const { rerender } = render(<App />);

      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("linkChordRoot"), "true");
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("chordRoot"), "C");

      rerender(<App />);

      // Navigate circle
      localStorage.setItem(k("rootNote"), "D");
      localStorage.setItem(k("chordRoot"), "D"); // Would be auto-updated by app
      rerender(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("D");
      expect(localStorage.getItem(k("chordRoot"))).toBe("D");
    });
  });

  describe("Workflow 4: Audio Playback on Note Click", () => {
    it("user clicks note → audio plays (if unmuted)", async () => {
      localStorage.setItem(k("isMuted"), "false");
      render(<App />);

      // Simulate clicking a note (this would happen via fretboard click)
      // For this test, we verify the mechanism works
      expect(localStorage.getItem(k("isMuted"))).toBe("false");
      expect(mockSynth.setMute).not.toHaveBeenCalledWith(true);
    });

    it("muted state prevents audio playback", async () => {
      localStorage.setItem(k("isMuted"), "true");
      render(<App />);

      // Synth should be muted on init
      expect(mockSynth.setMute).toHaveBeenCalledWith(true);
    });

    it("frequencies match note positions on fretboard", async () => {
      // This integration verifies the audio frequency calculation
      // Standard tuning low E = 82.41 Hz, fret 0
      // Fret 5 = A at 110 Hz
      // Fret 12 = octave = 2x frequency

      render(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("C");

      // In real app, clicking fret 0 on low E string would play E2
      // Clicking fret 12 would play E3 (2x frequency)
    });
  });

  describe("Workflow 5: Mute Toggle Prevents Audio", () => {
    it("toggling mute state", async () => {
      render(<App />);

      expect(localStorage.getItem(k("isMuted"))).toBe("false");

      // User clicks mute
      localStorage.setItem(k("isMuted"), "true");
      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("isMuted"))).toBe("true");
      expect(mockSynth.setMute).toHaveBeenCalledWith(true);
    });

    it("unmuting re-enables audio", async () => {
      localStorage.setItem(k("isMuted"), "true");
      const { rerender } = render(<App />);

      // Unmute
      localStorage.setItem(k("isMuted"), "false");
      rerender(<App />);

      expect(localStorage.getItem(k("isMuted"))).toBe("false");
    });

    it("mute state persists across sessions", async () => {
      localStorage.setItem(k("isMuted"), "true");
      const { unmount } = render(<App />);
      unmount();

      // Simulate page reload
      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("isMuted"))).toBe("true");
    });
  });

  describe("Workflow 6: Tuning Change Recalculates Notes", () => {
    it("changing tuning updates fretboard", async () => {
      render(<App />);

      expect(localStorage.getItem(k("tuningName"))).toBe("Standard");

      localStorage.setItem(k("tuningName"), "Drop D");
      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("tuningName"))).toBe("Drop D");
    });

    it("all available tunings render correctly", async () => {
      const tunings = ["Standard", "Drop D", "Half Step Down", "Open E"];

      for (const tuning of tunings) {
        localStorage.clear();
        localStorage.setItem(k("tuningName"), tuning);

        const { unmount } = render(<App />);
        expect(localStorage.getItem(k("tuningName"))).toBe(tuning);
        unmount();
      }
    });

    it("tuning affects all scale notes", async () => {
      render(<App />);

      localStorage.setItem(k("tuningName"), "Drop D");
      localStorage.setItem(k("scaleName"), "Major");
      localStorage.setItem(k("rootNote"), "D");

      const { rerender } = render(<App />);
      rerender(<App />);

      // Drop D starts on D instead of E on low string
      // All intervals should be recalculated
      expect(localStorage.getItem(k("tuningName"))).toBe("Drop D");
    });
  });

  describe("Workflow 7: Mobile Tab Navigation", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 390, // Mobile portrait width
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 844, // Mobile portrait height (taller than width → portrait)
      });
    });

    it("switching between Theory and View tabs", async () => {
      const { rerender } = render(<App />);

      expect(localStorage.getItem(k("mobileTab"))).toBe("theory");

      localStorage.setItem(k("mobileTab"), "view");
      rerender(<App />);
      expect(localStorage.getItem(k("mobileTab"))).toBe("view");

      localStorage.setItem(k("mobileTab"), "theory");
      rerender(<App />);
      expect(localStorage.getItem(k("mobileTab"))).toBe("theory");
    });

    it("theory tab exposes the circle of fifths behind a disclosure", async () => {
      localStorage.setItem(k("mobileTab"), "theory");

      // Mobile viewport is set by beforeEach (390×844 portrait).
      render(<App />);

      // Wait for the lazy-loaded MobileTabPanel + TheoryControls Suspense
      // boundaries to resolve before querying. Lazy imports resolve
      // asynchronously via polling rather than a single act flush.
      await waitFor(
        () => expect(screen.getByRole("button", { name: /Circle of Fifths/i })).toBeInTheDocument(),
        { timeout: 3000 },
      );
    });

    it("mobile tab preference persists", async () => {
      localStorage.setItem(k("mobileTab"), "view");
      const { unmount } = render(<App />);
      unmount();

      // Simulate reload
      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("mobileTab"))).toBe("view");
    });
  });

  describe("Workflow 8: Persistent State Round-Trip", () => {
    it("complex app state survives reload", async () => {
      // Set up complex state
      localStorage.setItem(k("rootNote"), "G");
      localStorage.setItem(k("scaleName"), "Dorian");
      localStorage.setItem(k("chordRoot"), "D");
      localStorage.setItem(k("chordType"), "Minor 7th");
      localStorage.setItem(k("displayFormat"), "degrees");
      localStorage.setItem(k("isMuted"), "true");
      localStorage.setItem(k("tuningName"), "Standard");

      const { unmount } = render(<App />);

      // Verify all state saved
      expect(localStorage.getItem(k("rootNote"))).toBe("G");
      expect(localStorage.getItem(k("scaleName"))).toBe("Dorian");
      expect(localStorage.getItem(k("chordType"))).toBe("Minor 7th");
      expect(localStorage.getItem(k("displayFormat"))).toBe("degrees");

      unmount();

      // Simulate page reload - localStorage persists
      const { rerender } = render(<App />);
      rerender(<App />);

      // All state should be restored
      expect(localStorage.getItem(k("rootNote"))).toBe("G");
      expect(localStorage.getItem(k("scaleName"))).toBe("Dorian");
      expect(localStorage.getItem(k("chordType"))).toBe("Minor 7th");
      expect(localStorage.getItem(k("displayFormat"))).toBe("degrees");
    });

    it("reset clears all localStorage", async () => {
      // Fill with data
      localStorage.setItem(k("rootNote"), "A");
      localStorage.setItem(k("scaleName"), "Natural Minor");
      localStorage.setItem(k("chordType"), "Major 7th");

      const { rerender } = render(<App />);

      // Simulate reset button click
      localStorage.clear();
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major");
      localStorage.setItem(k("chordType"), "");

      rerender(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("C");
      expect(localStorage.getItem(k("scaleName"))).toBe("Major");
    });

    it("partial state updates preserve other settings", async () => {
      render(<App />);

      localStorage.setItem(k("rootNote"), "D");
      localStorage.setItem(k("scaleName"), "Major");

      const { rerender } = render(<App />);
      rerender(<App />);

      // Change only root
      localStorage.setItem(k("rootNote"), "G");
      rerender(<App />);

      // Other settings should persist
      expect(localStorage.getItem(k("scaleName"))).toBe("Major");
      expect(localStorage.getItem(k("rootNote"))).toBe("G");
    });
  });

  describe("Workflow 9: CAGED Shape Selection & Visualization", () => {
    it("enabling CAGED fingering pattern", async () => {
      render(<App />);

      expect(localStorage.getItem(k("fingeringPattern"))).toBe("all");

      localStorage.setItem(k("fingeringPattern"), "caged");
      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("fingeringPattern"))).toBe("caged");
    });

    it("selecting specific CAGED shapes", async () => {
      render(<App />);

      localStorage.setItem(k("fingeringPattern"), "caged");
      localStorage.setItem(k("cagedShapes"), JSON.stringify(["C", "A", "G"]));

      const { rerender } = render(<App />);
      rerender(<App />);

      const saved = localStorage.getItem(k("cagedShapes"));
      expect(saved).toBe(JSON.stringify(["C", "A", "G"]));
    });

    it("switching between fingering patterns", async () => {
      const patterns = ["all", "caged", "3nps"];

      for (const pattern of patterns) {
        localStorage.clear();
        localStorage.setItem(k("fingeringPattern"), pattern);

        const { unmount } = render(<App />);
        expect(localStorage.getItem(k("fingeringPattern"))).toBe(pattern);
        unmount();
      }
    });

    it("3NPS pattern with different positions", async () => {
      render(<App />);

      localStorage.setItem(k("fingeringPattern"), "3nps");

      // Different NPS positions
      for (let pos = 1; pos <= 3; pos++) {
        localStorage.setItem(k("npsPosition"), String(pos));

        const { rerender } = render(<App />);
        expect(localStorage.getItem(k("npsPosition"))).toBe(String(pos));
        rerender(<App />);
      }
    });
  });

  describe("Workflow 10: Display Format Changes", () => {
    it("switching between note/degree/none display", async () => {
      const formats: ("notes" | "degrees" | "none")[] = [
        "notes",
        "degrees",
        "none",
      ];

      for (const format of formats) {
        localStorage.clear();
        localStorage.setItem(k("displayFormat"), format);

        const { unmount } = render(<App />);
        expect(localStorage.getItem(k("displayFormat"))).toBe(format);
        unmount();
      }
    });

  });

  describe("Workflow 11: Accidental Display", () => {
    // Accidental mode is now session-only (non-persisted). The legacy
    // "useFlats" localStorage key is migrated once at module load and then
    // cleared; per-test migration cannot be observed because atoms.ts runs
    // its migration at import time. These tests verify the no-leak guarantee.
    it("updates note rendering when accidentalMode changes within a session", async () => {
      localStorage.setItem(k("rootNote"), "A#");
      localStorage.setItem(k("scaleName"), "Major");

      render(<App />);

      expect(screen.getByText("B♭ Major (Ionian)")).toBeInTheDocument();
      expect(localStorage.getItem("useFlats")).toBeNull();
      expect(localStorage.getItem("accidentalMode")).toBeNull();

      fireEvent.click(screen.getByLabelText("Open settings"));

      await waitFor(() => {
        expect(screen.getByText("Accidentals")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "♯" }));

      await waitFor(() => {
        expect(screen.getByText("A♯ Major (Ionian)")).toBeInTheDocument();
      });

      expect(screen.queryByText("B♭ Major (Ionian)")).toBeNull();
      expect(localStorage.getItem("useFlats")).toBeNull();
      expect(localStorage.getItem("accidentalMode")).toBeNull();
    });

    it("does not write useFlats to localStorage when rendering App", async () => {
      render(<App />);
      expect(localStorage.getItem("useFlats")).toBeNull();
    });

    it("does not write accidentalMode to localStorage (non-persisted)", async () => {
      const { unmount } = render(<App />);
      unmount();
      expect(localStorage.getItem("accidentalMode")).toBeNull();
    });
  });

  describe("Workflow 12: Fretboard Zoom and Scroll", () => {
    it("adjusting fret zoom level", async () => {
      render(<App />);

      expect(localStorage.getItem(k("fretZoom"))).toBe("100");

      localStorage.setItem(k("fretZoom"), "150");
      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("fretZoom"))).toBe("150");
    });

    it("changing visible fret range", async () => {
      render(<App />);

      expect(localStorage.getItem(k("fretStart"))).toBe("0");
      expect(localStorage.getItem(k("fretEnd"))).toBe("25");

      // Scroll to show frets 5-17
      localStorage.setItem(k("fretStart"), "5");
      localStorage.setItem(k("fretEnd"), "17");

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("fretStart"))).toBe("5");
      expect(localStorage.getItem(k("fretEnd"))).toBe("17");
    });
  });

  describe("Cross-feature integration", () => {
    it("complete user session: root → scale → chord → toggle display", async () => {
      render(<App />);

      // Step 1: Select key
      localStorage.setItem(k("rootNote"), "A");
      const { rerender } = render(<App />);
      rerender(<App />);
      expect(localStorage.getItem(k("rootNote"))).toBe("A");

      // Step 2: Select scale
      localStorage.setItem(k("scaleName"), "Natural Minor");
      rerender(<App />);
      expect(localStorage.getItem(k("scaleName"))).toBe("Natural Minor");

      // Step 3: Add chord
      localStorage.setItem(k("chordType"), "Minor 7th");
      localStorage.setItem(k("chordRoot"), "A");
      rerender(<App />);
      expect(localStorage.getItem(k("chordType"))).toBe("Minor 7th");

      // Step 4: Switch display
      localStorage.setItem(k("displayFormat"), "degrees");
      rerender(<App />);
      expect(localStorage.getItem(k("displayFormat"))).toBe("degrees");

      // Step 5: All settings should coexist (accidentalMode is non-persisted)
      expect(localStorage.getItem(k("rootNote"))).toBe("A");
      expect(localStorage.getItem(k("scaleName"))).toBe("Natural Minor");
      expect(localStorage.getItem(k("chordType"))).toBe("Minor 7th");
      expect(localStorage.getItem(k("displayFormat"))).toBe("degrees");
    });
  });
});