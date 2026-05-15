import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetTimelineForTests,
  clearTimeline,
  getTimelinePosition,
  isCurrentStepFinished,
  pauseTimeline,
  resumeTimelineAtCurrentTime,
  setActiveStep,
} from "./timeline";
import { _resetProgressionAudioForTests } from "./bus";

let mockNow = 0;

beforeEach(() => {
  _resetTimelineForTests();
  _resetProgressionAudioForTests();
  mockNow = 0;

  const audioContext = {
    get currentTime() {
      return mockNow;
    },
    sampleRate: 44100,
    state: "running" as AudioContextState,
    createGain: () => ({
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    }),
    destination: {} as AudioDestinationNode,
    resume: vi.fn(),
  };

  (window as unknown as { AudioContext: unknown }).AudioContext =
    vi.fn(function () {
      return audioContext;
    }) as unknown as typeof AudioContext;
});

describe("timeline", () => {
  it("returns null when no active step has been set", () => {
    expect(getTimelinePosition()).toBeNull();
  });

  it("reports fraction 0 at the moment a step is set", () => {
    setActiveStep(2, 0, 4, 8, 16);
    expect(getTimelinePosition()).toEqual({
      stepIndex: 2,
      globalFraction: 0.5,
      localFraction: 0,
      paused: false,
    });
  });

  it("interpolates fraction linearly across the step duration", () => {
    setActiveStep(0, 0, 4, 0, 16);
    mockNow = 1;
    expect(getTimelinePosition()?.localFraction).toBeCloseTo(0.25, 3);
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.0625, 4);
    mockNow = 2;
    expect(getTimelinePosition()?.localFraction).toBeCloseTo(0.5, 3);
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.125, 4);
    mockNow = 3;
    expect(getTimelinePosition()?.localFraction).toBeCloseTo(0.75, 3);
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.1875, 4);
  });

  it("allows fraction extrapolation past 0 and 1", () => {
    setActiveStep(1, 0, 4, 4, 16);
    mockNow = -1;
    expect(getTimelinePosition()?.localFraction).toBe(-0.25);
    expect(getTimelinePosition()?.globalFraction).toBe(0.1875); // (4 - 1) / 16 = 3/16 = 0.1875
    mockNow = 5;
    expect(getTimelinePosition()?.localFraction).toBe(1.25);
    expect(getTimelinePosition()?.globalFraction).toBe(0.5625); // (4 + 5) / 16 = 9/16 = 0.5625
  });

  it("flags the step as finished once the audio clock crosses the end", () => {
    setActiveStep(0, 0, 4, 0, 16);
    mockNow = 3.999;
    expect(isCurrentStepFinished()).toBe(false);
    mockNow = 4;
    expect(isCurrentStepFinished()).toBe(true);
    mockNow = 5;
    expect(isCurrentStepFinished()).toBe(true);
  });

  it("reports fraction 0 + paused when paused", () => {
    setActiveStep(0, 0, 4, 0, 16);
    mockNow = 2;
    pauseTimeline();
    expect(getTimelinePosition()).toEqual({
      stepIndex: 0,
      globalFraction: 0,
      localFraction: 0,
      paused: true,
    });
    expect(isCurrentStepFinished()).toBe(false);
  });

  it("reports correctly when paused at a non-zero cumulative start", () => {
    setActiveStep(1, 0, 4, 4, 16);
    mockNow = 2;
    pauseTimeline();
    expect(getTimelinePosition()).toEqual({
      stepIndex: 1,
      globalFraction: 0.25, // 4 / 16
      localFraction: 0,
      paused: true,
    });
  });

  it("rebases the start time so a paused step resumes from beat 0", () => {
    setActiveStep(0, 0, 4, 0, 16);
    mockNow = 2;
    pauseTimeline();
    mockNow = 10;
    resumeTimelineAtCurrentTime();
    // After resume the fraction starts at 0 again.
    expect(getTimelinePosition()?.localFraction).toBe(0);
    expect(getTimelinePosition()?.globalFraction).toBe(0);
    expect(getTimelinePosition()?.paused).toBe(false);
    mockNow = 11;
    expect(getTimelinePosition()?.localFraction).toBeCloseTo(0.25, 3);
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.0625, 4);
  });

  it("maintains a perfectly linear globalFraction across multiple steps", () => {
    const totalDuration = 10;

    // Step 0: 0.0 -> 2.0s
    setActiveStep(0, 0, 2.0, 0, totalDuration);
    mockNow = 1.0;
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.1, 5);

    // Step 1: 2.0 -> 5.0s (3s duration)
    setActiveStep(1, 2.0, 3.0, 2.0, totalDuration);
    mockNow = 3.5;
    // elapsed in step 1 = 1.5s
    // cumulative = 2.0 + 1.5 = 3.5s
    // globalFraction = 3.5 / 10 = 0.35
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.35, 5);

    // Step 2: 5.0 -> 10.0s (5s duration)
    setActiveStep(2, 5.0, 5.0, 5.0, totalDuration);
    mockNow = 7.5;
    // elapsed in step 2 = 2.5s
    // cumulative = 5.0 + 2.5 = 7.5s
    // globalFraction = 7.5 / 10 = 0.75
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.75, 5);
  });

  it("handles globalFraction correctly through pause and resume", () => {
    const totalDuration = 10;
    // Step 1: 2.0 -> 4.0s (2s duration)
    setActiveStep(1, 0, 2.0, 2.0, totalDuration);
    mockNow = 1.0;
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.3, 5); // (2+1)/10

    pauseTimeline();
    mockNow = 5.0; // Time passes while paused
    // When paused, it should snap to the start of the current step
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.2, 5); // 2/10
    expect(getTimelinePosition()?.paused).toBe(true);

    mockNow = 10.0;
    resumeTimelineAtCurrentTime();
    // Re-anchored to mockNow = 10.0
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.2, 5);
    expect(getTimelinePosition()?.paused).toBe(false);

    mockNow = 11.0;
    // 1s elapsed since resume
    expect(getTimelinePosition()?.globalFraction).toBeCloseTo(0.3, 5); // (2+1)/10
  });

  it("clearTimeline wipes the active step", () => {
    setActiveStep(0, 0, 4, 0, 16);
    clearTimeline();
    expect(getTimelinePosition()).toBeNull();
  });
});
