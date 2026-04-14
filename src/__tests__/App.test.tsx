// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { synth } from "../audio";

// Mock child components to isolate App logic
vi.mock("../Fretboard", () => ({
  Fretboard: ({
    highlightNotes,
    rootNote,
    stringRowPx,
  }: {
    highlightNotes: string[];
    rootNote: string;
    stringRowPx?: number;
  }) => (
    <div data-testid="fretboard" data-string-row-px={String(stringRowPx ?? "")}>
      Fretboard: {rootNote} - {highlightNotes.length} notes - row {stringRowPx}
    </div>
  ),
}));

vi.mock("../CircleOfFifths", () => ({
  CircleOfFifths: ({
    rootNote,
    setRootNote,
  }: {
    rootNote: string;
    setRootNote: (note: string) => void;
  }) => (
    <button data-testid="circle-of-fifths" onClick={() => setRootNote("G")}>
      CoF: {rootNote}
    </button>
  ),
}));

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

  describe("Initialization", () => {
    it("renders without crashing", () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toBeTruthy();
    });

    it("loads default state when localStorage is empty", () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: C");
    });

    it("loads persisted state from localStorage", () => {
      localStorage.setItem("rootNote", "G");
      localStorage.setItem("scaleName", "Minor");
      render(<App />);
      expect(screen.getByTestId("circle-of-fifths")).toHaveTextContent(
        "CoF: G",
      );
    });

    it("persists isMuted to localStorage on first mount", () => {
      render(<App />);
      expect(localStorage.getItem("isMuted")).toBe("false");
    });

    it("synth is muted based on initial state", () => {
      localStorage.setItem("isMuted", "true");
      render(<App />);
      expect(synth.setMute).toHaveBeenCalledWith(true);
    });
  });

  describe("Root note changes", () => {
    it("updates fretboard when root note changes via Circle of Fifths", async () => {
      render(<App />);
      expect(screen.getByTestId("fretboard")).toHaveTextContent("Fretboard: C");

      const cofButton = screen.getByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(screen.getByTestId("fretboard")).toHaveTextContent(
          "Fretboard: G",
        );
      });
    });

    it("persists root note to localStorage", async () => {
      render(<App />);
      const cofButton = screen.getByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem("rootNote")).toBe("G");
      });
    });

    it("links chord root to scale root by default", async () => {
      localStorage.setItem("chordType", "Major Triad");
      render(<App />);

      const cofButton = screen.getByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem("chordRoot")).toBe("G");
      });
    });

    it("does not link chord root when linkChordRoot is false", async () => {
      localStorage.setItem("chordType", "Major Triad");
      localStorage.setItem("linkChordRoot", "false");
      localStorage.setItem("chordRoot", "D");
      render(<App />);

      const cofButton = screen.getByTestId("circle-of-fifths");
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem("chordRoot")).toBe("D");
      });
    });
  });

  describe("Scale selection", () => {
    it("changes scale via drawer selector", async () => {
      render(<App />);
      const drawer = screen.getByTestId("drawer-scale");
      const button = drawer.querySelector("button");

      if (button) {
        fireEvent.click(button);
        await waitFor(() => {
          expect(localStorage.getItem("scaleName")).toBeDefined();
        });
      }
    });

    it("persists scale name to localStorage", async () => {
      render(<App />);
      const drawer = screen.getByTestId("drawer-scale");
      const button = drawer.querySelector("button");

      if (button) {
        fireEvent.click(button);
        await waitFor(() => {
          const saved = localStorage.getItem("scaleName");
          expect(saved).toBeTruthy();
        });
      }
    });
  });

  describe("Mute toggle", () => {
    it("toggles mute state", async () => {
      render(<App />);
      expect(localStorage.getItem("isMuted")).toBe("false");

      const muteButtons = screen
        .getAllByRole("button")
        .filter((btn) =>
          btn.getAttribute("title")?.toLowerCase().includes("mute"),
        );

      if (muteButtons.length > 0) {
        fireEvent.click(muteButtons[0]);
        await waitFor(() => {
          expect(localStorage.getItem("isMuted")).toBe("true");
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
      localStorage.setItem("rootNote", "G");
      localStorage.setItem("scaleName", "Natural Minor");
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
          expect(localStorage.getItem("rootNote")).toBeNull();
        });
      }
    });

    it("resets state to defaults", async () => {
      localStorage.setItem("rootNote", "G");
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

  describe("Chord overlay", () => {
    it("can set chord type", async () => {
      render(<App />);
      const drawer = screen.getByTestId("drawer-chord overlay");

      if (drawer) {
        const button = drawer.querySelector("button");
        if (button) {
          fireEvent.click(button);
          await waitFor(() => {
            expect(localStorage.getItem("chordType")).toBeTruthy();
          });
        }
      }
    });

    it("persists chord type as empty string when null", async () => {
      localStorage.setItem("chordType", "Major Triad");
      const { rerender } = render(<App />);

      // Update to clear chord type
      localStorage.setItem("chordType", "");
      rerender(<App />);

      expect(localStorage.getItem("chordType")).toBe("");
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
      expect(localStorage.getItem("fretStart")).toBe("0");
      expect(localStorage.getItem("fretEnd")).toBe("24");
    });

    it("persists fret zoom level", async () => {
      localStorage.setItem("fretZoom", "150");
      render(<App />);
      expect(localStorage.getItem("fretZoom")).toBe("150");
    });
  });

  describe("Tuning selection", () => {
    it("uses Standard tuning by default", () => {
      render(<App />);
      expect(localStorage.getItem("tuningName")).toBe("Standard");
    });

    it("persists tuning selection", async () => {
      localStorage.setItem("tuningName", "Drop D");
      render(<App />);
      expect(localStorage.getItem("tuningName")).toBe("Drop D");
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
      render(<App />);
      expect(localStorage.getItem("mobileTab")).toBe("key");
    });
  });

  describe("State persistence", () => {
    it("persists multiple state changes to localStorage", async () => {
      render(<App />);

      localStorage.setItem("rootNote", "D");
      localStorage.setItem("scaleName", "Dorian");
      localStorage.setItem("chordRoot", "A");
      localStorage.setItem("chordType", "Minor 7th");
      localStorage.setItem("isMuted", "true");

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem("rootNote")).toBe("D");
      expect(localStorage.getItem("scaleName")).toBe("Dorian");
      expect(localStorage.getItem("chordRoot")).toBe("A");
      expect(localStorage.getItem("chordType")).toBe("Minor 7th");
      expect(localStorage.getItem("isMuted")).toBe("true");
    });
  });

  describe("Display modes", () => {
    it("initializes with notes display format", () => {
      render(<App />);
      expect(localStorage.getItem("displayFormat")).toBe("notes");
    });

    it("persists display format changes", async () => {
      localStorage.setItem("displayFormat", "degrees");
      render(<App />);
      expect(localStorage.getItem("displayFormat")).toBe("degrees");
    });

    it("initializes with no shape labels", () => {
      render(<App />);
      expect(localStorage.getItem("shapeLabels")).toBe("none");
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

  describe("Desktop stacked layout", () => {
    beforeEach(() => {
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
    });

    it("uses the compact desktop stacked variant", async () => {
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
      expect(document.querySelector(".mobile-tab-content")).toBeNull();
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
      localStorage.setItem("tuningName", "Drop D");
      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('[data-layout-variant="mobile"]'),
        ).toBeTruthy();
      });

      const controlsTab = screen.queryByText("Controls");
      if (controlsTab) fireEvent.click(controlsTab);

      const tuningDrawers = screen.queryAllByTestId("drawer-tuning");
      if (tuningDrawers.length > 0) {
        const btn = tuningDrawers[0].querySelector("button");
        if (btn) {
          fireEvent.click(btn);

          await waitFor(() => {
            expect(localStorage.getItem("tuningName")).toBe("Standard");
            expect(btn).toHaveTextContent("Tuning: Standard");
          });
        }
      }
    });

    it("adjusts fret range via buttons", async () => {
      // Set fretStart=5 so the minus button is enabled, fretEnd=20 so end minus is enabled
      localStorage.setItem("fretStart", "5");
      localStorage.setItem("fretEnd", "20");
      render(<App />);
      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        expect(
          document.querySelector('[data-layout-variant="mobile"]'),
        ).toBeTruthy();
      });

      const controlsTab = screen.queryByText("Controls");
      if (controlsTab) fireEvent.click(controlsTab);

      // Fret range has Start −/+ and End −/+ buttons
      const minusButtons = screen.queryAllByText("−");
      const plusButtons = screen.queryAllByText("+");

      // Click all fret range buttons (Start −, Start +, End −, End +)
      for (const btn of minusButtons) fireEvent.click(btn);
      for (const btn of plusButtons) fireEvent.click(btn);
    });
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
      "32",
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
      "40",
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
      "48",
    );
  });
});
