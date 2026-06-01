# Funk Comp v3 — Root Anchor, Pluck Timbre, Tighter Strum — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the funk guitar comp to a researched chicken-scratch groove (single root note on the one, one plain stab, two syncopated color upstrokes, muted ghost 16ths) played by a Karplus-Strong plucked-guitar synth with a tight strum.

**Architecture:** Three layers. (1) Rhythm/voicing: a four-value `ChordArticulation` (`muted | root | stab | color-stab`) drives the new `funk-scratch` comp and per-hit voicing/duration selection in `buildAllLayers`. (2) Timbre: an optional `pluck` spec on `StrumSpec` routes the strum voice to a `Tone.PluckSynth` wrapped in a velocity gain stage (PluckSynth ignores velocity). (3) Feel: a per-spec `strumLagSec` tightens the funk strum. The funk patch wires (2)+(3); other genres are untouched.

**Tech Stack:** TypeScript, Vitest, Tone.js 15.1.22 (`PluckSynth`, `Gain` both verified present). Pure theory reuses `extendFunkVoicing`/`resolveChordVoicing`.

**Spec:** `docs/superpowers/specs/2026-05-31-funk-comp-v3-root-pluck-design.md`

---

## File Structure

- `src/progressions/audio/patterns.ts` — `ChordArticulation` (4 values) + `funk-scratch` comp (Task 1).
- `src/progressions/audio/buildAllLayers.ts` — `ROOT_STRUM_DURATION_SEC`, per-articulation voicing + duration selection (Task 1).
- `src/progressions/audio/sound/patchTypes.ts` — `PluckSpec`, optional `oscillator`/`envelope`, `pluck?`, `strumLagSec?` on `StrumSpec` (Task 2).
- `src/progressions/audio/string.ts` — `StrumPlayableVoice` interface, pluck-voice wrapper, synth-vs-pluck factory branch (Task 2).
- `src/progressions/audio/instruments/strumVoice.ts` — per-spec strum lag override (Task 3).
- `src/progressions/audio/sound/instrumentPatches.ts` — `chord-funk-scratch` → pluck + `strumLagSec` (Task 4).
- Test siblings updated/added in each task; new `src/progressions/audio/string.pluck.test.ts` (Task 2).

---

## Task 1: v3 articulation model — comp + voicing/duration selection

Tightly coupled: the new comp's articulations are only meaningful once `buildAllLayers` switches on them, and the existing `buildAllLayers` funk tests reference the comp. Done as one task to keep the suite green.

**Files:**
- Modify: `src/progressions/audio/patterns.ts` (`ChordArticulation` ~line 16; `ChordHit.articulation` doc comment ~39-43; `funk-scratch` comp)
- Modify: `src/progressions/audio/buildAllLayers.ts` (`ROOT_STRUM_DURATION_SEC` const near line 84; `spicyVoicing`/`hasStabHit` block ~187-194; `chordStrums.push` voicing+duration ~230-243)
- Test: `src/progressions/audio/patterns.test.ts` (`describe("funk-scratch chord comp")`)
- Test: `src/progressions/audio/buildAllLayers.test.ts` (replace the two "spicy"/"root-octave" cases; add root + duration cases)

- [ ] **Step 1: Update patterns.test.ts funk-scratch tests**

Replace the entire `describe("funk-scratch chord comp", ...)` block with:

```ts
describe("funk-scratch chord comp", () => {
  const funk = getChordPattern("funk-scratch")!;

  it("accents the one hardest", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h.velocity]));
    const one = byBeat.get(0)!;
    for (const h of funk.hits) {
      if (h.beat !== 0) expect(h.velocity).toBeLessThan(one);
    }
  });

  it("anchors the one with a single root note (not a strummed chord)", () => {
    const byBeat = new Map(funk.hits.map((h) => [h.beat, h]));
    expect(byBeat.get(0)!.articulation).toBe("root");
    expect(byBeat.get(0)!.direction).toBe("down");
  });

  it("has exactly one plain stab and two color-stabs on offbeat upstrokes", () => {
    const stabs = funk.hits.filter((h) => h.articulation === "stab");
    const colors = funk.hits.filter((h) => h.articulation === "color-stab");
    expect(stabs).toHaveLength(1);
    expect(colors).toHaveLength(2);
    expect(colors.map((c) => c.beat).sort((a, b) => a - b)).toEqual([2.5, 3.5]);
    for (const c of colors) {
      expect(c.beat % 1).toBeCloseTo(0.5); // syncopated upbeats (the "&")
      expect(c.direction).toBe("up");
    }
  });

  it("fills the rest with muted ghost scratches", () => {
    expect(funk.hits.some((h) => h.articulation === "muted")).toBe(true);
  });
});
```

