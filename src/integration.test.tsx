// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { k } from "./test-utils/storage";
// Pre-import lazy-loaded components so React.lazy() resolves from the module
// cache synchronously, allowing Suspense to mount them without async delay.
import "./components/Inspector/Inspector";

const mockSynth = vi.hoisted(() => ({
  playNote: vi.fn(),
  setMute: vi.fn(),
  init: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("./core/audio", () => ({ synth: mockSynth }));

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

  it("clicking a real fretboard note button invokes synth.playNote", async () => {
    localStorage.setItem(k("isMuted"), "false");
    render(<App />);

    const allButtons = await screen.findAllByRole("button");
    const noteButtons = allButtons.filter((btn) =>
      btn.getAttribute("aria-label")?.includes("on string"),
    );
    expect(noteButtons.length).toBeGreaterThan(0);

    fireEvent.click(noteButtons[0]);
    expect(mockSynth.playNote).toHaveBeenCalledTimes(1);
    expect(mockSynth.playNote).toHaveBeenCalledWith(expect.any(Number));
  });

  it("changing accidental mode in Settings re-renders the scale label without persisting", async () => {
    localStorage.setItem(k("rootNote"), "A#");
    localStorage.setItem(k("scaleName"), "Major");
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
