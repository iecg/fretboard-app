// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { progressionTempoBpmAtom } from "../store/progressionAtoms";
import { useFretboardTopologyModel } from "./useFretboardTopologyModel";

describe("useFretboardTopologyModel", () => {
  it("does not rerender when only tempo changes", () => {
    const store = createStore();
    const renders: number[] = [];

    function Probe() {
      useFretboardTopologyModel();
      // Effect-time counter keeps the component pure (React Compiler safe)
      // while still observing one increment per committed render.
      useEffect(() => {
        renders.push(1);
      });
      return null;
    }

    render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );

    const baseline = renders.length;

    act(() => {
      store.set(progressionTempoBpmAtom, 180);
    });

    expect(renders.length).toBe(baseline);
  });
});