- [ ] **Step 2: Run patterns test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts -t "funk-scratch chord comp"`
Expected: FAIL — current beat-0 is `"stab"`, no `"root"`/`"color-stab"` values exist.

- [ ] **Step 3: Widen the articulation type + doc comment**

In `src/progressions/audio/patterns.ts` line 16:

```ts
export type ChordArticulation = "muted" | "root" | "stab" | "color-stab";
```

Replace the `ChordHit.articulation` doc comment (~lines 39-43) with:

```ts
  /** Note-length + voicing intent for the strum voice.
   *  "root" plays a single root note (anchor); "stab" rings a plain chord;
   *  "color-stab" rings a chord with funk extensions; "muted" chokes a plain
   *  chord short (chicken-scratch ghost). Omitted rings the patch default. */
  articulation?: ChordArticulation;
```

- [ ] **Step 4: Rewrite the funk-scratch comp**

Replace the entire `funk-scratch` object with:

```ts
  {
    id: "funk-scratch",
    label: "Funk Scratch",
    // Researched chicken-scratch (Jimmy Nolen / James Brown): a single root-note
    // anchor on the one, one plain chord stab on the 2, then two syncopated
    // color (extended) upstroke stabs on the "&" of 3 and "&" of 4, with muted
    // ghost 16ths weaving between. Down on numbers/"&", up on "e"/"a".
    hits: [
      { beat: 0, velocity: 0.9, direction: "down", articulation: "root" },
      { beat: 0.5, velocity: 0.24, direction: "down", articulation: "muted" },
      { beat: 0.75, velocity: 0.22, direction: "up", articulation: "muted" },
      { beat: 1.0, velocity: 0.85, direction: "down", articulation: "stab" },
      { beat: 1.5, velocity: 0.24, direction: "down", articulation: "muted" },
      { beat: 1.75, velocity: 0.22, direction: "up", articulation: "muted" },
      { beat: 2.25, velocity: 0.2, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.8, direction: "up", articulation: "color-stab" },
      { beat: 2.75, velocity: 0.22, direction: "up", articulation: "muted" },
      { beat: 3.25, velocity: 0.2, direction: "up", articulation: "muted" },
      { beat: 3.5, velocity: 0.82, direction: "up", articulation: "color-stab" },
      { beat: 3.75, velocity: 0.2, direction: "up", articulation: "muted" },
    ],
  },
```

- [ ] **Step 5: Run patterns test to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts`
Expected: PASS.

- [ ] **Step 6: Add ROOT_STRUM_DURATION_SEC to buildAllLayers**

In `src/progressions/audio/buildAllLayers.ts`, just below the existing `export const STAB_STRUM_DURATION_SEC = 0.4;` declaration, add:

```ts
/** Note length (seconds) for the single root-note anchor on the one — a short,
 *  tight pluck, longer than a muted ghost but well short of a ringing stab. */
export const ROOT_STRUM_DURATION_SEC = 0.12;
```

- [ ] **Step 7: Replace the spicy-voicing computation block**

In `src/progressions/audio/buildAllLayers.ts`, replace this block:

```ts
    const hasStabHit = !!chordPattern?.hits.some((h) => h.articulation === "stab");
    const spicyVoicing = hasStabHit
      ? extendFunkVoicing(resolveChordVoicing(root, quality), root, quality)
      : voicing;
```

with:

```ts
    // The plain (non-voice-led) voicing is the register-safe base for funk
    // extensions AND the source of the single-note root anchor. Computed only
    // when the pattern needs it (a color-stab or root hit), to avoid a second
    // resolveChordVoicing call on non-funk patterns.
    const needsPlainVoicing = !!chordPattern?.hits.some(
      (h) => h.articulation === "color-stab" || h.articulation === "root",
    );
    const plainVoicing = needsPlainVoicing
      ? resolveChordVoicing(root, quality)
      : voicing;
    const spicyVoicing = needsPlainVoicing
      ? extendFunkVoicing(plainVoicing, root, quality)
      : voicing;
    const rootNoteVoicing =
      needsPlainVoicing && plainVoicing.length > 0 ? [plainVoicing[0]] : voicing;
```

