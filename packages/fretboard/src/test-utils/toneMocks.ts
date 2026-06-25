/**
 * Helpers for mocking Tone.js instruments in unit tests.
 *
 * Why this exists: `vi.mock("tone", ...)` with `vi.hoisted` spies requires
 * re-installing `mockImplementation` after every `mockReset()` because
 * mockReset strips implementations. Each test file would otherwise repeat
 * ~15 lines of brittle setup. This helper centralizes the pattern.
 */
import type { Mock } from "vitest";
import { vi } from "vitest";

export interface ToneSynthSpies {
  ctorSpy: Mock;
  triggerAttackRelease: Mock;
  playbackAttackRelease: Mock;
  triggerRelease: Mock;
  triggerAttack: Mock;
  releaseAll: Mock;
  connect: Mock;
  disconnect: Mock;
  dispose: Mock;
}

export interface ToneSynthInstanceSpies {
  triggerAttackRelease: Mock;
  triggerRelease: Mock;
  triggerAttack: Mock;
  releaseAll: Mock;
  connect: Mock;
  disconnect: Mock;
  dispose: Mock;
  volume: { value: number };
  maxPolyphony: number;
  envelope: { cancel: Mock };
  filterEnvelope: { cancel: Mock };
}

/**
 * Build a fresh set of Tone synth instance spies + a factory that creates
 * stub instances using them. Call `reset()` in `beforeEach` to clear call
 * counts AND re-install the constructor's mockImplementation in one step.
 */
export function createToneSynthSpies(): {
  spies: ToneSynthSpies;
  instances: ToneSynthInstanceSpies[];
  now: () => number;
  setNow: (value: number) => void;
  reset: () => void;
} {
  const instances: ToneSynthInstanceSpies[] = [];
  let currentNow = 0;
  const spies: ToneSynthSpies = {
    ctorSpy: vi.fn(),
    triggerAttackRelease: vi.fn(),
    playbackAttackRelease: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttack: vi.fn(),
    releaseAll: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  };
  const install = () => {
    spies.ctorSpy.mockImplementation(function () {
      let disposed = false;
      const playbackTimers = new Set<ReturnType<typeof setTimeout>>();
      const instance: ToneSynthInstanceSpies = {
        triggerAttackRelease: vi.fn((...args: unknown[]) => {
          spies.triggerAttackRelease(...args);
          const playbackTime =
            typeof args[2] === "number" ? Math.max(currentNow, args[2]) : currentNow;
          const delayMs = Math.max(0, (playbackTime - currentNow) * 1000);
          const playbackTimer = setTimeout(() => {
            playbackTimers.delete(playbackTimer);
            if (!disposed) {
              spies.playbackAttackRelease(...args);
            }
          }, delayMs);
          playbackTimers.add(playbackTimer);
          return instance;
        }),
        triggerRelease: vi.fn((...args: unknown[]) => {
          spies.triggerRelease(...args);
          return instance;
        }),
        triggerAttack: vi.fn((...args: unknown[]) => {
          spies.triggerAttack(...args);
          return instance;
        }),
        releaseAll: vi.fn((...args: unknown[]) => {
          spies.releaseAll(...args);
          return instance;
        }),
        connect: vi.fn((...args: unknown[]) => {
          spies.connect(...args);
          return instance;
        }),
        disconnect: vi.fn((...args: unknown[]) => {
          spies.disconnect(...args);
          return instance;
        }),
        dispose: vi.fn((...args: unknown[]) => {
          disposed = true;
          for (const playbackTimer of playbackTimers) {
            clearTimeout(playbackTimer);
          }
          playbackTimers.clear();
          spies.dispose(...args);
        }),
        volume: { value: 0 },
        maxPolyphony: 0,
        envelope: {
          cancel: vi.fn(() => {
            for (const playbackTimer of playbackTimers) {
              clearTimeout(playbackTimer);
            }
            playbackTimers.clear();
          }),
        },
        filterEnvelope: {
          cancel: vi.fn(() => {
            // filter envelope behaves similarly for simplicity
          }),
        },
      };
      instances.push(instance);
      return instance;
    });
  };
  install();
  return {
    spies,
    instances,
    now: () => currentNow,
    setNow: (value: number) => {
      currentNow = value;
    },
    reset: () => {
      currentNow = 0;
      instances.length = 0;
      spies.ctorSpy.mockReset();
      spies.triggerAttackRelease.mockReset();
      spies.playbackAttackRelease.mockReset();
      spies.triggerRelease.mockReset();
      spies.triggerAttack.mockReset();
      spies.releaseAll.mockReset();
      spies.connect.mockReset().mockReturnThis();
      spies.disconnect.mockReset().mockReturnThis();
      spies.dispose.mockReset();
      install();
    },
  };
}
