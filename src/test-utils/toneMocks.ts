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
  triggerRelease: Mock;
  triggerAttack: Mock;
  connect: Mock;
  dispose: Mock;
}

/**
 * Build a fresh set of Tone synth instance spies + a factory that creates
 * stub instances using them. Call `reset()` in `beforeEach` to clear call
 * counts AND re-install the constructor's mockImplementation in one step.
 */
export function createToneSynthSpies(): {
  spies: ToneSynthSpies;
  reset: () => void;
} {
  const spies: ToneSynthSpies = {
    ctorSpy: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttack: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  };
  const install = () => {
    spies.ctorSpy.mockImplementation(function () {
      return {
        triggerAttackRelease: spies.triggerAttackRelease,
        triggerRelease: spies.triggerRelease,
        triggerAttack: spies.triggerAttack,
        connect: spies.connect,
        dispose: spies.dispose,
        volume: { value: 0 },
      };
    });
  };
  install();
  return {
    spies,
    reset: () => {
      spies.ctorSpy.mockReset();
      spies.triggerAttackRelease.mockReset();
      spies.triggerRelease.mockReset();
      spies.triggerAttack.mockReset();
      spies.connect.mockReset().mockReturnThis();
      spies.dispose.mockReset();
      install();
    },
  };
}
