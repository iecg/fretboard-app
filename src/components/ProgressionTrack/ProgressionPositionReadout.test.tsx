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

  it("renders initial position correctly", () => {
    render(
      <ProgressionPositionReadout
        playing={false}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
      />
    );

    // Initial render should show 01.1.000 / 04.4.000
    // Use container.textContent or regex for more robust matching
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getAllByText("000")).toHaveLength(2);
    expect(screen.getByText("04")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("updates digits during playback without NaN", () => {
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

    // Must call ensureProgressionAudio to initialize the singleton in bus.ts
    ensureProgressionAudio();

    setActiveStep(0, 0, 2.0, 0, 8.0); // 2s step, total 8s

    render(
      <ProgressionPositionReadout
        playing={true}
        stepStartBar={1}
        stepBars={1}
        stepIndex={0}
        totalProgressionBars={4}
        beatsPerBar={4}
      />
    );

    // Advance 0.5s (25% of step)
    act(() => {
      mockTime = 0.5;
      vi.advanceTimersByTime(16);
    });

    // 25% of 4 beats = 1 beat. So 01.2.000 (1-indexed beat)
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    
    // Advance to 0.75s (37.5% of step)
    act(() => {
      mockTime = 0.75;
      vi.advanceTimersByTime(16);
    });

    // 37.5% of 4 beats = 1.5 beats. So 01.2.500
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("500")).toBeTruthy();
    
    // Ensure no NaN is present
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
