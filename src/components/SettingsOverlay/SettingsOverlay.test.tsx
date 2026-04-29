// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import SettingsOverlay from "./SettingsOverlay";
import { synth } from "../../core/audio";
import { settingsOverlayOpenAtom, fretZoomAtom, themeAtom, compactDensityAtom } from "../../store/atoms";
import styles from "./SettingsOverlay.module.css";

// Mock the audio synth singleton — we only care that setMute is called on reset.
vi.mock("../../core/audio", () => ({
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

describe("SettingsOverlay/SettingsOverlay", () => {
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
      "Appearance",
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
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByRole("button", { name: /light/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /dark/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /system/i })).toBeTruthy();
    expect(screen.getByText("Chord Spread")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset all settings" })).toBeTruthy();
  });

  it("changes theme when theme buttons are clicked", () => {
    const { store } = renderOpenOverlay();
    
    const lightButton = screen.getByRole("button", { name: /light/i });
    fireEvent.click(lightButton);
    expect(store.get(themeAtom)).toBe("light");

    const darkButton = screen.getByRole("button", { name: /dark/i });
    fireEvent.click(darkButton);
    expect(store.get(themeAtom)).toBe("dark");

    const systemButton = screen.getByRole("button", { name: /system/i });
    fireEvent.click(systemButton);
    expect(store.get(themeAtom)).toBe("system");
  });

  it("renders inline hint text for the less-obvious settings and omits it for the rest", () => {
    renderOpenOverlay();

    // Fields with hint copy show their help text inline (no toggle button).
    expect(
      screen.getByText(
        "Limits how far the visible chord tones can span across frets on the fretboard.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Auto chooses sharps or flats based on the current musical context.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Controls whether equivalent note spellings appear when they clarify the theory view.",
      ),
    ).toBeTruthy();

    // Fields without help copy stay quiet, and no field renders a help-toggle button.
    expect(screen.queryByLabelText(/Show help for /)).toBeNull();
    expect(screen.queryByLabelText(/Hide help for /)).toBeNull();
  });

  it("escape closes the drawer when no popover is open", () => {
    const { store } = renderOpenOverlay();

    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("marks the drawer with the correct layout-tier on mobile", () => {
    setViewport(390, 844);
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);

    const drawer = document.querySelector(".settings-overlay-drawer");
    expect(drawer?.getAttribute("data-layout-tier")).toBe("mobile");
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
    expect(closeBtn).toHaveClass(styles["settings-overlay-close"]);
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

  it("renders compact toggle on desktop viewport", () => {
    setViewport(1440, 900);
    renderOpenOverlay();
    expect(screen.getByText("Compact Controls")).toBeTruthy();
    const compactGroup = screen.getByRole("group", { name: "Compact controls" });
    expect(compactGroup).toBeTruthy();
    expect(compactGroup.querySelector('[aria-pressed]')).toBeTruthy();
  });

  it("renders compact toggle on mobile viewport", () => {
    setViewport(390, 844);
    const store = createStore();
    store.set(settingsOverlayOpenAtom, true);
    renderOverlay(store);
    expect(screen.getByText("Compact Controls")).toBeTruthy();
    const compactGroup = screen.getByRole("group", { name: "Compact controls" });
    expect(compactGroup).toBeTruthy();
  });

  it("clicking On sets compactDensityAtom to 'on'", () => {
    setViewport(1440, 900);
    const { store } = renderOpenOverlay();
    const compactGroup = screen.getByRole("group", { name: "Compact controls" });
    const onBtn = within(compactGroup).getByRole("button", { name: "On" });
    fireEvent.click(onBtn);
    expect(store.get(compactDensityAtom)).toBe("on");
  });

  it("clicking Off sets compactDensityAtom to 'off'", () => {
    setViewport(1440, 900);
    const { store } = renderOpenOverlay();
    act(() => {
      store.set(compactDensityAtom, "on");
    });
    const compactGroup = screen.getByRole("group", { name: "Compact controls" });
    const offBtn = within(compactGroup).getByRole("button", { name: "Off" });
    fireEvent.click(offBtn);
    expect(store.get(compactDensityAtom)).toBe("off");
  });

  it("clicking Auto sets compactDensityAtom to 'auto'", () => {
    setViewport(1440, 900);
    const { store } = renderOpenOverlay();
    act(() => {
      store.set(compactDensityAtom, "on");
    });
    const compactGroup = screen.getByRole("group", { name: "Compact controls" });
    const autoBtn = within(compactGroup).getByRole("button", { name: "Auto" });
    fireEvent.click(autoBtn);
    expect(store.get(compactDensityAtom)).toBe("auto");
  });

  it("traps focus when tabbing forward from the last control", () => {
    renderOpenOverlay();

    const closeButton = screen.getByLabelText("Close settings");
    // Ko-fi link is now the last focusable element (after VersionBadge moved into the overlay)
    const kofiLink = screen.getByTitle("Support FretFlow on Ko-fi");

    kofiLink.focus();
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("keeps focus trapping intact when inline help text is rendered", () => {
    renderOpenOverlay();

    // Inline hint text is non-focusable, so trapping should behave the same.
    const closeButton = screen.getByLabelText("Close settings");
    // Ko-fi link is now the last focusable element (after VersionBadge moved into the overlay)
    const kofiLink = screen.getByTitle("Support FretFlow on Ko-fi");

    kofiLink.focus();
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("traps focus when shift-tabbing backward from the first control", () => {
    renderOpenOverlay();

    const closeButton = screen.getByLabelText("Close settings");
    // Ko-fi link is now the last focusable element (after VersionBadge moved into the overlay)
    const kofiLink = screen.getByTitle("Support FretFlow on Ko-fi");

    closeButton.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(kofiLink);
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