- [ ] **Step 8: Update the per-hit voicing + duration selection**

In the `chordStrums.push({ ... value: { ... } })` block, replace the `voicing:` line:

```ts
              voicing:
                hit.articulation === "color-stab"
                  ? spicyVoicing
                  : hit.articulation === "root"
                    ? rootNoteVoicing
                    : voicing,
```

and replace the `durationSec:` ternary:

```ts
              durationSec:
                hit.articulation === "muted"
                  ? MUTED_STRUM_DURATION_SEC
                  : hit.articulation === "root"
                    ? ROOT_STRUM_DURATION_SEC
                    : hit.articulation === "stab" || hit.articulation === "color-stab"
                      ? STAB_STRUM_DURATION_SEC
                      : undefined,
```

- [ ] **Step 9: Replace the two buildAllLayers funk tests + add coverage**

In `src/progressions/audio/buildAllLayers.test.ts`, update the import on line 2 to add `ROOT_STRUM_DURATION_SEC`:

```ts
import {
  buildAllLayersAsync,
  articulationToDurationSec,
  MUTED_STRUM_DURATION_SEC,
  STAB_STRUM_DURATION_SEC,
  ROOT_STRUM_DURATION_SEC,
} from "./buildAllLayers";
```

Replace the two existing cases — `it("gives funk stab hits the spicy (extended) voicing while ghosts stay plain", ...)` and `it("keeps funk stab spice in the root-octave register regardless of the previous chord", ...)` — with:

```ts
  it("voices funk hits by articulation: root=1 note, stab=plain, color-stab=spicy", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } })],
    });
    // tempo 60 => 1 beat = 1s, so hit time === beat.
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.voicing).toEqual(["C3"]); // root anchor on the one
    expect(at(1).value.voicing).toEqual(["C3", "E3", "G3"]); // plain stab on 2
    expect(at(2.5).value.voicing).toEqual(["C3", "E3", "G3", "A#3", "D4"]); // color-stab (dom9)
  });

  it("maps funk durations: root short, stab/color ring, ghost chokes", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [step({ duration: { value: 1, unit: "bar" } })],
    });
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.durationSec).toBe(ROOT_STRUM_DURATION_SEC);
    expect(at(1).value.durationSec).toBe(STAB_STRUM_DURATION_SEC);
    expect(at(2.5).value.durationSec).toBe(STAB_STRUM_DURATION_SEC);
    expect(
      out.chordStrums.some((s) => s.value.durationSec === MUTED_STRUM_DURATION_SEC),
    ).toBe(true);
  });

  it("keeps funk color-stab spice in the root-octave register regardless of the previous chord", async () => {
    // Regression guard: color-stab spice is built from the NON-voice-led plain
    // voicing, so extensions never drift below the chord on later bars.
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [
        step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } }),
        step({ id: "b", index: 1, root: "F", quality: "M", duration: { value: 1, unit: "bar" } }),
      ],
    });
    // Bar 2 starts at time 4; its color-stab on the "&" of 3 is at time 6.5.
    const bar2Color = out.chordStrums.find((s) => s.time === 6.5)!;
    expect(bar2Color.value.voicing).toEqual(["F3", "A3", "C4", "D#4", "G4"]);
  });
```

- [ ] **Step 10: Run buildAllLayers suite + typecheck**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS.
Run: `pnpm exec tsc -b`
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): funk comp v3 — root anchor + plain stab + color upstrokes

