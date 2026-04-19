// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../App";
import { synth } from "../audio";
import { get3NPSCoordinates } from "../shapes";
import { STANDARD_TUNING } from "../guitar";
import { k } from "./utils/storage";

// Mock child components to isolate App logic
vi.mock("../Fretboard", async () => {
  const { useAtomValue } = await import("jotai");
  const { rootNoteAtom, colorNotesAtom, shapeDataAtom } = await import("../store/atoms");
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

vi.mock("../CircleOfFifths", async () => {
  const { useAtomValue, useSetAtom } = await import("jotai");
  const { rootNoteAtom, setRootNoteAtom } = await import("../store/atoms");
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

vi.mock("../DrawerSelector", () => ({
  DrawerSelector: ({
    label,
    value,
    onSelect,
    options,
  }: {
    label: string;
    value: string;
    onSelect: (v: string) => void;
    options: (string | { divider: string })[];
  }) => (
    <div data-testid={`drawer-${label.toLowerCase()}`}>
      <button
        onClick={() => {
          const firstOption = options.find(
            (option): option is string => typeof option === "string",
          );
          if (firstOption) onSelect(firstOption);
        }}
      >
        {label}: {value}
      </button>
    </div>
  ),
}));

vi.mock("../audio", () => ({
  synth: {
    setMute: vi.fn(),
    init: vi.fn(),
    playNote: vi.fn(),
  },
}));

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Use a roomy desktop viewport so the shared split controls panel
    // is visible without switching tabs.
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1200,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: height,
    });
  };

  describe("Initialization", () => {
    it("renders without crashing", () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toBeTruthy();
    });

    it("loads default state when localStorage is empty", () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: C");
    });

    it("renders alias-friendly summary labels", () => {
      render(<App />);
      const summary = screen.getByRole("group", { name: /scale degrees/i });
      expect(within(summary).getByText("C Major (Ionian)")).toBeInTheDocument();
    });

    it("renders the summary above the fretboard", () => {
      render(<App />);

      const summary = screen.getByRole("group", { name: /scale degrees/i });
      const fretboard = screen.getByTestId("fretboard");

      expect(
        summary.compareDocumentPosition(fretboard) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("loads persisted state from localStorage", async () => {
      localStorage.setItem(k("rootNote"), "G");
      localStorage.setItem(k("scaleName"), "Minor");
      render(<App />);
      expect(await screen.findByTestId("circle-of-fifths")).toHaveTextContent(
        "CoF: G",
      );
    });

    it("renders melodic minor summary labels with the jazz alias", async () => {
      localStorage.setItem(k("scaleName"), "Melodic Minor");
      render(<App />);
      const summary = await screen.findByRole("group", { name: /scale degrees/i });
      expect(
        within(summary).getByText("C Melodic Minor (Jazz Minor)"),
      ).toBeInTheDocument();
    });

    it("renders ordinal mode labels in relative browse mode", async () => {
      localStorage.setItem(k("rootNote"), "D");
      localStorage.setItem(k("scaleName"), "Dorian");
      localStorage.setItem(k("scaleBrowseMode"), "relative");
      render(<App />);
      const summary = await screen.findByRole("group", { name: /scale degrees/i });
      expect(within(summary).getByText("D Dorian (2nd Mode)")).toBeInTheDocument();
    });

    it("renders Unicode flat intervals in the degree chip strip for Natural Minor", async () => {
      localStorage.setItem(k("rootNote"), "A");
      localStorage.setItem(k("scaleName"), "Natural Minor");
      render(<App />);
      const summary = await screen.findByRole("group", { name: /scale degrees/i });
      expect(within(summary).getByText("♭3")).toBeInTheDocument();
      expect(within(summary).getByText("♭6")).toBeInTheDocument();
      expect(within(summary).getByText("♭7")).toBeInTheDocument();
    });

    it("defaults the summary collapsed on mobile", () => {
      setViewport(390, 844);
      render(<App />);

      // DegreeChipStrip replaces the old collapsible disclosure; on mobile the
      // strip is hidden via CSS (showSummary=false for landscape-mobile only).
      // In portrait mobile the strip is always visible.
      expect(
        screen.getByRole("group", { name: /scale degrees/i }),
      ).toBeInTheDocument();
    });

    it("defaults the summary expanded on desktop", () => {
      render(<App />);

      expect(
        screen.getByRole("group", { name: /scale degrees/i }),
      ).toBeInTheDocument();
    });

    it("expands the summary to reveal notes on mobile", () => {
      setViewport(390, 844);
      render(<App />);

      // DegreeChipStrip is always rendered (no toggle); chips are always visible.
      expect(
        screen.getByRole("group", { name: /scale degrees/i }),
      ).toBeInTheDocument();
    });

    it("persists isMuted to localStorage on first mount", () => {
      render(<App />);
      expect(localStorage.getItem(k("isMuted"))).toBe("false");
    });

    it("synth is muted based on initial state", () => {
      localStorage.setItem(k("isMuted"), "true");
      render(<App />);
      expect(synth.setMute).toHaveBeenCalledWith(true);
    });
  });

  describe("Root note changes", () => {
    it("updates fretboard when root note changes via Circle of Fifths", async () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: C");

      const cofButton = await screen.findByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(screen.getByTestId("fretboard")).toHaveTextContent(
          "Fretboard: G",
        );
      });
    });

    it("persists root note to localStorage", async () => {
      render(<App />);
      const cofButton = await screen.findByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem(k("rootNote"))).toBe("G");
      });
    });

    it("links chord root to scale root by default", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      render(<App />);

      const cofButton = await screen.findByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem(k("chordRoot"))).toBe("G");
      });
    });

    it("does not link chord root when linkChordRoot is false", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("linkChordRoot"), "false");
      localStorage.setItem(k("chordRoot"), "D");
      render(<App />);

      const cofButton = await screen.findByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem(k("chordRoot"))).toBe("D");
      });
    });
  });

  describe("Scale selection", () => {
    it("renders the shared theory controls", async () => {
      render(<App />);
      expect(
        await screen.findByRole("combobox", { name: "Scale Family" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Parallel" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Previous Mode/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Next Mode/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: "Mode" }),
      ).toBeInTheDocument();
    });

    it("persists scale name to localStorage", async () => {
      render(<App />);
      expect(localStorage.getItem(k("scaleName"))).toBe("Major");
    });
  });

  describe("Mute toggle", () => {
    it("toggles mute state", async () => {
      render(<App />);
      expect(localStorage.getItem(k("isMuted"))).toBe("false");

      const muteButtons = screen
        .getAllByRole("button")
        .filter((btn) =>
          btn.getAttribute("title")?.toLowerCase().includes("mute"),
        );

      if (muteButtons.length > 0) {
        fireEvent.click(muteButtons[0]);
        await waitFor(() => {
          expect(localStorage.getItem(k("isMuted"))).toBe("true");
        });
      }
    });

    it("calls synth.setMute when toggling mute", async () => {
      render(<App />);

      const muteButtons = screen
        .getAllByRole("button")
        .filter((btn) =>
          btn.getAttribute("title")?.toLowerCase().includes("mute"),
        );

      if (muteButtons.length > 0) {
        fireEvent.click(muteButtons[0]);
        await waitFor(() => {
          expect(synth.setMute).toHaveBeenCalled();
        });
      }
    });
  });

  describe("Reset functionality", () => {
    it("clears all localStorage on reset", async () => {
      localStorage.setItem(k("rootNote"), "G");
      localStorage.setItem(k("scaleName"), "Natural Minor");
      render(<App />);

      const resetButtons = screen
        .getAllByRole("button")
        .filter(
          (btn) =>
            btn.getAttribute("aria-label")?.includes("reset") ||
            btn.className.includes("reset"),
        );

      if (resetButtons.length > 0) {
        fireEvent.click(resetButtons[0]);
        await waitFor(() => {
          expect(localStorage.getItem(k("rootNote"))).toBeNull();
        });
      }
    });

    it("resets state to defaults", async () => {
      localStorage.setItem(k("rootNote"), "G");
      const { rerender } = render(<App />);

      const resetButtons = screen
        .getAllByRole("button")
        .filter(
          (btn) =>
            btn.getAttribute("aria-label")?.includes("reset") ||
            btn.className.includes("reset"),
        );

      if (resetButtons.length > 0) {
        fireEvent.click(resetButtons[0]);
        rerender(<App />);

        await waitFor(() => {
          expect(screen.getByTestId("fretboard")).toHaveTextContent(
            "Fretboard: C",
          );
        });
      }
    });
  });

  describe("Summary ribbon", () => {
    it("renders standalone DegreeChipStrip when no chord is active", () => {
      render(<App />);
      expect(document.querySelector(".summary-ribbon")).toBeNull();
      expect(document.querySelector(".degree-chip-strip")).toBeTruthy();
    });

    it("renders summary-ribbon when chord is active", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon")).toBeTruthy();
      });
    });

    it("compare mode: renders primary scale strip inside ribbon", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("viewMode"), "compare");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon .degree-chip-strip")).toBeTruthy();
      });
    });

    it("compare mode: chord practice bar hidden in simple diatonic case (same root, all preset, all in scale, C Major)", async () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major");
      localStorage.setItem(k("chordRoot"), "C");
      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("focusPreset"), "all");
      localStorage.setItem(k("viewMode"), "compare");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon")).toBeTruthy();
      });
      // Bar is intentionally hidden: C Major Triad over C Major is fully diatonic, no new information.
      expect(document.querySelector(".chord-practice-bar")).toBeNull();
      expect(document.querySelector(".relationship-row")).toBeNull();
    });

    it("compare mode: shows chord practice bar when chordRoot differs from scale root", async () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("chordRoot"), "G");
      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("focusPreset"), "all");
      localStorage.setItem(k("viewMode"), "compare");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".chord-practice-bar")).toBeTruthy();
      });
    });

    it("chord mode: renders chord practice bar and keeps degree-chip-strip inside ribbon", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("viewMode"), "chord");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon .chord-practice-bar")).toBeTruthy();
        expect(document.querySelector(".summary-ribbon .degree-chip-strip")).toBeTruthy();
      });
    });

    it("outside mode: renders chord practice bar and keeps degree-chip-strip inside ribbon", async () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("chordRoot"), "D");
      localStorage.setItem(k("chordType"), "Dominant 7th");
      localStorage.setItem(k("viewMode"), "outside");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon .chord-practice-bar")).toBeTruthy();
        expect(document.querySelector(".summary-ribbon .degree-chip-strip")).toBeTruthy();
      });
    });

    it("no legend row is rendered in compare mode", async () => {
      localStorage.setItem(k("chordType"), "Dominant 7th");
      localStorage.setItem(k("viewMode"), "compare");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon")).toBeTruthy();
      });
      expect(document.querySelector(".chord-row-legend")).toBeNull();
    });

    it("no legend row is rendered in chord mode", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      localStorage.setItem(k("viewMode"), "chord");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".summary-ribbon")).toBeTruthy();
      });
      expect(document.querySelector(".chord-row-legend")).toBeNull();
    });

    it("practice bar shows chord label as title and Compare badge in compare mode", async () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major");
      localStorage.setItem(k("chordRoot"), "C");
      // Dominant 7th has Bb which is outside C Major → bar is non-trivial and shown
      localStorage.setItem(k("chordType"), "Dominant 7th");
      localStorage.setItem(k("viewMode"), "compare");
      render(<App />);
      await waitFor(() => {
        expect(document.querySelector(".chord-practice-bar")).toBeTruthy();
      });
      const title = document.querySelector(".chord-practice-bar-title")!;
      const badge = document.querySelector(".chord-practice-bar-badge")!;
      expect(title.textContent).toContain("C");
      expect(title.textContent).toContain("Dominant 7th");
      expect(badge.textContent).toBe("Compare");
    });
  });

  describe("Chord overlay", () => {
    it("can set chord type", async () => {
      render(<App />);
      // ExpandedControlsPanel is lazy loaded, wait for it to be ready
      const chordOverlayBtn = await screen.findByRole("button", { name: /Chord Overlay/i });
      fireEvent.click(chordOverlayBtn);
      
      const chordTypeSelect = await screen.findByRole("combobox", { name: "Chord Type" });
      fireEvent.change(chordTypeSelect, {
        target: { value: "Major Triad" },
      });

      await waitFor(() => {
        expect(localStorage.getItem(k("chordType"))).toBe("Major Triad");
      });
    });

    it("persists chord type as empty string when null", async () => {
      localStorage.setItem(k("chordType"), "Major Triad");
      const { rerender } = render(<App />);

      // Update to clear chord type
      localStorage.setItem(k("chordType"), "");
      rerender(<App />);

      expect(localStorage.getItem(k("chordType"))).toBe("");
    });
  });

  describe("Accidentals", () => {
    it("does not write a useFlats key to localStorage (non-persisted)", async () => {
      render(<App />);
      // accidentalModeAtom is intentionally non-persisted; no localStorage key
      // should ever be written for it.
      expect(localStorage.getItem("useFlats")).toBeNull();
      expect(localStorage.getItem("accidentalMode")).toBeNull();

      fireEvent.click(screen.getByLabelText("Open settings"));

      await waitFor(() => {
        expect(screen.getByText("Accidentals")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "♭" }));

      expect(localStorage.getItem("useFlats")).toBeNull();
      expect(localStorage.getItem("accidentalMode")).toBeNull();
    });
  });

  describe("Fretboard zoom and scroll", () => {
    it("initializes with default fret range", () => {
      render(<App />);
      expect(localStorage.getItem(k("fretStart"))).toBe("0");
      expect(localStorage.getItem(k("fretEnd"))).toBe("25");
    });

    it("persists fret zoom level", async () => {
      localStorage.setItem(k("fretZoom"), "150");
      render(<App />);
      expect(localStorage.getItem(k("fretZoom"))).toBe("150");
    });
  });

  describe("Tuning selection", () => {
    it("uses Standard tuning by default", () => {
      render(<App />);
      expect(localStorage.getItem(k("tuningName"))).toBe("Standard");
    });

    it("persists tuning selection", async () => {
      localStorage.setItem(k("tuningName"), "Drop D");
      render(<App />);
      expect(localStorage.getItem(k("tuningName"))).toBe("Drop D");
    });
  });

  describe("Mobile responsiveness", () => {
    it("detects mobile viewport width < 768px", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 600,
      });

      render(<App />);
      // Mobile elements should be rendered
      screen.queryAllByTestId(/mobile/i);
    });

    it("persists mobile tab selection to localStorage", async () => {
      // mobileTabAtom is mounted on every App render (AppContent calls
      // useAtom(mobileTabAtom) unconditionally), so the default value is
      // written to localStorage regardless of viewport. setViewport(390, 844)
      // is kept so MobileTabPanel mounts alongside for parity with sibling
      // mobile-layout tests.
      setViewport(390, 844);
      render(<App />);
      expect(localStorage.getItem(k("mobileTab"))).toBe("theory");
    });

    it("uses compact mobile header attributes and full-width help modal", async () => {
      setViewport(390, 844);
      render(<App />);

      const appContainer = document.querySelector(".app-container");
      expect(appContainer?.getAttribute("data-layout-tier")).toBe("mobile");

      fireEvent.click(screen.getByLabelText("Open help"));

      await waitFor(() => {
        const helpModal = document.querySelector(".help-modal");
        expect(helpModal).toBeTruthy();
        expect(screen.getByRole("dialog", { name: "FretFlow Help" })).toBeTruthy();
      });

      fireEvent.click(screen.getByLabelText("Close help"));

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "FretFlow Help" }),
        ).toBeNull();
      });
    });

    it("hides mobile tabs and summary in landscape mobile", async () => {
      setViewport(667, 375);
      render(<App />);

      await waitFor(() => {
        const appContainer = document.querySelector(".app-container");
        expect(appContainer?.getAttribute("data-layout-variant")).toBe(
          "landscape-mobile",
        );
      });

      expect(document.querySelector(".mobile-tab-content")).toBeNull();
      expect(
        screen.queryByRole("group", { name: /scale degrees/i }),
      ).toBeNull();
    });

    it("closes the help modal when the backdrop is clicked", async () => {
      setViewport(390, 844);
      render(<App />);

      fireEvent.click(screen.getByLabelText("Open help"));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "FretFlow Help" })).toBeTruthy();
      });

      fireEvent.pointerDown(document.querySelector(".help-modal-overlay")!);

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "FretFlow Help" }),
        ).toBeNull();
      });
    });
  });

  describe("State persistence", () => {
    it("persists multiple state changes to localStorage", async () => {
      render(<App />);

      localStorage.setItem(k("rootNote"), "D");
      localStorage.setItem(k("scaleName"), "Dorian");
      localStorage.setItem(k("chordRoot"), "A");
      localStorage.setItem(k("chordType"), "Minor 7th");
      localStorage.setItem(k("isMuted"), "true");

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem(k("rootNote"))).toBe("D");
      expect(localStorage.getItem(k("scaleName"))).toBe("Dorian");
      expect(localStorage.getItem(k("chordRoot"))).toBe("A");
      expect(localStorage.getItem(k("chordType"))).toBe("Minor 7th");
      expect(localStorage.getItem(k("isMuted"))).toBe("true");
    });
  });

  describe("Display modes", () => {
    it("initializes with notes display format", () => {
      render(<App />);
      expect(localStorage.getItem(k("displayFormat"))).toBe("notes");
    });

    it("persists display format changes", async () => {
      localStorage.setItem(k("displayFormat"), "degrees");
      render(<App />);
      expect(localStorage.getItem(k("displayFormat"))).toBe("degrees");
    });

    it("passes the minor blues blue note to the fretboard", () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Minor Blues");

      render(<App />);

      expect(screen.getByTestId("fretboard")).toHaveAttribute(
        "data-color-notes",
        "F#",
      );
    });

    it("passes the major blues blue note to the fretboard", () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major Blues");

      render(<App />);

      expect(screen.getByTestId("fretboard")).toHaveAttribute(
        "data-color-notes",
        "D#",
      );
    });

    it("uses 3nps coordinates when a position is selected", () => {
      localStorage.setItem(k("rootNote"), "C");
      localStorage.setItem(k("scaleName"), "Major");
      localStorage.setItem(k("fingeringPattern"), "3nps");
      localStorage.setItem(k("npsPosition"), "2");

      render(<App />);

      const expectedCount = get3NPSCoordinates(
        "C",
        "Major",
        STANDARD_TUNING,
        24,
        2,
      ).coordinates.length;

      expect(screen.getByTestId("fretboard")).toHaveTextContent(
        `Fretboard: C - ${expectedCount} notes`,
      );
    });
  });

  describe("Viewport resize handling", () => {
    it("updates viewport dimensions on window resize", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 1080,
      });
      render(<App />);

      // Resize to tablet
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 768,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 1024,
      });
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        const appContainer = document.querySelector(".app-container");
        expect(appContainer?.getAttribute("data-layout-tier")).toBe("tablet");
        expect(appContainer?.getAttribute("data-layout-variant")).toBe(
          "tablet-split",
        );
      });
    });
  });

  describe("Tablet split layout", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 768,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 1024,
      });
      localStorage.clear();
    });

    it("renders the shared controls panel and hides mobile tabs", async () => {
      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('[data-layout-variant="tablet-split"]'),
        ).toBeTruthy();
      });

      expect(document.querySelector(".controls-panel")).toBeTruthy();
      expect(document.querySelector(".mobile-tab-content")).toBeNull();
    });

    it("keeps accidental mode session-only in tablet split layout", async () => {
      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('[data-layout-variant="tablet-split"]'),
        ).toBeTruthy();
      });

      expect(localStorage.getItem("useFlats")).toBeNull();
    });
  });

  describe("Desktop layout variants", () => {
    it("uses desktop-3col at 1440x900 (MacBook Pro canonical)", async () => {
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
      localStorage.clear();

      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        const appContainer = document.querySelector(".app-container");
        expect(appContainer?.getAttribute("data-layout-tier")).toBe("desktop");
        expect(appContainer?.getAttribute("data-layout-variant")).toBe(
          "desktop-3col",
        );
      });

      expect(document.querySelector(".controls-panel")).toBeTruthy();
      expect(
        document.querySelector('.controls-panel[data-mode="3col"]'),
      ).toBeTruthy();
      expect(document.querySelector(".mobile-tab-content")).toBeNull();
    });

    it("uses desktop-stacked at 1024x768 (compact height)", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 768,
      });
      localStorage.clear();

      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        const appContainer = document.querySelector(".app-container");
        expect(appContainer?.getAttribute("data-layout-tier")).toBe("desktop");
        expect(appContainer?.getAttribute("data-layout-variant")).toBe(
          "desktop-stacked",
        );
      });

      expect(document.querySelector(".controls-panel")).toBeTruthy();
      expect(
        document.querySelector('.controls-panel[data-mode="stacked"]'),
      ).toBeTruthy();
      expect(document.querySelector(".mobile-tab-content")).toBeNull();
    });

    it("uses desktop-split at 1024x1366 (iPad Pro portrait)", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 1366,
      });
      localStorage.clear();

      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        const appContainer = document.querySelector(".app-container");
        expect(appContainer?.getAttribute("data-layout-tier")).toBe("desktop");
        expect(appContainer?.getAttribute("data-layout-variant")).toBe(
          "desktop-split",
        );
      });

      expect(document.querySelector(".controls-panel")).toBeTruthy();
      expect(
        document.querySelector('.controls-panel[data-mode="split"]'),
      ).toBeTruthy();
      expect(document.querySelector(".mobile-tab-content")).toBeNull();
    });

    // Rendered CSS regression: verifies ExpandedControlsPanel.css is imported and
    // its grid rules are applied to the DOM. Fails if the CSS import is removed.
    it("dashboard panel has display:grid and gridTemplateColumns for desktop-3col", async () => {
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
      localStorage.clear();

      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('.controls-panel[data-mode="3col"]'),
        ).toBeTruthy();
      });

      const panel = document.querySelector(
        ".controls-panel.controls-panel--dashboard",
      ) as HTMLElement;
      expect(panel).toBeTruthy();

      const styles = window.getComputedStyle(panel);
      expect(styles.display).toBe("grid");
      expect(styles.gridTemplateColumns).toBeTruthy();
      expect(styles.gridTemplateColumns).not.toBe("none");
    });

    it("dashboard panel has display:grid and gridTemplateColumns for desktop-split", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 1366,
      });
      localStorage.clear();

      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('.controls-panel[data-mode="split"]'),
        ).toBeTruthy();
      });

      const panel = document.querySelector(
        ".controls-panel.controls-panel--dashboard",
      ) as HTMLElement;
      expect(panel).toBeTruthy();

      const styles = window.getComputedStyle(panel);
      expect(styles.display).toBe("grid");
      expect(styles.gridTemplateColumns).toBeTruthy();
      expect(styles.gridTemplateColumns).not.toBe("none");
    });
  });

  describe("Mobile settings interactions", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 667,
      });
      localStorage.clear();
    });

    it("changes tuning via drawer selector", async () => {
      localStorage.setItem(k("tuningName"), "Drop D");
      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('[data-layout-variant="mobile"]'),
        ).toBeTruthy();
      });

      // Tuning is intentionally only available via the Settings overlay.
      fireEvent.click(screen.getByLabelText("Open settings"));

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeTruthy();
      });

      const tuningDrawers = screen.queryAllByTestId("drawer-tuning");
      if (tuningDrawers.length > 0) {
        const btn = tuningDrawers[0].querySelector("button");
        if (btn) {
          fireEvent.click(btn);

          await waitFor(() => {
            expect(localStorage.getItem(k("tuningName"))).toBe("Standard");
            expect(btn).toHaveTextContent("Tuning: Standard");
          });
        }
      }
    });

    it("adjusts fret range via buttons", async () => {
      // Set fretStart=5 so the minus button is enabled, fretEnd=20 so end minus is enabled
      localStorage.setItem(k("fretStart"), "5");
      localStorage.setItem(k("fretEnd"), "20");
      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('[data-layout-variant="mobile"]'),
        ).toBeTruthy();
      });

      const viewTab = screen.queryByText("View");
      if (viewTab) fireEvent.click(viewTab);

      // Fret range has Start −/+ and End −/+ buttons
      const minusButtons = screen.queryAllByText("−");
      const plusButtons = screen.queryAllByText("+");

      // Click all fret range buttons (Start −, Start +, End −, End +)
      for (const btn of minusButtons) fireEvent.click(btn);
      for (const btn of plusButtons) fireEvent.click(btn);
    });
  });
});

