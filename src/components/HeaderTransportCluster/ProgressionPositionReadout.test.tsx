import { axe } from "vitest-axe";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ProgressionPositionReadout } from "./ProgressionPositionReadout";
import { setActiveStep, _resetTimelineForTests } from "../../progressions/audio/timeline";
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
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
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

    // New format: start = `1.1.1`, 4-bar total = `4.0.0`.
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
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={120}
      />
    );

    // Initial label
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();

    // At 120 BPM the tick is 60000 / 120 / 4 = 125 ms. Advance past one tick.
    // 0.5 s = 25% of step = beat 2 of bar 1, first sixteenth → `1.2.1`.
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(125);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.1 of 4.0.0" })).toBeTruthy();

    // 0.75 s = 37.5% of step = beat 2 + half-beat = 2nd sixteenth → `1.2.3`.
    // (Half a beat = 2 sixteenths past beat 2's first sixteenth → 1+2 = 3.)
    act(() => {
      mockTime = 0.75;
      vi.advanceTimersByTime(125);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.3 of 4.0.0" })).toBeTruthy();

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
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={60}
      />
    );

    // At 60 BPM the tick is 250 ms. Advancing 125 ms does NOT fire a tick.
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(125);
    });
    // Label is still the initial value (no interval has fired yet).
    expect(screen.getByRole("status", { name: "Position 1.1.1 of 4.0.0" })).toBeTruthy();

    // Re-render at 240 BPM. New tick = 62.5 → 63 ms. After 70 ms the tick has
    // fired and the label reflects the new position.
    rerender(
      <ProgressionPositionReadout
        playing={true}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
        tempoBpm={240}
      />
    );
    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(screen.getByRole("status", { name: "Position 1.2.1 of 4.0.0" })).toBeTruthy();
  });
});