Add root/color-stab articulations. New funk-scratch: single root note on the
one, one plain stab on 2, two syncopated color upstrokes on the & of 3/4,
muted ghost 16ths between. buildAllLayers voices + times each per articulation."
```

---

## Task 2: Pluck-synth strum voice (Karplus-Strong + velocity gain)

**Files:**
- Modify: `src/progressions/audio/sound/patchTypes.ts` (`PluckSpec`; `StrumSpec` optional `oscillator`/`envelope` + `pluck?` + `strumLagSec?`)
- Modify: `src/progressions/audio/string.ts` (`StrumPlayableVoice`, pluck wrapper, factory branch, optional-chaining fix)
- Test: `src/progressions/audio/string.pluck.test.ts` (new — own Tone mock)

**Context:** `Tone.PluckSynth.triggerAttack(note, time)` ignores velocity, so the pluck voice must scale velocity via a `Tone.Gain` stage. The voice pool is generic over `{ connect; dispose }`; `string.ts` already calls `voice.triggerAttackRelease(...)`, so both `Tone.Synth` and the wrapper satisfy a shared `StrumPlayableVoice` shape.

- [ ] **Step 1: Write the failing pluck test (new file)**

Create `src/progressions/audio/string.pluck.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const spies = vi.hoisted(() => ({
  pluckCtor: vi.fn(),
  pluckTAR: vi.fn(),
  gainCtor: vi.fn(),
  gainSet: vi.fn(),
  synthCtor: vi.fn(),
}));

