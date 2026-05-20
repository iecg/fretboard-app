// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "./Fretboard";
import { fingeringPatternAtom, cagedShapesAtom } from "../../store/fingeringAtoms";
import { fretZoomAtom } from "../../store/layoutAtoms";

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

  it("reuses expensive derived props when zoom changes", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <Fretboard stringRowPx={40} />
      </Provider>,
    );

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

  it("reuses expensive derived props when zoom changes in CAGED mode", () => {
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
});
