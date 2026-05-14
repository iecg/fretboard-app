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
    setActiveStep(2, 0, 4);
    expect(getTimelinePosition()).toEqual({
      stepIndex: 2,
      fraction: 0,
      paused: false,
    });
  });

  it("interpolates fraction linearly across the step duration", () => {
    setActiveStep(0, 0, 4);
    mockNow = 1;
    expect(getTimelinePosition()?.fraction).toBeCloseTo(0.25, 3);
    mockNow = 2;
    expect(getTimelinePosition()?.fraction).toBeCloseTo(0.5, 3);
    mockNow = 3;
    expect(getTimelinePosition()?.fraction).toBeCloseTo(0.75, 3);
  });

  it("clamps fraction to [0, 1]", () => {
    setActiveStep(0, 0, 4);
    mockNow = -1;
    expect(getTimelinePosition()?.fraction).toBe(0);
    mockNow = 5;
    expect(getTimelinePosition()?.fraction).toBe(1);
  });

  it("flags the step as finished once the audio clock crosses the end", () => {
    setActiveStep(0, 0, 4);
    mockNow = 3.999;
    expect(isCurrentStepFinished()).toBe(false);
    mockNow = 4;
    expect(isCurrentStepFinished()).toBe(true);
    mockNow = 5;
    expect(isCurrentStepFinished()).toBe(true);
  });

  it("reports fraction 0 + paused when paused", () => {
    setActiveStep(0, 0, 4);
    mockNow = 2;
    pauseTimeline();
    expect(getTimelinePosition()).toEqual({
      stepIndex: 0,
      fraction: 0,
      paused: true,
    });
    expect(isCurrentStepFinished()).toBe(false);
  });

  it("rebases the start time so a paused step resumes from beat 0", () => {
    setActiveStep(0, 0, 4);
    mockNow = 2;
    pauseTimeline();
    mockNow = 10;
    resumeTimelineAtCurrentTime();
    // After resume the fraction starts at 0 again.
    expect(getTimelinePosition()?.fraction).toBe(0);
    expect(getTimelinePosition()?.paused).toBe(false);
    mockNow = 11;
    expect(getTimelinePosition()?.fraction).toBeCloseTo(0.25, 3);
  });

  it("clearTimeline wipes the active step", () => {
    setActiveStep(0, 0, 4);
    clearTimeline();
    expect(getTimelinePosition()).toBeNull();
  });
});
