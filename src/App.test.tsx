// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { synth } from "./core/audio";
import { get3NPSCoordinates, STANDARD_TUNING } from "@fretflow/core";
import { k } from "./test-utils/storage";

// Mock child components to isolate App-level wiring (state -> rendered tree).
vi.mock("./components/Fretboard/Fretboard", async () => {
  const { useAtomValue } = await import("jotai");
  const { rootNoteAtom, colorNotesAtom } = await import("./store/scaleAtoms");
  const { shapeDataAtom } = await import("./store/shapeAtoms");
  return {
    Fretboard: ({ stringRowPx }: { stringRowPx?: number }) => {
      const rootNote = useAtomValue(rootNoteAtom);
      const { highlightNotes } = useAtomValue(shapeDataAtom);
      const colorNotes = useAtomValue(colorNotesAtom);
      return (
        <div
          data-testid="fretboard"
          data-string-row-px={String(stringRowPx ?? "")}
          data-color-notes={colorNotes.join(",")}
        >
          Fretboard: {rootNote} - {highlightNotes.length} notes - row {stringRowPx}
        </div>
      );
    },
  };
});

vi.mock("./components/CircleOfFifths/CircleOfFifths", async () => {
  const { useAtomValue, useSetAtom } = await import("jotai");
  const { rootNoteAtom } = await import("./store/scaleAtoms");
  const { setRootNoteAtom } = await import("./store/actions");
  return {
    CircleOfFifths: () => {
      const rootNote = useAtomValue(rootNoteAtom);
      const setRootNote = useSetAtom(setRootNoteAtom);
      return (
        <button data-testid="circle-of-fifths" onClick={() => setRootNote("G")}>
          CoF: {rootNote}
        </button>
      );
    },
  };
});

vi.mock("./core/audio", () => ({
  synth: {
    setMute: vi.fn(),
    init: vi.fn(),
    playNote: vi.fn(),
    resume: vi.fn(),
  },
}));

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
};

