// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FRET_ZOOM_OUT_MIN, FRET_ZOOM_MAX } from "@fretflow/core";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { fretZoomAtom } from "@fretflow/fretboard/store/layoutAtoms";
import { StageZoomControl } from "./StageZoomControl";

describe("StageZoomControl", () => {
  it("steps fretZoom up and down by 10", async () => {
    const store = makeAtomStore([[fretZoomAtom, 100]]);
    renderWithStore(<StageZoomControl />, store);

    await userEvent.click(screen.getByTestId("stage-zoom-in"));
    expect(store.get(fretZoomAtom)).toBe(110);

    await userEvent.click(screen.getByTestId("stage-zoom-out"));
    expect(store.get(fretZoomAtom)).toBe(100);
  });

  it("zooms out below 100 down to the zoom-out floor", async () => {
    const store = makeAtomStore([[fretZoomAtom, 100]]);
    renderWithStore(<StageZoomControl />, store);

    await userEvent.click(screen.getByTestId("stage-zoom-out"));
    expect(store.get(fretZoomAtom)).toBe(90);
  });

  it("disables zoom-out at the zoom-out floor and zoom-in at the maximum", () => {
    const atMin = makeAtomStore([[fretZoomAtom, FRET_ZOOM_OUT_MIN]]);
    const { unmount } = renderWithStore(<StageZoomControl />, atMin);
    expect(screen.getByTestId("stage-zoom-out")).toBeDisabled();
    expect(screen.getByTestId("stage-zoom-in")).toBeEnabled();
    unmount();

    const atMax = makeAtomStore([[fretZoomAtom, FRET_ZOOM_MAX]]);
    renderWithStore(<StageZoomControl />, atMax);
    expect(screen.getByTestId("stage-zoom-in")).toBeDisabled();
    expect(screen.getByTestId("stage-zoom-out")).toBeEnabled();
  });

  it("clamps to the bounds", async () => {
    const store = makeAtomStore([[fretZoomAtom, FRET_ZOOM_MAX - 5]]);
    renderWithStore(<StageZoomControl />, store);
    await userEvent.click(screen.getByTestId("stage-zoom-in"));
    expect(store.get(fretZoomAtom)).toBe(FRET_ZOOM_MAX);
  });
});
