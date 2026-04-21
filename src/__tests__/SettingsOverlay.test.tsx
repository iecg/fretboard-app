// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import SettingsOverlay from "../components/SettingsOverlay";
import { synth } from "../core/audio";
import { settingsOverlayOpenAtom, fretZoomAtom } from "../store/atoms";

// Mock the audio synth singleton — we only care that setMute is called on reset.
vi.mock("../core/audio", () => ({
  synth: {
    setMute: vi.fn(),
    init: vi.fn(),
    playNote: vi.fn(),
  },
}));

function renderOverlay(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <SettingsOverlay />
    </Provider>,
  );
}

function renderOpenOverlay() {
  const store = createStore();
  store.set(settingsOverlayOpenAtom, true);
  return {
    store,
    ...renderOverlay(store),
  };
}

function setViewport(width: number, height: number) {
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
}

describe("SettingsOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Desktop default viewport — keeps layout tier stable for open/close tests.
    setViewport(1440, 900);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders no visible drawer when closed", () => {
    const store = createStore();
    renderOverlay(store);
    const drawer = document.querySelector(".settings-overlay-drawer");
    expect(drawer).toBeNull();
  });

  it("renders drawer with Settings heading when open", () => {
    renderOpenOverlay();
    const drawer = document.querySelector(".settings-overlay-drawer");
    expect(drawer).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders sections in the expected order", () => {
    renderOpenOverlay();

    const headings = Array.from(
      document.querySelectorAll(".overlay-section-title"),
    ).map((node) => node.textContent?.trim());

    expect(headings).toEqual([
      "View",
      "Instrument",
      "Notation",
      "Chord Layout",
      "Reset",
    ]);
  });

  it("renders all settings controls in the redesigned drawer", () => {
    renderOpenOverlay();

    expect(screen.getByText("Zoom")).toBeTruthy();
    expect(screen.getByText("Fret Range")).toBeTruthy();
    expect(screen.getAllByText("Tuning")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Tuning" })).toBeTruthy();
    expect(screen.getByText("Accidentals")).toBeTruthy();
    expect(screen.getByText("Enharmonic Display")).toBeTruthy();
    expect(screen.getByText("Chord Spread")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset all settings" })).toBeTruthy();
  });

  it("shows help buttons only for the less-obvious settings", () => {
    renderOpenOverlay();

    expect(screen.getByLabelText("Show help for Chord Spread")).toBeTruthy();
    expect(screen.getByLabelText("Show help for Accidentals")).toBeTruthy();
    expect(screen.getByLabelText("Show help for Enharmonic Display")).toBeTruthy();
    expect(screen.queryByLabelText("Show help for Zoom")).toBeNull();
    expect(screen.queryByLabelText("Show help for Fret Range")).toBeNull();
    expect(screen.queryByLabelText("Show help for Tuning")).toBeNull();
  });

  it("toggles help popovers on click and keeps only one open at a time", () => {
    renderOpenOverlay();

    fireEvent.click(screen.getByLabelText("Show help for Chord Spread"));
    expect(
      screen.getByText(
        "Limits how far the visible chord tones can span across frets on the fretboard.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Show help for Accidentals"));
    expect(
      screen.queryByText(
        "Limits how far the visible chord tones can span across frets on the fretboard.",
      ),
    ).toBeNull();
    expect(
      screen.getByText(
        "Auto chooses sharps or flats based on the current musical context.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Hide help for Accidentals"));
    expect(
      screen.queryByText(
        "Auto chooses sharps or flats based on the current musical context.",
      ),
    ).toBeNull();
  });

  it("closes a help popover on escape before closing the drawer", () => {
    const { store } = renderOpenOverlay();

    fireEvent.click(screen.getByLabelText("Show help for Enharmonic Display"));
    expect(
      screen.getByText(
        "Controls whether equivalent note spellings appear when they clarify the theory view.",
      ),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByText(
        "Controls whether equivalent note spellings appear when they clarify the theory view.",
      ),
    ).toBeNull();
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("closes an open help popover when clicking outside it", () => {
    renderOpenOverlay();

    fireEvent.click(screen.getByLabelText("Show help for Chord Spread"));
    expect(
      screen.getByText(
        "Limits how far the visible chord tones can span across frets on the fretboard.",
      ),
    ).toBeTruthy();

    fireEvent.mouseDown(screen.getByText("Notation"));
    expect(
      screen.queryByText(
        "Limits how far the visible chord tones can span across frets on the fretboard.",
      ),
    ).toBeNull();
  });

  it("marks the drawer with the correct layout-tier on mobile", () => {
    setViewport(390, 844);
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);

    const drawer = document.querySelector(".settings-overlay-drawer");
    expect(drawer?.getAttribute("data-layout-tier")).toBe("mobile");
  });

  it("closes overlay when ESC is pressed with no help popover open", () => {
    const { store } = renderOpenOverlay();
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("closes overlay when backdrop is clicked", () => {
    const { store } = renderOpenOverlay();
    const backdrop = document.querySelector(".settings-overlay-backdrop");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("closes overlay when X button is clicked", () => {
    const { store } = renderOpenOverlay();
    const closeBtn = screen.getByLabelText("Close settings");
    fireEvent.click(closeBtn);
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("stays open when resized within the same layout tier", () => {
    const { store } = renderOpenOverlay();

    setViewport(1280, 900);
    fireEvent(window, new Event("resize"));

    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
  });

  it("closes when resized across layout tiers", () => {
    const { store } = renderOpenOverlay();

    setViewport(390, 844);
    fireEvent(window, new Event("resize"));

    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("reset two-step flow: first click arms confirmation, second click resets and closes", () => {
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    // Dirty an atom so we can prove reset restored the default.
    store.set(fretZoomAtom, 200);
    renderOverlay(store);

    const btn = screen.getByText("Reset all settings");
    fireEvent.click(btn);

    // Button text changes to the confirmation prompt.
    expect(screen.getByText("Click again to confirm")).toBeTruthy();
    // Overlay is still open, zoom has not been reset yet.
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
    expect(store.get(fretZoomAtom)).toBe(200);

    // Second click executes reset.
    fireEvent.click(screen.getByText("Click again to confirm"));

    // Zoom back to default (100) and overlay closed.
    expect(store.get(fretZoomAtom)).toBe(100);
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
    expect(synth.setMute).toHaveBeenCalledWith(false);
  });

  it("reset confirmation auto-cancels after 3 seconds", () => {
    vi.useFakeTimers();
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    store.set(fretZoomAtom, 200);
    renderOverlay(store);

    fireEvent.click(screen.getByText("Reset all settings"));
    expect(screen.getByText("Click again to confirm")).toBeTruthy();

    // Advance past the 3 second timeout.
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // Button text reverts and no reset happened.
    expect(screen.getByText("Reset all settings")).toBeTruthy();
    expect(store.get(fretZoomAtom)).toBe(200);
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
  });

  it("traps focus when tabbing forward from the last control", () => {
    renderOpenOverlay();

    const closeButton = screen.getByLabelText("Close settings");
    const resetButton = screen.getByRole("button", {
      name: "Reset all settings",
    });

    resetButton.focus();
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("keeps focus trapping intact when a help popover is open", () => {
    renderOpenOverlay();

    fireEvent.click(screen.getByLabelText("Show help for Chord Spread"));
    const closeButton = screen.getByLabelText("Close settings");
    const resetButton = screen.getByRole("button", {
      name: "Reset all settings",
    });

    resetButton.focus();
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("traps focus when shift-tabbing backward from the first control", () => {
    renderOpenOverlay();

    const closeButton = screen.getByLabelText("Close settings");
    const resetButton = screen.getByRole("button", {
      name: "Reset all settings",
    });

    closeButton.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(resetButton);
  });

  it("restores focus to the trigger when the overlay closes", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <button type="button">Settings trigger</button>
        <SettingsOverlay />
      </Provider>,
    );

    const trigger = screen.getByRole("button", { name: "Settings trigger" });
    trigger.focus();

    act(() => {
      store.set(settingsOverlayOpenAtom, true);
    });

    const closeButton = screen.getByLabelText("Close settings");
    fireEvent.click(closeButton);

    expect(document.activeElement).toBe(trigger);
  });
});
