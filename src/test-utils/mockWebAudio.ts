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
