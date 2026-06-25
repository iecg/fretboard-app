import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createStore } from "jotai";
import { ShareButton } from "./ShareButton";
import { baseRootNoteAtom, baseScaleNameAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { progressionTempoBpmAtom, beatsPerBarAtom, timeSignatureDenominatorAtom, progressionStepsAtom } from "@fretflow/fretboard/store/progressionAtoms";
import { renderWithStore } from "../../test-utils/renderWithAtoms";
import type { ProgressionStep } from "@fretflow/fretboard/progressions/progressionDomain";

const DEFAULT_STEPS: ProgressionStep[] = [
  { id: "1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "2", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "3", degree: "vi", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
  { id: "4", degree: "IV", duration: { value: 1, unit: "bar" }, qualityOverride: null, manualRoot: null },
];

describe("ShareButton", () => {
  // userEvent.setup() installs its own clipboard stub on navigator.clipboard.
  // We must spy AFTER setup() runs so we intercept the stub's writeText, not
  // a prior Object.defineProperty value that setup() would overwrite.
  beforeEach(() => {
    // Ensure Web Share API is absent so the handler falls through to clipboard.
    Object.defineProperty(window.navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.navigator, "canShare", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("renders a share button with accessible label", () => {
    const store = createStore();
    store.set(progressionStepsAtom, DEFAULT_STEPS);
    renderWithStore(<ShareButton />, store);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("copies a URL to clipboard on click", async () => {
    // userEvent.setup() replaces navigator.clipboard with its own stub.
    // Spy on writeText AFTER setup() so we intercept the stub's implementation.
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    const store = createStore();
    store.set(baseRootNoteAtom, "C");
    store.set(baseScaleNameAtom, "major");
    store.set(progressionTempoBpmAtom, 120);
    store.set(beatsPerBarAtom, 4);
    store.set(timeSignatureDenominatorAtom, 4);
    store.set(progressionStepsAtom, DEFAULT_STEPS);

    renderWithStore(<ShareButton />, store);
    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(writeTextSpy).toHaveBeenCalledWith(
      expect.stringContaining("?s=C.major.120.4x4.I-V-vi-IV"),
    );
  });

  it("shows a toast after copying", async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(progressionStepsAtom, DEFAULT_STEPS);
    renderWithStore(<ShareButton />, store);
    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const store = createStore();
    store.set(progressionStepsAtom, DEFAULT_STEPS);
    const { container } = renderWithStore(<ShareButton />, store);
    expect(await axe(container)).toHaveNoViolations();
  });
});
