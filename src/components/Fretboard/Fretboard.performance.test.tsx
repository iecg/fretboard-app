// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "./Fretboard";
import { fingeringPatternAtom, cagedShapesAtom } from "../../store/fingeringAtoms";
import { fretZoomAtom } from "../../store/layoutAtoms";
// Prime the lazy chunk so React.lazy() resolves on first microtask in jsdom.
import "../FretboardSVG/FretboardSVG";

async function flushSuspense() {
  await act(async () => {
    await Promise.resolve();
  });
}

const received: Array<Record<string, unknown>> = [];

vi.mock("../FretboardSVG/FretboardSVG", () => ({
  FretboardSVG: (props: Record<string, unknown>) => {
    received.push(props);
    return <div data-testid="fretboard-svg-probe" />;
  },
}));

describe("Fretboard performance wiring", () => {
  beforeEach(() => {
    // atomWithStorage persists to localStorage; clear between tests so each
    // test starts from the atom's coded default, making zoom-change assertions
    // reliable regardless of execution order.
    localStorage.clear();
    received.length = 0;
  });

  it("reuses expensive derived props when zoom changes", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <Fretboard stringRowPx={40} />
      </Provider>,
    );
    await flushSuspense();

    const first = received.at(-1)!;

    act(() => {
      store.set(fretZoomAtom, 150);
    });

    const second = received.at(-1)!;

    expect(second !== first).toBe(true);
    expect(second.fretboardLayout).toBe(first.fretboardLayout);
    expect(second.fullChordPositionKeys).toBe(first.fullChordPositionKeys);
    expect(second.fullChordVoicings).toBe(first.fullChordVoicings);
  });

  it("reuses expensive derived props when zoom changes in CAGED mode", async () => {
    const store = createStore();

    // Seed CAGED mode with a non-empty shape selection so the
    // selectFullChordMatchesForCagedPosition code-path executes.
    store.set(fingeringPatternAtom, "caged");
    store.set(cagedShapesAtom, new Set(["C" as import("@fretflow/core").CagedShape]));

    render(
      <Provider store={store}>
        <Fretboard stringRowPx={40} />
      </Provider>,
    );
    await flushSuspense();

    const first = received.at(-1)!;

    act(() => {
      store.set(fretZoomAtom, 150);
    });

    const second = received.at(-1)!;

    expect(second !== first).toBe(true);
    expect(second.fretboardLayout).toBe(first.fretboardLayout);
    expect(second.fullChordPositionKeys).toBe(first.fullChordPositionKeys);
    expect(second.fullChordVoicings).toBe(first.fullChordVoicings);
  });

  it("still reuses expensive derived props when zoom changes after width fallback", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <Fretboard stringRowPx={40} />
      </Provider>,
    );
    await flushSuspense();

    const first = received.at(-1)!;

    act(() => {
      store.set(fretZoomAtom, 150);
    });

    const second = received.at(-1)!;
    expect(second.fretboardLayout).toBe(first.fretboardLayout);
    expect(second.fullChordVoicings).toBe(first.fullChordVoicings);
  });

  it("ignores redundant ResizeObserver width entries", async () => {
    const callbacks: ResizeObserverCallback[] = [];
    class ResizeObserverMock {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const store = createStore();
    render(
      <Provider store={store}>
        <Fretboard stringRowPx={40} />
      </Provider>,
    );
    await flushSuspense();

    const before = received.length;

    await act(async () => {
      callbacks[0]?.([{ contentRect: { width: 320 } } as ResizeObserverEntry], {} as ResizeObserver);
      callbacks[0]?.([{ contentRect: { width: 320 } } as ResizeObserverEntry], {} as ResizeObserver);
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(undefined)),
      );
    });

    expect(received.length).toBe(before + 1);
  });
});
