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

export type BiquadFilterType =
  | "lowpass"
  | "highpass"
  | "bandpass"
  | "lowshelf"
  | "highshelf"
  | "peaking"
  | "notch"
  | "allpass";

export interface MockBiquadFilterNode {
  type: BiquadFilterType;
  frequency: MockAudioParam;
  Q: MockAudioParam;
  gain: MockAudioParam;
  detune: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

export function createMockFilter(): MockBiquadFilterNode {
  return {
    type: "lowpass",
    frequency: makeParam(350),
    Q: makeParam(1),
    gain: makeParam(0),
    detune: makeParam(0),
    connect: vi.fn((t: unknown) => t),
    disconnect: vi.fn(),
  };
}

export interface MockAudioBuffer {
  length: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  getChannelData: (i: number) => Float32Array;
}

export function createMockBuffer(opts: {
  length: number;
  sampleRate: number;
  numberOfChannels?: number;
}): MockAudioBuffer {
  const channels = opts.numberOfChannels ?? 1;
  const data = Array.from({ length: channels }, () => new Float32Array(opts.length));
  return {
    length: opts.length,
    duration: opts.length / opts.sampleRate,
    sampleRate: opts.sampleRate,
    numberOfChannels: channels,
    getChannelData: (i: number) => data[i],
  };
}

export interface MockBufferSourceNode {
  buffer: MockAudioBuffer | null;
  playbackRate: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

export function createMockBufferSource(): MockBufferSourceNode {
  return {
    buffer: null,
    playbackRate: makeParam(1),
    connect: vi.fn((t: unknown) => t),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
}
