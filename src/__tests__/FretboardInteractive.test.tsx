import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import { FretboardInteractive } from "../FretboardInteractive";
import { fretZoomAtom } from "../store/atoms";

const { mockSynth } = vi.hoisted(() => ({
  mockSynth: { playNote: vi.fn(), setMute: vi.fn(), init: vi.fn() },
}));
vi.mock("../audio", () => ({ synth: mockSynth }));

const DEFAULT_PROPS = {
  tuning: ["E4", "B3", "G3", "D3", "A2", "E2"],
  highlightNotes: ["C", "E", "G"],
  rootNote: "C",
  stringRowPx: 40,
};

function renderInteractive(store = createStore(), overrides: Record<string, unknown> = {}) {
  return render(
    <Provider store={store}>
      <FretboardInteractive {...DEFAULT_PROPS} {...overrides} />
    </Provider>
  );
}

/** Render and patch the wrapper so hasOverflow becomes true, enabling drag. */
function renderWithOverflow(store = createStore(), overrides: Record<string, unknown> = {}) {
  const result = renderInteractive(store, overrides);
  const wrapper = result.container.querySelector(".fretboard-wrapper") as HTMLElement;

  // Patch scrollWidth > clientWidth so the overflow useEffect fires with hasOverflow=true
  Object.defineProperty(wrapper, "scrollWidth", { configurable: true, get: () => 2000 });
  Object.defineProperty(wrapper, "clientWidth", { configurable: true, get: () => 400 });
  // jsdom does not implement setPointerCapture; stub it to avoid uncaught exceptions
  (wrapper as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture = vi.fn();

  // Trigger a re-render so the useEffect reads the patched values and sets hasOverflow=true.
  // Must use a zoom value that changes effectiveZoom (autoFitZoom=49 with containerWidth=0,
  // so zoom=200 gives effectiveZoom=round(49*200/100)=98, triggering the overflow effect dep).
  act(() => {
    store.set(fretZoomAtom, 200);
  });
  act(() => {
    store.set(fretZoomAtom, 100);
  });

  return { ...result, wrapper };
}

describe("FretboardInteractive", () => {
  beforeEach(() => {
    mockSynth.playNote.mockClear();
    mockSynth.setMute.mockClear();
    mockSynth.init.mockClear();
  });

  it("fires onFretClick and synth.playNote when a note is clicked without drag", async () => {
    const onFretClick = vi.fn();
    renderInteractive(createStore(), { onFretClick });
    const user = userEvent.setup();
    const activeNote = document.querySelector(
      ".note-bubble.root-active, .note-bubble.note-active, .note-bubble.chord-tone"
    ) as HTMLElement;
    expect(activeNote).toBeTruthy();
    await user.click(activeNote);
    expect(onFretClick).toHaveBeenCalledTimes(1);
    expect(mockSynth.playNote).toHaveBeenCalledTimes(1);
  });

  it("accumulates dragDistance and suppresses click after a drag of > 5px", () => {
    const onFretClick = vi.fn();
    const { wrapper } = renderWithOverflow(createStore(), { onFretClick });

    // Simulate drag: pointerDown + pointerMove with movementX > drag threshold
    fireEvent.pointerDown(wrapper, { pointerId: 1, pageX: 100, buttons: 1 });
    fireEvent.pointerMove(wrapper, { pointerId: 1, pageX: 90, movementX: -10, buttons: 1 });
    fireEvent.pointerMove(wrapper, { pointerId: 1, pageX: 80, movementX: -10, buttons: 1 });
    fireEvent.pointerUp(wrapper, { pointerId: 1 });

    // Click a note bubble — drag-guard (dragDistance.current > 5) should suppress it
    const noteButton = wrapper.querySelector(".note-bubble") as HTMLElement;
    expect(noteButton).toBeTruthy();
    fireEvent.click(noteButton);
    expect(onFretClick).not.toHaveBeenCalled();
  });

  it("re-renders with wider neck when fretZoomAtom increases", () => {
    let roCallback: ResizeObserverCallback | null = null;
    const OriginalRO = globalThis.ResizeObserver;
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        roCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    const store = createStore();
    renderInteractive(store);

    // Fire ResizeObserver with a known container width
    act(() => {
      roCallback?.(
        [{ contentRect: { width: 800 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver
      );
    });

    const neck = document.querySelector(".fretboard-neck") as HTMLElement;
    expect(neck).toBeTruthy();

    const initialWidth = parseInt(neck.style.width, 10);

    // Write a larger zoom value
    act(() => {
      store.set(fretZoomAtom, 150);
    });

    const newWidth = parseInt(neck.style.width, 10);
    // With zoom=150 (50% above auto-fit), neck should be wider
    expect(newWidth).toBeGreaterThan(initialWidth);

    globalThis.ResizeObserver = OriginalRO;
  });
});
