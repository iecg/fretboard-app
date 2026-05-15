// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { ProgressionPlayhead } from "./ProgressionPlayhead";
import { setActiveStep, _resetTimelineForTests } from "../../progressions/audio/timeline";
import { _resetProgressionAudioForTests, ensureProgressionAudio } from "../../progressions/audio/bus";

describe("ProgressionPlayhead", () => {
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

  it("renders at the start bar when not playing", () => {
    const { container } = render(
      <ProgressionPlayhead
        playing={false}
        stepStartBar={3}
        totalDurationBars={4}
        totalBarsForDisplay={4}
      />
    );

    const playhead = container.querySelector("[data-testid='progression-playhead']") as HTMLElement;
    // (3-1)/4 = 50%
    expect(playhead.style.left).toBe("50%");
  });

  it("animates linearly across total duration using globalFraction", () => {
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

    // 4 bars total, each 1s.
    setActiveStep(0, 0, 1.0, 0, 4.0);

    const { container, rerender } = render(
      <ProgressionPlayhead
        playing={true}
        stepStartBar={1}
        totalDurationBars={4}
        totalBarsForDisplay={4}
      />
    );

    const playhead = container.querySelector("[data-testid='progression-playhead']") as HTMLElement;
    
    // t=0.5 -> globalFraction = 0.5/4 = 0.125. 12.5%
    act(() => {
      mockTime = 0.5;
      // Trigger rAF. In jsdom with fake timers, we might need to manually trigger or advance timers.
      // Vitest's fake timers handle rAF via advanceTimersByTime.
      vi.advanceTimersByTime(16);
    });
    expect(playhead.style.left).toBe("12.5%");

    // Transition to Step 1 (at bar 2)
    // Even if React rerenders, the playhead should use the latest tl.globalFraction.
    setActiveStep(1, 1.0, 1.0, 1.0, 4.0);
    
    rerender(
      <ProgressionPlayhead
        playing={true}
        stepStartBar={2}
        totalDurationBars={4}
        totalBarsForDisplay={4}
      />
    );

    // t=1.5 -> globalFraction = (1.0 + 0.5)/4 = 0.375. 37.5%
    act(() => {
      mockTime = 1.5;
      vi.advanceTimersByTime(16);
    });
    expect(playhead.style.left).toBe("37.5%");
  });
});
