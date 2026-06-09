// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithAtoms, makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { axe } from "../../test-utils/a11y";
import { activeProgressionStepIndexAtom, beatsPerBarAtom, displayedStepIndexPrimitiveAtom, progressionLoopEnabledAtom, progressionPlayingAtom, progressionStepsAtom, progressionTempoBpmAtom, setProgressionPlayingAtom } from "../../store/progressionAtoms";
import { _resetProgressionAudioForTests, ensureProgressionAudio } from "../../progressions/audio/bus";
import { _resetTimelineForTests, setActiveStep } from "../../progressions/audio/timeline";
import * as timeline from "../../progressions/audio/timeline";
import { TooltipProvider } from "../Tooltip/Tooltip";
import { HeaderTransportCluster } from "./HeaderTransportCluster";

const fourStepProgression = [
  { id: "one", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: null },
  { id: "two", degree: "V", duration: { value: 1, unit: "bar" }, qualityOverride: "7" },
] as const;

describe("HeaderTransportCluster", () => {
  beforeEach(() => {
    _resetTimelineForTests();
    _resetProgressionAudioForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders transport controls, status lights, and the position/tempo/scale readouts", async () => {
    const { container } = renderWithAtoms(<TooltipProvider delayDuration={0}><HeaderTransportCluster /></TooltipProvider>, [
      [progressionStepsAtom, fourStepProgression],
      [progressionTempoBpmAtom, 90],
      [beatsPerBarAtom, 4],
    ]);

    expect(screen.getByTestId("header-transport-cluster")).toBeTruthy();
    expect(screen.getByTestId("transport-bar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous chord" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play progression" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next chord" })).toBeNull();
    expect(screen.getByRole("button", { name: "Loop progression" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop progression" })).toBeNull();
    expect(screen.queryByLabelText(/pause progression/i)).toBeNull();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
    expect(screen.getByText("Position")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByText("BPM")).toBeTruthy();
    // Scale readout shows only the headline — the parenthetical mode is dropped.
    expect(screen.getByText("C Major")).toBeTruthy();
    expect(screen.queryByText(/Ionian/)).toBeNull();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("transport controls still drive the playback atoms", () => {
    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [progressionLoopEnabledAtom, false],
    ]);
    renderWithStore(<TooltipProvider delayDuration={0}><HeaderTransportCluster /></TooltipProvider>, store);

    fireEvent.click(screen.getByRole("button", { name: "Loop progression" }));
    expect(store.get(progressionLoopEnabledAtom)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
    expect(store.get(progressionPlayingAtom)).toBe(true);
  });

  it("uses the displayed playback step for the live position readout while playing", () => {
    const mockTime = 0;
    const audioContext = {
      get currentTime() {
        return mockTime;
      },
      createGain: () => ({
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
      destination: {},
      addEventListener: vi.fn(),
    };

    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function () {
        return audioContext;
      }) as unknown as typeof AudioContext;

    ensureProgressionAudio();
    setActiveStep(1, 0, 2.0, 2.0, 4.0);

    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [progressionTempoBpmAtom, 120],
      [beatsPerBarAtom, 4],
      [activeProgressionStepIndexAtom, 0],
      [displayedStepIndexPrimitiveAtom, 1],
    ]);
    store.set(setProgressionPlayingAtom, true);

    renderWithStore(<TooltipProvider delayDuration={0}><HeaderTransportCluster /></TooltipProvider>, store);

    expect(screen.getByRole("status", { name: "Position 2.1.1 of 2.0.0" })).toBeTruthy();
  });

  it("[REGRESSION] header displays 2.1.1 at step boundary when globalFraction=0.5 and localFraction=0.9999", () => {
    vi.useFakeTimers();

    // Mock getTimelinePosition to return the boundary frame where:
    // - globalFraction = 0.5 (halfway through the progression)
    // - localFraction = 0.9999 (at the end of the current step)
    // - stepIndex = 1 (second step)
    // Displayed step = 1, active step = 0 (one step behind)
    // The header readout should show Position 2.1.1, NOT 2.4.4
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 1,
      globalFraction: 0.5,
      localFraction: 0.9999,
      paused: false,
      totalDurationSec: 16,
    });

    const store = makeAtomStore([
      [progressionStepsAtom, fourStepProgression],
      [progressionTempoBpmAtom, 120],
      [beatsPerBarAtom, 4],
      [activeProgressionStepIndexAtom, 0],
      [displayedStepIndexPrimitiveAtom, 1],
    ]);
    store.set(setProgressionPlayingAtom, true);

    renderWithStore(<TooltipProvider delayDuration={0}><HeaderTransportCluster /></TooltipProvider>, store);

    // Advance timers to trigger the tick
    vi.advanceTimersByTime(500);

    // EXPECTED: Position 2.1.1 (start of bar 2)
    // BUG: Will likely show Position 2.4.4 (end of bar 2) because it uses localFraction
    expect(screen.getByRole("status", { name: "Position 2.1.1 of 2.0.0" })).toBeTruthy();

    vi.useRealTimers();
  });
});
