import { axe } from "vitest-axe";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";
import { setActiveStep, _resetTimelineForTests } from "../../progressions/audio/timeline";
import * as timeline from "../../progressions/audio/timeline";
import { _resetProgressionAudioForTests, ensureProgressionAudio } from "../../progressions/audio/bus";

describe("ProgressionPositionReadout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetTimelineForTests();
    _resetProgressionAudioForTests();

    const audioContext = {
      get currentTime() {
        return 0;
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders initial position correctly and has no accessibility violations", async () => {
    const { container } = render(
      <ProgressionPositionReadout
        playing={false}
        stoppedBar={1}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    let violations;
    await act(async () => {
      vi.useRealTimers();
      violations = await axe(container);
      vi.useFakeTimers();
    });
    expect(violations).toHaveNoViolations();

    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();
  });

  it("updates digits during playback without NaN", async () => {
    let mockTime = 0;
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

    setActiveStep(0, 0, 2.0, 0, 8.0); // 2s step, total 8s

    const { container } = render(
      <ProgressionPositionReadout
        playing={true}
        stoppedBar={1}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    // Initial label
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();

    // At 120 BPM the tick is 60000 / 120 = 500 ms. Advance past one tick.
    // 0.5 s = 25% of step = beat 2 of bar 1, first sixteenth → `1.2.1`.
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.1 of 4.0.0" })).toBeTruthy();

    // 1.0 s = 50% of step = beat 3 of bar 1, first sixteenth → `1.3.1`.
    act(() => {
      mockTime = 1.0;
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status", { name: "Position 1.3.1 of 4.0.0" })).toBeTruthy();

    let playbackViolations;
    await act(async () => {
      vi.useRealTimers();
      playbackViolations = await axe(container);
      vi.useFakeTimers();
    });
    expect(playbackViolations).toHaveNoViolations();

    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("restarts the tick interval when tempo changes", () => {
    let mockTime = 0;
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
    setActiveStep(0, 0, 2.0, 0, 8.0);

    const { rerender } = render(
      <ProgressionPositionReadout
        playing={true}
        stoppedBar={1}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={60}
      />
    );

    // At 60 BPM the tick is 1000 ms. Advancing 125 ms does NOT fire a tick.
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(125);
    });
    // Label is still the initial value (no interval has fired yet).
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();

    // Re-render at 240 BPM. New tick = 250 ms. After 260 ms the tick has
    // fired and the label reflects the new position (mockTime = 0.5 = 25% of
    // a 2 s step = beat 2, first sixteenth).
    rerender(
      <ProgressionPositionReadout
        playing={true}
        stoppedBar={1}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={240}
      />
    );
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.1 of 4.0.0" })).toBeTruthy();
  });

  it("continues incrementing the position continuously using globalFraction when the active step runs past its boundary", () => {
    let mockTime = 0;
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
    setActiveStep(0, 0, 2.0, 0, 8.0);

    render(
      <ProgressionPositionReadout
        playing={true}
        stoppedBar={1}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    act(() => {
      mockTime = 3.5;
      vi.advanceTimersByTime(3500);
    });

    // With globalFraction = 3.5 / 8.0 = 0.4375, position = 1 + 0.4375 * 4 = 2.75 bars
    // which is bar 2, beat 4, subdivision 1 (2.4.1)
    expect(screen.getByRole("status", { name: "Position 2.4.1 of 4.0.0" })).toBeTruthy();
  });

  it("[REGRESSION] renders 2.1.1 at step boundary when globalFraction=0.5 and localFraction=0.9999", () => {
    // Mock getTimelinePosition to return the boundary frame where:
    // - globalFraction = 0.5 (halfway through the progression)
    // - localFraction = 0.9999 (at the end of the current step)
    // - stepIndex = 1 (second step)
    // The readout should show Position 2.1.1 (start of bar 2), NOT 2.4.4 (end of bar 2)
    vi.spyOn(timeline, "getTimelinePosition").mockReturnValue({
      stepIndex: 1,
      globalFraction: 0.5,
      localFraction: 0.9999,
      paused: false, totalDurationSec: 16,
    });

    render(
      <ProgressionPositionReadout
        playing={true}
        stoppedBar={2}
        totalProgressionBars={2}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    // Advance timers to trigger the tick
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // EXPECTED: Position 2.1.1 (start of bar 2)
    // BUG: Will likely show Position 2.4.4 (end of bar 2) because it uses localFraction
    expect(screen.getByRole("status", { name: "Position 2.1.1 of 2.0.0" })).toBeTruthy();
  });
});