// Inspector tab bodies (Radix Tabs) only mount when active; tests that exercise
// Scale/Chord tab controls must select the tab first.
const selectInspectorTab = async (name: "View" | "Scale" | "Chord") => {
  await userEvent.click(await screen.findByRole("tab", { name }));
};

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setViewport(1920, 1200);
  });
  afterEach(() => localStorage.clear());

  describe("initial mount", () => {
    it("renders with default state and a working fretboard", () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: C");
    });

    it("loads persisted root and scale from localStorage", async () => {
      localStorage.setItem(k("rootNote"), "G");
      localStorage.setItem(k("scaleName"), "Minor");
      render(<App />);
      await selectInspectorTab("Scale");
      expect(await screen.findByTestId("circle-of-fifths")).toHaveTextContent("CoF: G");
    });

    it("seeds isMuted in storage and forwards initial mute state to synth", () => {
      localStorage.setItem(k("isMuted"), "true");
      render(<App />);
      expect(synth.setMute).toHaveBeenCalledWith(true);
      expect(localStorage.getItem(k("isMuted"))).toBe("true");
    });
  });

  describe("root note changes (Circle of Fifths -> Fretboard)", () => {
    it("propagates a new root note to the fretboard", async () => {
      render(<App />);
      await selectInspectorTab("Scale");
      fireEvent.click(await screen.findByTestId("circle-of-fifths"));
      await waitFor(() => {
        expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: G");
        expect(localStorage.getItem(k("rootNote"))).toBe("G");
      });
    });

    it("transposes the active step's manualRoot when the scale root changes", async () => {
      // Seed a single-step progression with manualRoot=C; changing the scale
      // root to G must transpose manualRoot to G via the root-change listener.
      const steps = [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Major Triad", manualRoot: "C" },
      ];
      localStorage.setItem(k("progressionSteps"), JSON.stringify(steps));
      render(<App />);
      await selectInspectorTab("Scale");
      fireEvent.click(await screen.findByTestId("circle-of-fifths"));
      await waitFor(() => {
        const persisted = JSON.parse(localStorage.getItem(k("progressionSteps")) ?? "[]") as Array<{ manualRoot: string }>;
        expect(persisted[0]?.manualRoot).toBe("G");
      });
    });

    it("a diatonic step's chord re-resolves through the new scale root without becoming manual", async () => {
      // A step with manualRoot=null stays diatonic; changing the scale root
      // re-resolves its chord through getDiatonicChord (no manualRoot write).
      const steps = [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ];
      localStorage.setItem(k("progressionSteps"), JSON.stringify(steps));
      render(<App />);
      await selectInspectorTab("Scale");
      fireEvent.click(await screen.findByTestId("circle-of-fifths"));
      await waitFor(() => {
        expect(localStorage.getItem(k("rootNote"))).toBe("G");
        const persisted = JSON.parse(localStorage.getItem(k("progressionSteps")) ?? "[]") as Array<{ manualRoot: string | null }>;
        expect(persisted[0]?.manualRoot).toBeNull();
      });
    });
  });

  describe("audio + theme interactions", () => {
    it("toggles mute via header button and forwards to synth", async () => {
      render(<App />);
      const muteBtn = screen.getByLabelText("Mute audio");
      fireEvent.click(muteBtn);
      await waitFor(() => {
        expect(localStorage.getItem(k("isMuted"))).toBe("true");
        expect(synth.setMute).toHaveBeenCalled();
      });
    });

    it("changes theme via settings overlay", async () => {
      render(<App />);
      fireEvent.click(screen.getByLabelText("Open settings"));
      await screen.findByText("Settings");
      const settingsDialog = screen.getByRole("dialog");
      fireEvent.click(within(settingsDialog).getByRole("button", { name: /^light$/i }));
      await waitFor(() => {
        expect(document.documentElement.getAttribute("data-theme")).toBe("modern-light");
      });
    });
  });

  describe("chord overlay (quality override)", () => {
    it("clicking a Chord Type option writes through to the active progression step", async () => {
      const steps = [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
      ];
      localStorage.setItem(k("progressionSteps"), JSON.stringify(steps));
      render(<App />);
      await selectInspectorTab("Chord");
      const chordTypeGroup = await screen.findByRole("group", { name: "Chord Type" });
      fireEvent.click(within(chordTypeGroup).getByRole("button", { name: "min" }));
      await waitFor(() => {
        const persisted = JSON.parse(localStorage.getItem(k("progressionSteps")) ?? "[]") as Array<{ qualityOverride: string | null }>;
        expect(persisted[0]?.qualityOverride).toBe("Minor Triad");
      });
    });
  });

  describe("accidental mode is session-only", () => {
    it("never writes useFlats or accidentalMode to localStorage", async () => {
      render(<App />);
      fireEvent.click(screen.getByLabelText("Open settings"));
      await screen.findByText("Accidentals");
      fireEvent.click(screen.getByRole("button", { name: "♭" }));
      expect(localStorage.getItem("useFlats")).toBeNull();
      expect(localStorage.getItem("accidentalMode")).toBeNull();
    });
  });

  describe("scale-derived state reaches the fretboard", () => {
    it.each([
      ["Minor Blues", "F#"],
      ["Major Blues", "D#"],
    ])("%s scale passes blue note %s to the fretboard", (scaleName, blueNote) => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), scaleName);
      render(<App />);
      expect(screen.getByTestId("fretboard")).toHaveAttribute("data-color-notes", blueNote);
    });

    it("uses 3NPS coordinates when a position is selected", () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major");
      localStorage.setItem(k("fingeringPattern"), "3nps");
      localStorage.setItem(k("npsPosition"), "2");
      render(<App />);
      const expectedCount = get3NPSCoordinates("C", "Major", STANDARD_TUNING, 24, 2).coordinates.length;
      expect(screen.getByTestId("fretboard")).toHaveTextContent(`Fretboard: C - ${expectedCount} notes`);
    });
  });

  describe("viewport resize updates layout attributes", () => {
    it("transitions desktop -> tablet on resize", async () => {
      setViewport(1920, 1080);
      render(<App />);
      setViewport(768, 1024);
      fireEvent(window, new Event("resize"));
      await waitFor(() => {
        const appContainer = document.querySelector(".app-container");
        expect(appContainer?.getAttribute("data-layout-tier")).toBe("tablet");
      });
    });
  });

  describe("chord overlay hidden reset on identity change", () => {
    function setupHiddenPracticeBar() {
      // Dominant 7th over C Major has Bb outside the scale, so the practice bar renders.
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major");
      const steps = [
        { id: "x", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "Dominant 7th", manualRoot: "C" },
      ];
      localStorage.setItem(k("progressionSteps"), JSON.stringify(steps));
      localStorage.setItem(k("practiceLens"), "tones");
      localStorage.setItem(k("chordOverlayHidden"), "true");
    }

    it("resets overlay visibility when rootNote changes via Circle of Fifths", async () => {
      setupHiddenPracticeBar();
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector('.chord-practice-bar[data-collapsed="true"]')).toBeTruthy();
      });
      await userEvent.click(await screen.findByRole("tab", { name: "Scale" }));
      fireEvent.click(await screen.findByTestId("circle-of-fifths"));
      await waitFor(() => {
        expect(document.querySelector(".chord-practice-bar")).toBeTruthy();
        expect(document.querySelector(".chord-practice-bar[data-collapsed]")).toBeNull();
      });
    });

    it("does NOT reset overlay visibility on initial mount when persisted hidden=true", async () => {
      setupHiddenPracticeBar();
      render(<App />);
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(document.querySelector('.chord-practice-bar[data-collapsed="true"]')).toBeTruthy();
      expect(localStorage.getItem(k("chordOverlayHidden"))).toBe("true");
    });
  });
});

describe("Responsive string row sizes", () => {
  beforeEach(() => localStorage.clear());

  it.each([
    [390, 844, "34"],
    [768, 1024, "36"],
    [1440, 900, "42"],
  ])("viewport %ix%i uses string row size %s", (w, h, expected) => {
    setViewport(w, h);
    render(<App />);
    expect(screen.getByTestId("fretboard")).toHaveAttribute("data-string-row-px", expected);
  });
});
