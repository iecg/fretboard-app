import { describe, it, expect } from "vitest";
import { applyJitter } from "./humanize";

describe("applyJitter", () => {
  it("returns a new object with jittered time and velocity", () => {
    const time = 10;
    const velocity = 0.8;
    const result = applyJitter({ time, velocity, seed: 12345 });
    
    expect(result.time).not.toBe(time);
    expect(result.velocity).not.toBe(velocity);
    
    // Bounds check
    expect(Math.abs(result.time - time)).toBeLessThanOrEqual(0.015);
    expect(Math.abs(result.velocity - velocity)).toBeLessThanOrEqual(0.1);
  });

  it("is deterministic based on the seed", () => {
    const input1 = { time: 5, velocity: 0.5, seed: 42 };
    const input2 = { time: 5, velocity: 0.5, seed: 42 };
    const input3 = { time: 5, velocity: 0.5, seed: 99 };

    const res1 = applyJitter(input1);
    const res2 = applyJitter(input2);
    const res3 = applyJitter(input3);

    expect(res1.time).toBe(res2.time);
    expect(res1.velocity).toBe(res2.velocity);

    expect(res1.time).not.toBe(res3.time);
  });

  it("clamps velocity to [0, 1]", () => {
    // If we pass velocity 1 and the jitter is positive, it should clamp to 1.
    // If we pass velocity 0 and the jitter is negative, it should clamp to 0.
    // Let's just run it a few times to ensure we never get > 1 or < 0.
    for (let i = 0; i < 50; i++) {
      const result1 = applyJitter({ time: 0, velocity: 1, seed: i });
      expect(result1.velocity).toBeLessThanOrEqual(1);

      const result0 = applyJitter({ time: 0, velocity: 0, seed: i });
      expect(result0.velocity).toBeGreaterThanOrEqual(0);
    }
  });
});
