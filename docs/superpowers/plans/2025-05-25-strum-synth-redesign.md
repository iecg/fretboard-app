# Strum Synth Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PluckSynth (Karplus-Strong) strum with a warmer synth-based voice.

**Architecture:** `string.ts`'s pooled voice switches from `Tone.PluckSynth` to `Tone.Synth` with custom oscillator partials and a fast-decay envelope. The `pluckString()` export signature stays the same. `strumVoice.ts` and all callers require zero changes.

**Tech Stack:** Tone.js (`Tone.Synth`), `createReusableVoicePool`

---

### Task 1: Replace PluckSynth with Synth in string.ts

**Files:**
- Modify: `src/progressions/audio/string.ts`
- Modify: `src/progressions/audio/string.test.ts`

- [ ] **Step 1: Rewrite `string.ts` to use `Tone.Synth` instead of `Tone.PluckSynth`**

Replace the contents of `src/progressions/audio/string.ts`:

```typescript
import * as Tone from "tone";
import { createReusableVoicePool } from "./createReusableVoicePool";

const PARTIALS = [1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06];
const ATTACK = 0.005;
const DECAY = 0.3;
const SUSTAIN = 0;
const RELEASE = 0.8;
const RELEASE_TAIL_SEC = RELEASE + 0.1;

export interface PluckedVoiceHandle {
  cancel: () => void;
}

export interface PluckStringOptions {
  velocity?: number;
}

const pluckPool = createReusableVoicePool({
  createVoice: () =>
    new Tone.Synth({
      oscillator: {
        type: "custom",
        partials: PARTIALS,
      },
      envelope: {
        attack: ATTACK,
        decay: DECAY,
        sustain: SUSTAIN,
        release: RELEASE,
      },
    }),
});

export function pluckString(
  dest: AudioNode,
  frequency: number,
  startTime: number,
  options: PluckStringOptions = {},
): PluckedVoiceHandle {
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 1));
  if (velocity <= 0) return { cancel: () => {} };

  const now = Tone.now();
  const playbackStartTime = Math.max(now, startTime);
  const lease = pluckPool.lease(dest, now);
  lease.setBusyUntil(playbackStartTime + RELEASE_TAIL_SEC);

  lease.voice.triggerAttackRelease(frequency, RELEASE, startTime, velocity);

  let cancelled = false;
  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
    },
  };
}
```

- [ ] **Step 2: Update `string.test.ts` to test the new synth-based voice**

Replace the entire mock setup + test suite in `src/progressions/audio/string.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const tone = vi.hoisted(async () => {
  const { createToneSynthSpies } = await import("../../test-utils/toneMocks");
  return createToneSynthSpies();
});

vi.mock("tone", async () => {
  const t = await tone;
  return {
    Synth: t.spies.ctorSpy,
    gainToDb: (v: number) => 20 * Math.log10(Math.max(1e-6, v)),
    now: () => t.now(),
  };
});

import { pluckString } from "./string";

describe("pluckString — Tone.Synth backend", () => {
  beforeEach(async () => {
    (await tone).reset();
  });

  it("constructs Synth with custom oscillator partials and fast-decay envelope", async () => {
    pluckString({} as AudioNode, 220, 1.0);
    const t = await tone;
    expect(t.spies.ctorSpy).toHaveBeenCalledTimes(1);
    const [opts] = t.spies.ctorSpy.mock.calls[0]!;
    expect(opts.oscillator.type).toBe("custom");
    expect(opts.oscillator.partials).toEqual([1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06]);
    expect(opts.envelope.attack).toBeCloseTo(0.005);
    expect(opts.envelope.decay).toBeCloseTo(0.3);
    expect(opts.envelope.sustain).toBeCloseTo(0);
    expect(opts.envelope.release).toBeCloseTo(0.8);
  });

  it("triggers attack-release at requested freq + time with velocity", async () => {
    const t = await tone;
    pluckString({} as AudioNode, 220, 1.5, { velocity: 0.7 });
    expect(t.spies.triggerAttackRelease).toHaveBeenCalledTimes(1);
    const [pitch, duration, time, vel] = t.spies.triggerAttackRelease.mock.calls[0]!;
    expect(Number(pitch)).toBeCloseTo(220, 1);
    expect(duration).toBeCloseTo(0.8, 2);
    expect(time).toBeCloseTo(1.5, 3);
    expect(vel).toBeCloseTo(0.7, 2);
  });

  it("skips zero-velocity plucks (no synth constructed)", async () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0 });
    const t = await tone;
    expect(t.spies.ctorSpy).not.toHaveBeenCalled();
  });

  it("pool reuses Synth instances across non-overlapping plucks against the same dest", async () => {
    const t = await tone;
    const dest = {} as AudioNode;
    for (let i = 0; i < 5; i++) {
      t.setNow(i * 5);
      pluckString(dest, 220, i * 5);
    }
    expect(t.spies.triggerAttackRelease).toHaveBeenCalledTimes(5);
    expect(t.spies.ctorSpy.mock.calls.length).toBeLessThan(5);
  });

  it("cancel() does not dispose the pooled voice", async () => {
    const t = await tone;
    const h = pluckString({} as AudioNode, 220, 0);
    h.cancel();
    expect(t.spies.dispose).not.toHaveBeenCalled();
  });

  it("cancel() is idempotent", async () => {
    const t = await tone;
    const h = pluckString({} as AudioNode, 220, 0);
    expect(() => h.cancel()).not.toThrow();
    expect(() => h.cancel()).not.toThrow();
    expect(t.spies.dispose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to confirm they pass**

Run: `pnpm run test -- src/progressions/audio/string.test.ts`

Expected: All tests pass.

- [ ] **Step 4: Run the full test suite to check for regressions**

Run: `pnpm run test`

Expected: All tests pass. No regressions in strumVoice tests or any other progression audio tests.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint`

Expected: No errors.

- [ ] **Step 6: Run build**

Run: `pnpm run build`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/string.ts src/progressions/audio/string.test.ts
git commit -m "feat(audio): replace PluckSynth with warmer Synth-based strum voice"
```
