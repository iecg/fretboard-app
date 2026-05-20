import { vi } from "vitest";

export interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

function makeParam(initial = 0): MockAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

export interface MockGainNode {
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

export function createMockGain(): MockGainNode {
  const node: MockGainNode = {
    gain: makeParam(1),
    connect: vi.fn((target: unknown) => target),
    disconnect: vi.fn(),
  };
  return node;
}

export type OscillatorType = "sine" | "square" | "sawtooth" | "triangle" | "custom";

export interface MockOscillatorNode {
  type: OscillatorType;
  frequency: MockAudioParam;
  detune: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setPeriodicWave: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

export function createMockOsc(): MockOscillatorNode {
  return {
    type: "sine",
    frequency: makeParam(440),
    detune: makeParam(0),
    connect: vi.fn((target: unknown) => target),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setPeriodicWave: vi.fn(),
    onended: null,
  };
}
