import { vi, type Mock } from "vitest";

export interface MockAudioParam {
  value: number;
  setValueAtTime: Mock;
  linearRampToValueAtTime: Mock;
  exponentialRampToValueAtTime: Mock;
  setTargetAtTime: Mock;
  cancelScheduledValues: Mock;
}

function makeParam(initial = 0): MockAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

export interface MockGainNode {
  gain: MockAudioParam;
  connect: Mock;
  disconnect: Mock;
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
  connect: Mock;
  disconnect: Mock;
  start: Mock;
  stop: Mock;
  setPeriodicWave: Mock;
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
  connect: Mock;
  disconnect: Mock;
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
  connect: Mock;
  disconnect: Mock;
  start: Mock;
  stop: Mock;
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

export interface MockAudioContext {
  currentTime: number;
  sampleRate: number;
  destination: MockGainNode;
  createGain: () => MockGainNode;
  createOscillator: () => MockOscillatorNode;
  createBiquadFilter: () => MockBiquadFilterNode;
  createBufferSource: () => MockBufferSourceNode;
  createBuffer: (channels: number, length: number, sampleRate: number) => MockAudioBuffer;
  createPeriodicWave: Mock;
  resume: Mock;
  suspend: Mock;
  state: "running" | "suspended" | "closed";
  created: {
    gains: MockGainNode[];
    oscillators: MockOscillatorNode[];
    filters: MockBiquadFilterNode[];
    bufferSources: MockBufferSourceNode[];
    buffers: MockAudioBuffer[];
  };
}

export function buildMockCtx(
  opts: { currentTime?: number; sampleRate?: number } = {},
): MockAudioContext {
  const created: MockAudioContext["created"] = {
    gains: [],
    oscillators: [],
    filters: [],
    bufferSources: [],
    buffers: [],
  };
  const destination = createMockGain();
  return {
    currentTime: opts.currentTime ?? 0,
    sampleRate: opts.sampleRate ?? 44100,
    destination,
    state: "running",
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    createPeriodicWave: vi.fn(),
    createGain: () => {
      const g = createMockGain();
      created.gains.push(g);
      return g;
    },
    createOscillator: () => {
      const o = createMockOsc();
      created.oscillators.push(o);
      return o;
    },
    createBiquadFilter: () => {
      const f = createMockFilter();
      created.filters.push(f);
      return f;
    },
    createBufferSource: () => {
      const s = createMockBufferSource();
      created.bufferSources.push(s);
      return s;
    },
    createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => {
      const b = createMockBuffer({ length, sampleRate, numberOfChannels });
      created.buffers.push(b);
      return b;
    },
    created,
  };
}
