// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "./Fretboard";
import { fretZoomAtom } from "../../store/atoms";

const received: Array<Record<string, unknown>> = [];

vi.mock("../FretboardSVG/FretboardSVG", () => ({
  FretboardSVG: (props: Record<string, unknown>) => {
    received.push(props);
    return <div data-testid="fretboard-svg-probe" />;
  },
}));

describe("Fretboard performance wiring", () => {
  it("reuses expensive derived props when zoom changes", () => {
    received.length = 0;
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

    expect(second.fretboardLayout).toBe(first.fretboardLayout);
    expect(second.fullChordPositionKeys).toBe(first.fullChordPositionKeys);
    expect(second.fullChordVoicings).toBe(first.fullChordVoicings);
  });
});
