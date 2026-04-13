// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import SettingsOverlay from "../components/SettingsOverlay";
import { synth } from "../audio";
import { settingsOverlayOpenAtom, fretZoomAtom } from "../store/atoms";

// Mock the audio synth singleton — we only care that setMute is called on reset.
vi.mock("../audio", () => ({
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

describe("SettingsOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Desktop default viewport — keeps layout tier stable for open/close tests.
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
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);
    const drawer = document.querySelector(".settings-overlay-drawer");
    expect(drawer).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("closes overlay when ESC is pressed", () => {
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("closes overlay when backdrop is clicked", () => {
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);
    const backdrop = document.querySelector(".settings-overlay-backdrop");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("closes overlay when X button is clicked", () => {
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);
    const closeBtn = screen.getByLabelText("Close settings");
    fireEvent.click(closeBtn);
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("reset two-step flow: first click arms confirmation, second click resets and closes", () => {
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    // Dirty an atom so we can prove reset restored the default.
    store.set(fretZoomAtom, 250);
    renderOverlay(store);

    const btn = screen.getByText("Reset all settings");
    fireEvent.click(btn);

    // Button text changes to the confirmation prompt.
    expect(screen.getByText("Click again to confirm")).toBeTruthy();
    // Overlay is still open, zoom has not been reset yet.
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
    expect(store.get(fretZoomAtom)).toBe(250);

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
    store.set(fretZoomAtom, 250);
    renderOverlay(store);

    fireEvent.click(screen.getByText("Reset all settings"));
    expect(screen.getByText("Click again to confirm")).toBeTruthy();

    // Advance past the 3 second timeout.
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // Button text reverts and no reset happened.
    expect(screen.getByText("Reset all settings")).toBeTruthy();
    expect(store.get(fretZoomAtom)).toBe(250);
    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
  });
});
