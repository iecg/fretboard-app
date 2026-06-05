// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { axe } from "../../test-utils/a11y";
import { renderWithAtoms } from "../../test-utils/renderWithAtoms";
import SettingsOverlay from "./SettingsOverlay";
import { setGuitarMutePreference } from "../../core/lazyGuitarAudio";
import { fretZoomAtom } from "../../store/layoutAtoms";
import { settingsOverlayOpenAtom, themeAtom } from "../../store/uiAtoms";
import styles from "./SettingsOverlay.module.css";

// Mock motion so animations are no-ops in test environment.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIMATION_PROPS = new Set([
    "initial", "animate", "exit", "transition", "variants",
    "whileHover", "whileTap", "whileFocus", "whileDrag", "whileInView",
    "layoutId", "layout", "onAnimationStart", "onAnimationComplete", "onUpdate",
  ]);
  const makeEl = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const { children, ...rest } = props;
      const filtered: Record<string, unknown> = {};
      Object.entries(rest).forEach(([k, v]) => {
        if (!ANIMATION_PROPS.has(k)) filtered[k] = v;
      });
      return React.createElement(tag, { ...filtered, ref }, children as React.ReactNode);
    });
  const cache = new Map<string, unknown>();
  const motionProxy = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (!cache.has(prop)) cache.set(prop, makeEl(prop));
      return cache.get(prop);
    },
  });
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: vi.fn().mockReturnValue(null),
  };
});

// Mock the audio lazy facade — we only care that setMute is called on reset.
vi.mock("../../core/lazyGuitarAudio", () => ({
  setGuitarMutePreference: vi.fn(),
  resumeGuitarAudio: vi.fn(),
  playGuitarNote: vi.fn(),
  setGuitarAudioErrorHandler: vi.fn(),
  prefetchAudioModule: vi.fn(),
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

  it("renders drawer with Settings heading when open", async () => {
    const { container } = renderOpenOverlay();
    const drawer = document.querySelector(".settings-overlay-drawer");
    expect(drawer).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders sections in the expected order", () => {
    renderOpenOverlay();

    const headings = Array.from(
      document.querySelectorAll(".overlay-section-title"),
    ).map((node) => node.textContent?.trim());

    expect(headings).toEqual([
      "Display",
      "Instrument",
      "Language",
      "Appearance",
      "Reset",
    ]);
  });

  it("renders all settings controls in the redesigned drawer", () => {
    renderOpenOverlay();

    expect(screen.getByText("Zoom")).toBeTruthy();
    expect(screen.getByText("Fret Range")).toBeTruthy();
    expect(screen.getAllByText("Tuning")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Tuning" })).toBeTruthy();
    expect(screen.getAllByText("Language").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /english/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /español/i })).toBeTruthy();
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByRole("button", { name: /light/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /dark/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /system/i })).toBeTruthy();
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

    // Fields without help copy stay quiet, and no field renders a help-toggle button.
    expect(screen.queryByLabelText(/Show help for /)).toBeNull();
    expect(screen.queryByLabelText(/Hide help for /)).toBeNull();
  });

  it("escape closes the drawer when no popover is open", () => {
    const { store } = renderOpenOverlay();

    expect(store.get(settingsOverlayOpenAtom)).toBe(true);
    const drawer = screen.getByTestId("settings-drawer");
    fireEvent.keyDown(drawer, { key: "Escape" });
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

  it("closes overlay when backdrop is clicked", async () => {
    const { store } = renderOpenOverlay();
    const backdrop = document.querySelector(".settings-overlay-backdrop");
    expect(backdrop).toBeTruthy();
    // DismissableLayer registers its pointerdown listener via setTimeout(0);
    // wait for the next macrotask so it's in place before we trigger.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    fireEvent.pointerDown(backdrop!);
    expect(store.get(settingsOverlayOpenAtom)).toBe(false);
  });

  it("closes overlay when X button is clicked", () => {
    const { store } = renderOpenOverlay();
    const closeBtn = screen.getByLabelText("Close settings");
    expect(closeBtn).toHaveClass(styles["settings-overlay-close"]);
    expect(closeBtn.className).toMatch(/icon-button--sm/);
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
    expect(setGuitarMutePreference).toHaveBeenCalledWith(false);
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

  it("renders Display section with note-label / accidental / fret-range controls", () => {
    renderWithAtoms(<SettingsOverlay />, [[settingsOverlayOpenAtom, true]]);
    expect(screen.getByRole("region", { name: /display/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note labels/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/accidentals/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/enharmonic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fret range/i)).toBeInTheDocument();
  });

  it("does not render a Compact Controls group", async () => {
    renderWithAtoms(<SettingsOverlay />, [[settingsOverlayOpenAtom, true]]);
    expect(screen.queryByRole("group", { name: /compact controls/i })).toBeNull();
  });

  it("no longer renders the Chord Layout section (Task 11)", () => {
    renderWithAtoms(<SettingsOverlay />, [[settingsOverlayOpenAtom, true]]);
    expect(screen.queryByText(/chord spread/i)).toBeNull();
  });

  it("traps focus when tabbing forward from the last control", () => {
    renderOpenOverlay();

    const closeButton = screen.getByLabelText("Close settings");
    // Ko-fi link is now the last focusable element (after VersionBadge moved into the overlay)
    const kofiLink = screen.getByTitle("Support FretFlow on Ko-fi");

    kofiLink.focus();
    fireEvent.keyDown(kofiLink, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("keeps focus trapping intact when inline help text is rendered", () => {
    renderOpenOverlay();

    // Inline hint text is non-focusable, so trapping should behave the same.
    const closeButton = screen.getByLabelText("Close settings");
    // Ko-fi link is now the last focusable element (after VersionBadge moved into the overlay)
    const kofiLink = screen.getByTitle("Support FretFlow on Ko-fi");

    kofiLink.focus();
    fireEvent.keyDown(kofiLink, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("traps focus when shift-tabbing backward from the first control", () => {
    renderOpenOverlay();

    const closeButton = screen.getByLabelText("Close settings");
    // Ko-fi link is now the last focusable element (after VersionBadge moved into the overlay)
    const kofiLink = screen.getByTitle("Support FretFlow on Ko-fi");

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(kofiLink);
  });
});
