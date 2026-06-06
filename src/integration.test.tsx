// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { playGuitarNote } from "./core/lazyGuitarAudio";
import { k } from "./test-utils/storage";
// Pre-import lazy-loaded components so React.lazy() resolves from the module
// cache synchronously, allowing Suspense to mount them without async delay.
import "./components/Inspector/Inspector";
import "./components/StatusBar/StatusBar";
import "./components/FretboardSVG/FretboardSVG";

const lazyAudio = vi.hoisted(() => ({
  playGuitarNote: vi.fn(),
  setGuitarMutePreference: vi.fn(),
  setGuitarAudioErrorHandler: vi.fn(),
  resumeGuitarAudio: vi.fn(),
  prefetchAudioModule: vi.fn(),
}));

vi.mock("./core/lazyGuitarAudio", () => lazyAudio);

// Cross-cutting integration tests that App.test.tsx cannot prove because it
// mocks the Fretboard. Persistence round-trips for individual atoms are
// covered in src/store/atoms.test.ts.
describe("Integration: real-component user workflows", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1920 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 1200 });
  });
  afterEach(() => localStorage.clear());

  it("clicking a real fretboard note button invokes lazy audio playback", async () => {
    localStorage.setItem(k("isMuted"), "false");
    render(<App />);

    // Wait until the lazy FretboardSVG resolves and renders note buttons (aria-label
     // contains "on string"). Suspense fallback may already expose other buttons, so
     // we explicitly poll for a note button before asserting.
    await waitFor(() => {
      const buttons = screen.queryAllByRole("button");
      const notes = buttons.filter((btn) =>
        btn.getAttribute("aria-label")?.includes("on string"),
      );
      expect(notes.length).toBeGreaterThan(0);
    });
    const allButtons = screen.getAllByRole("button");
    const noteButtons = allButtons.filter((btn) =>
      btn.getAttribute("aria-label")?.includes("on string"),
    );

    fireEvent.click(noteButtons[0]);
    expect(playGuitarNote).toHaveBeenCalledTimes(1);
    expect(playGuitarNote).toHaveBeenCalledWith(expect.any(Number));
  });

  it("changing accidental mode in Settings re-renders the scale label without persisting", async () => {
    localStorage.setItem(k("rootNote"), "A#");
    localStorage.setItem(k("scaleName.v2"), "major");
    render(<App />);

    // Initial render: flats spelling for A# Major.
    expect(screen.getAllByText("B♭ Major (Ionian)").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("Open settings"));
    await screen.findByText("Accidentals");
    fireEvent.click(screen.getByRole("button", { name: "♯" }));

    await waitFor(() => {
      expect(screen.getAllByText("A♯ Major (Ionian)").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("B♭ Major (Ionian)")).toHaveLength(0);
    });
    // Session-only invariant: no leakage to localStorage.
    expect(localStorage.getItem("preferFlats")).toBeNull();
    expect(localStorage.getItem("accidentalMode")).toBeNull();
  });
});