vi.mock("tone", () => {
  class PluckSynth {
    constructor(opts: unknown) { spies.pluckCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease(...args: unknown[]) { spies.pluckTAR(...args); return this; }
  }
  class Gain {
    gain = { setValueAtTime: (...a: unknown[]) => spies.gainSet(...a) };
    constructor(v: unknown) { spies.gainCtor(v); }
    connect() { return this; }
    dispose() {}
  }
  class Synth {
    constructor(opts: unknown) { spies.synthCtor(opts); }
    connect() { return this; }
    dispose() {}
    triggerAttackRelease() { return this; }
  }
  return { PluckSynth, Gain, Synth, gainToDb: (v: number) => v, now: () => 0 };
});

import { pluckString } from "./string";
import type { StrumSpec } from "./sound/patchTypes";

const pluckSpec: StrumSpec = {
  pluck: { attackNoise: 1.2, dampening: 4500, resonance: 0.55, release: 0.12 },
  noteDurationSec: 0.18,
  releaseTailSec: 0.4,
};

describe("pluckString — Tone.PluckSynth backend", () => {
  beforeEach(() => {
    spies.pluckCtor.mockClear();
    spies.pluckTAR.mockClear();
    spies.gainCtor.mockClear();
    spies.gainSet.mockClear();
    spies.synthCtor.mockClear();
  });

  it("constructs a PluckSynth (not a Synth) from a pluck spec", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: pluckSpec });
    expect(spies.pluckCtor).toHaveBeenCalledTimes(1);
    expect(spies.pluckCtor.mock.calls[0]![0]).toMatchObject({
      attackNoise: 1.2, dampening: 4500, resonance: 0.55, release: 0.12,
    });
    expect(spies.synthCtor).not.toHaveBeenCalled();
  });

  it("scales velocity via a gain stage at trigger time (PluckSynth ignores velocity)", () => {
    pluckString({} as AudioNode, 220, 0, { velocity: 0.7, spec: pluckSpec });
    expect(spies.gainCtor).toHaveBeenCalledTimes(1);
    expect(spies.gainSet).toHaveBeenCalledWith(0.7, 0);
    // synth gets (freq, duration, time) — velocity is NOT forwarded to the synth.
    expect(spies.pluckTAR).toHaveBeenCalledTimes(1);
    const [freq, duration, time] = spies.pluckTAR.mock.calls[0]!;
    expect(Number(freq)).toBeCloseTo(220, 1);
    expect(duration).toBeCloseTo(0.18, 3);
    expect(time).toBeCloseTo(0, 3);
  });

  it("falls back to a Tone.Synth when the spec has no pluck", () => {
    pluckString({} as AudioNode, 220, 0, {
      velocity: 0.7,
      spec: { noteDurationSec: 0.18, releaseTailSec: 0.4 } as StrumSpec,
    });
    expect(spies.synthCtor).toHaveBeenCalledTimes(1);
    expect(spies.pluckCtor).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/audio/string.pluck.test.ts`
Expected: FAIL — `string.ts` never constructs `PluckSynth`/`Gain` (pluckCtor not called); also a type error on `pluck` not existing on `StrumSpec`.

- [ ] **Step 3: Extend StrumSpec in patchTypes.ts**

In `src/progressions/audio/sound/patchTypes.ts`, replace the `StrumSpec` interface and add `PluckSpec` above it:

```ts
/** Karplus-Strong pluck params (Tone.PluckSynth). Present instead of
 *  oscillator/envelope for genuinely plucked-string (guitar) strum patches. */
export interface PluckSpec {
  attackNoise: number; // pick noise at attack (~0.1..20)
  dampening: number;   // comb lowpass cutoff (Hz) — brightness
  resonance: number;   // 0..1 ring/sustain
  release: number;     // resonance ramp-down on note-off (s)
}

/** Params for the strum/pluck voice. A patch is either subtractive
 *  (oscillator + envelope) or plucked (pluck); `strumLagSec` overrides the
 *  per-note strum stagger. */
export interface StrumSpec {
  oscillator?: { type: "custom"; partials: number[] };
  envelope?: EnvelopeSpec;
  pluck?: PluckSpec;
  noteDurationSec: number;
  releaseTailSec: number;
  strumLagSec?: number;
}
```

- [ ] **Step 4: Add the pluck wrapper + factory branch in string.ts**

In `src/progressions/audio/string.ts`, change the `StrumSpec` import to also import `PluckSpec`:

```ts
import type { StrumSpec, PluckSpec } from "./sound/patchTypes";
```

Replace the `type PluckPool = ...` line and the `makePool` function with:

```ts
/** Shared voice shape the pool leases — satisfied by Tone.Synth and the pluck
 *  wrapper alike. string.ts only ever calls these three. */
interface StrumPlayableVoice {
  connect(dest: AudioNode): unknown;
  dispose(): void;
  triggerAttackRelease(
    frequency: number,
    duration: number,
    time: number,
    velocity?: number,
  ): unknown;
}

/** Karplus-Strong pluck voice. PluckSynth ignores velocity, so a per-voice
 *  Gain stage scales loudness at trigger time. */
function createPluckVoice(pluck: PluckSpec): StrumPlayableVoice {
  const synth = new Tone.PluckSynth({
    attackNoise: pluck.attackNoise,
    dampening: pluck.dampening,
    resonance: pluck.resonance,
    release: pluck.release,
  });
  const gain = new Tone.Gain(0);
  synth.connect(gain);
  return {
    connect: (dest: AudioNode) => gain.connect(dest),
    dispose: () => {
      synth.dispose();
      gain.dispose();
    },
    triggerAttackRelease: (frequency, duration, time, velocity = 1) => {
      gain.gain.setValueAtTime(velocity, time);
      synth.triggerAttackRelease(frequency, duration, time);
    },
  };
}

function createSynthVoice(spec?: StrumSpec): StrumPlayableVoice {
  const oscillator = {
    type: "custom" as const,
    partials: spec?.oscillator?.partials ?? DEFAULT_PARTIALS,
  };
  const envelope = spec?.envelope ?? {
    attack: DEFAULT_ATTACK, decay: DEFAULT_DECAY, sustain: DEFAULT_SUSTAIN, release: DEFAULT_RELEASE,
  };
  return new Tone.Synth({ oscillator, envelope });
}

type PluckPool = ReturnType<typeof createReusableVoicePool<StrumPlayableVoice>>;

function makePool(spec?: StrumSpec): PluckPool {
  return createReusableVoicePool<StrumPlayableVoice>({
    createVoice: () => (spec?.pluck ? createPluckVoice(spec.pluck) : createSynthVoice(spec)),
  });
}
```

(`pluckString` is unchanged — it already calls `lease.voice.triggerAttackRelease(frequency, noteDuration, startTime, velocity)`, which both voice kinds satisfy.)

- [ ] **Step 5: Run the new test + the existing string suite + typecheck**

Run: `pnpm vitest run src/progressions/audio/string.pluck.test.ts src/progressions/audio/string.test.ts`
Expected: PASS (existing Tone.Synth tests still green — subtractive path unchanged; `spec?.oscillator?.partials` optional-chaining keeps the default-pool behavior identical).
Run: `pnpm exec tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/sound/patchTypes.ts src/progressions/audio/string.ts src/progressions/audio/string.pluck.test.ts
git commit -m "feat(progressions): Karplus-Strong pluck strum voice with velocity gain

Add optional PluckSpec to StrumSpec; route the strum voice to a Tone.PluckSynth
wrapped in a per-voice Gain stage (PluckSynth ignores velocity). Subtractive
Tone.Synth path unchanged for non-pluck patches."
```

---

## Task 3: Per-spec strum lag (tighter funk strum)

**Files:**
- Modify: `src/progressions/audio/instruments/strumVoice.ts` (use `spec?.strumLagSec ?? STRUM_LAG_SECONDS`)
- Test: `src/progressions/audio/instruments/strumVoice.test.ts` (add override case)

**Context:** `strumLagSec` was added to `StrumSpec` in Task 2. `createStrumVoice(spec)` already receives the patch's strum spec.

- [ ] **Step 1: Write the failing test**

In `src/progressions/audio/instruments/strumVoice.test.ts`, add an import for the type at the top (after the existing imports):

```ts
import type { StrumSpec } from "../sound/patchTypes";
```

Add this case inside `describe("strumVoice", ...)`:

```ts
  it("uses the spec's strumLagSec override for the per-note stagger", () => {
    const spec: StrumSpec = { strumLagSec: 0.005, noteDurationSec: 0.18, releaseTailSec: 0.4 };
    const tight = createStrumVoice(spec);
    tight.scheduleChord({} as AudioNode, ["C3", "E3", "G3"], 0, { velocity: 0.8 });
    // pluckString(dest, freq, time, options) — time is arg[2].
    const times = pluckStringSpy.mock.calls.map((c) => c[2]);
    expect(times).toEqual([0, 0.005, 0.01]);
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run src/progressions/audio/instruments/strumVoice.test.ts -t "strumLagSec"`
Expected: FAIL — staggers are `[0, 0.018, 0.036]` (the hardcoded constant).

- [ ] **Step 3: Honor the override in strumVoice.ts**

In `src/progressions/audio/instruments/strumVoice.ts`, replace the function body so the lag is resolved once from the spec:

```ts
export function createStrumVoice(spec?: StrumSpec): ChordVoice {
  const lagSeconds = spec?.strumLagSec ?? STRUM_LAG_SECONDS;
  return {
    scheduleChord(dest: AudioNode, notes: readonly string[], time: number, options: ChordVoiceOptions): VoiceHandle {
      const ordered = options.direction === "up" ? [...notes].reverse() : notes;
      const voices = ordered.map((note, i) => {
        const freq = getNoteFrequency(note);
        if (!Number.isFinite(freq) || freq <= 0) return null;
        return pluckString(dest, freq, time + i * lagSeconds, { velocity: options.velocity, spec, durationSec: options.durationSec });
      }).filter(Boolean) as Array<{ cancel: () => void }>;
      return { cancel: () => { for (const v of voices) v.cancel(); } };
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/progressions/audio/instruments/strumVoice.test.ts`
Expected: PASS (the existing "staggers by STRUM_LAG_SECONDS" default test still passes — no spec → falls back to 0.018).
Run: `pnpm exec tsc -b`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/instruments/strumVoice.ts src/progressions/audio/instruments/strumVoice.test.ts
git commit -m "feat(progressions): per-spec strum lag override

createStrumVoice honors StrumSpec.strumLagSec, falling back to STRUM_LAG_SECONDS.
Lets the funk patch tighten its strum without affecting other genres."
```

---

## Task 4: Wire the funk patch to pluck + tight strum

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (`chord-funk-scratch` strum block)
- Test: `src/progressions/audio/sound/instrumentPatches.test.ts` (replace the funk patch test)

**Context:** With Tasks 2-3 in place, the funk patch swaps its `oscillator`/`envelope` for a `pluck` spec and sets a tight `strumLagSec`. `noteDurationSec`/`releaseTailSec`/`insert` stay (the genreMixPresets `noteDurationSec ≤ 0.3` guard still holds).

- [ ] **Step 1: Replace the funk patch test**

In `src/progressions/audio/sound/instrumentPatches.test.ts`, replace the `it("provides a funk scratch guitar patch that can both choke and ring", ...)` block with:

```ts
  it("provides a Karplus-Strong funk scratch guitar patch with a tight strum", () => {
    const patch = getChordPatch("chord-funk-scratch")!;
    expect(patch).toBeDefined();
    expect(patch.family).toBe("strum");
    // Root-cause guard: funk uses a plucked-string synth, not the sustained
    // subtractive synth that read as piano. A pluck spec must be present.
    expect(patch.strum!.pluck).toBeDefined();
    expect(patch.strum!.pluck!.resonance).toBeGreaterThan(0);
    expect(patch.strum!.pluck!.resonance).toBeLessThan(1);
    // Tight strum so the chord reads as a single stab, not a spread strum.
    expect(patch.strum!.strumLagSec).toBeLessThanOrEqual(0.01);
    // Default note duration stays short (the genre short-decay guard).
    expect(patch.strum!.noteDurationSec).toBeLessThanOrEqual(0.3);
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts -t "funk scratch"`
Expected: FAIL — the patch currently has `oscillator`/`envelope`, no `pluck`, no `strumLagSec`.

- [ ] **Step 3: Rework the funk patch**

In `src/progressions/audio/sound/instrumentPatches.ts`, replace the `chord-funk-scratch` `strum` block (the `oscillator`/`envelope`/`noteDurationSec`/`releaseTailSec` object) with:

```ts
    strum: {
      // Karplus-Strong single-coil funk guitar: a real plucked string (bright
      // pick attack via attackNoise, moderate resonance so stabs ring but don't
      // bloom) rather than a sustained subtractive synth. Hold duration
      // (durationSec) chokes ghosts vs. rings stabs. Tight strumLagSec so the
      // chord lands as a single stab. Velocity is scaled by string.ts's gain
      // stage (PluckSynth itself ignores velocity).
      pluck: { attackNoise: 1.2, dampening: 4500, resonance: 0.55, release: 0.12 },
      noteDurationSec: 0.18,
      releaseTailSec: 0.4,
      strumLagSec: 0.007,
    },
```

(Leave the `id`/`label`/`family` line and the `insert: { eq3: ... }` line unchanged.)

- [ ] **Step 4: Run patch + mix-preset suites + typecheck**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS (genreMixPresets "funk's chord patch is short-decay" still holds — `noteDurationSec` is 0.18).
Run: `pnpm exec tsc -b`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/sound/instrumentPatches.test.ts
git commit -m "feat(progressions): funk scratch patch = Karplus-Strong pluck + tight strum

Swap the funk chord patch from a subtractive synth to a Tone.PluckSynth pluck
spec (guitar, not piano) and tighten strumLagSec to 0.007 so the chord reads as
a single stab."
```

---

## Task 5: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: pass.

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: pass — all suites green; no remaining references to the old funk envelope/`"stab"`-only model.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` exit 0 + vite build success.

- [ ] **Step 4: Confirm clean tree**

Run: `git status --porcelain`
Expected: empty.

---

## Self-Review

**Spec coverage:**
- §1 Articulation model (`muted|root|stab|color-stab`) → Task 1. ✓
- §2 New funk-scratch rhythm (root@1, stab@2, color upstrokes@2.5/3.5, ghosts) → Task 1. ✓
- §3 Pluck timbre + velocity gain stage + optional oscillator/envelope → Task 2. ✓
- §4 Tighter per-spec strum lag → Task 3 (consumed) + funk value in Task 4. ✓
- §5 Data flow (root→1-note, color-stab→spicy, stab/muted→plain; root/muted/stab/color-stab durations) → Task 1. ✓
- §6 Guards: comp shape (T1), voicing-by-articulation (T1), duration mapping (T1), register regression (T1), pluck routing (T2), pluck velocity (T2), strum-lag override (T3), funk patch pluck + tight lag (T4). ✓

**Placeholder scan:** none — every code/test step shows complete code and exact commands.

**Type consistency:** `ChordArticulation` value `"color-stab"`/`"root"` (T1) used identically in `buildAllLayers` selection (T1). `ROOT_STRUM_DURATION_SEC` exported in T1, imported in its test. `PluckSpec`/`StrumSpec.pluck`/`strumLagSec` defined in T2, consumed in T3 (`strumLagSec`) and T4 (`pluck`,`strumLagSec`). `StrumPlayableVoice.triggerAttackRelease(freq,dur,time,velocity?)` matches the `pluckString` call. `createPluckVoice(pluck: PluckSpec)` matches `spec.pluck`. Funk patch keeps `family: "strum"` + `strum.noteDurationSec` so the existing genreMixPresets guard holds. ✓