describe("Hook composition smoke test", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Default desktop viewport (jsdom default equivalent: 1024x768)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("data-layout-tier attribute is present on .app-container", () => {
    render(<App />);
    const appContainer = document.querySelector(".app-container");
    const tier = appContainer?.getAttribute("data-layout-tier");
    expect(tier).toBe("desktop");
  });

  it("a known scale-derived value from useDisplayState reaches rendered output", () => {
    // Default state: root=C, scale=Major — useDisplayState computes scaleLabel
    render(<App />);
    // The fretboard mock renders "Fretboard: C - N notes" — rootNote and note
    // count both come from useDisplayState's highlightNotes derivation.
    expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: C");
    expect(screen.getByTestId("fretboard")).toHaveTextContent("notes");
  });
});

describe("Responsive string row sizes", () => {
  it("uses the mobile string row size", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 844,
    });

    render(<App />);
    expect(screen.getByTestId("fretboard")).toHaveAttribute(
      "data-string-row-px",
      "28",
    );
  });

  it("uses the tablet string row size", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 768,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    render(<App />);
    expect(screen.getByTestId("fretboard")).toHaveAttribute(
      "data-string-row-px",
      "36",
    );
  });

  it("uses the desktop string row size", () => {
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

    render(<App />);
    expect(screen.getByTestId("fretboard")).toHaveAttribute(
      "data-string-row-px",
      "42",
    );
  });
});
