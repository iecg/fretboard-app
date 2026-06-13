import { describe, it, expect } from "vitest";
import { applyJitter, shouldDropHit, grooveLockTimeAmount } from "./humanize";

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

describe("shouldDropHit", () => {
  it("never drops hits with velocity >= 0.4", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(shouldDropHit(0.4, seed)).toBe(false);
      expect(shouldDropHit(0.7, seed)).toBe(false);
      expect(shouldDropHit(1, seed)).toBe(false);
    }
  });

  it("drops a small fraction of sub-0.4 ghost hits (~12%)", () => {
    let dropped = 0;
    const N = 2000;
    for (let seed = 0; seed < N; seed++) {
      if (shouldDropHit(0.2, seed)) dropped++;
    }
    const rate = dropped / N;
    expect(rate).toBeGreaterThan(0.07);
    expect(rate).toBeLessThan(0.17);
  });

  it("is deterministic for a fixed velocity + seed", () => {
    expect(shouldDropHit(0.2, 42)).toBe(shouldDropHit(0.2, 42));
    expect(shouldDropHit(0.2, 42)).not.toBe(undefined);
  });
});

describe("grooveLockTimeAmount", () => {
  it("reduces jitter on integer (anchor) beats to ~40%", () => {
    expect(grooveLockTimeAmount(0, 0.015)).toBeCloseTo(0.006);
    expect(grooveLockTimeAmount(2, 0.015)).toBeCloseTo(0.006);
    expect(grooveLockTimeAmount(0, 0.005)).toBeCloseTo(0.002);
  });

  it("leaves off-beats at full jitter", () => {
    expect(grooveLockTimeAmount(0.5, 0.015)).toBe(0.015);
    expect(grooveLockTimeAmount(1.75, 0.015)).toBe(0.015);
    expect(grooveLockTimeAmount(2.5, 0.005)).toBe(0.005);
  });

  it("is meter-agnostic (works for any integer beat)", () => {
    expect(grooveLockTimeAmount(5, 0.015)).toBeCloseTo(0.006);
    expect(grooveLockTimeAmount(6, 0.015)).toBeCloseTo(0.006);
  });
});
