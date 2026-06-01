# Bossa-Nova Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `bossa-nova` genre sound idiomatically bossa — a 2-bar son-clave on a new cross-stick voice, a root–fifth surdo bassline, and a syncopated partido-alto comp — via a general opt-in 2-bar pattern-cell mechanism.

**Architecture:** Add an optional `bars` field (default 1) to the chord/bass/drum pattern types; a pure `sliceCellToBar` helper selects one bar of a multi-bar cell keyed by the scheduler's existing monotonic `absoluteBar`. A new `crossStick` drum voice (a short MembraneSynth click) carries the clave. 1-bar patterns never enter the new path, so every other genre stays byte-identical.

**Tech Stack:** TypeScript, React 19, Tone.js, Vitest + Testing Library. Package manager is **pnpm**. Tests are co-located (`*.test.ts` beside source).

**Spec:** `docs/superpowers/specs/2026-06-01-bossa-nova-overhaul-design.md`

---

## File-by-file map

- `src/progressions/audio/patterns.ts` — add `bars?: number` to `ChordPattern`, `CatalogBassPattern`, `CatalogDrumPattern`; add `crossStick?: readonly DrumHit[]` to `CatalogDrumPattern`; add `sliceCellToBar`; rewrite `bossa` drum pattern; add `bossa` bass + `bossa-comp` chord patterns.
- `src/progressions/audio/drumKit.ts` — add `scheduleCrossStick` + its voice pool.
- `src/progressions/audio/sound/patchTypes.ts` — add `crossStick` to `DrumVoiceParams`.
- `src/progressions/audio/sound/instrumentPatches.ts` — add `crossStick` override to `kit-bossa`.
- `src/progressions/audio/buildAllLayers.ts` — add `"crossStick"` to `DrumVoice`; handle it in `collectDrumHits`; apply `bars`-aware slicing in the chord/bass/drum loops.
- `src/progressions/audio/progressionAudioEngine.ts` — re-export `scheduleCrossStick`.
- `src/progressions/audio/genres.ts` — re-wire the `bossa-nova` row.
- `src/hooks/useProgressionAudioPlayback.ts` — add the `crossStick` drum-dispatch case.

---

## Task 1: Pattern-cell data model — `bars` field, `crossStick` field, `sliceCellToBar`

**Files:**
- Modify: `src/progressions/audio/patterns.ts`
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/patterns.test.ts`. Add `sliceCellToBar` to the existing import block from `"./patterns"` first (it currently imports `repeatPatternToBeats`, etc.), then add this `describe`:

```ts
describe("sliceCellToBar", () => {
  // A 2-bar cell in 4/4: beats 0..7.99. Bar 1 = [0,4), bar 2 = [4,8).
  const CELL = [
    { beat: 0, velocity: 0.8 },
    { beat: 1.5, velocity: 0.7 },
    { beat: 3, velocity: 0.75 },
    { beat: 5, velocity: 0.7 },
    { beat: 6, velocity: 0.8 },
  ];

  it("returns bar 1 hits with original beats for cellBarIndex 0", () => {
    expect(sliceCellToBar(CELL, 0, 4)).toEqual([
      { beat: 0, velocity: 0.8 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 3, velocity: 0.75 },
    ]);
  });

  it("returns bar 2 hits shifted back by beatsPerBar for cellBarIndex 1", () => {
    expect(sliceCellToBar(CELL, 1, 4)).toEqual([
      { beat: 1, velocity: 0.7 },
      { beat: 2, velocity: 0.8 },
    ]);
  });

  it("returns an empty array for an out-of-range cellBarIndex", () => {
    expect(sliceCellToBar(CELL, 2, 4)).toEqual([]);
  });

  it("preserves extra hit fields (only the beat is shifted)", () => {
    const typed = [{ beat: 5, velocity: 0.5, type: "crossStick" as const }];
    expect(sliceCellToBar(typed, 1, 4)).toEqual([
      { beat: 1, velocity: 0.5, type: "crossStick" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t sliceCellToBar`
Expected: FAIL — `sliceCellToBar is not a function` (also a TS/import error on the missing export).

- [ ] **Step 3: Add the `bars` and `crossStick` fields to the interfaces**

In `src/progressions/audio/patterns.ts`, add an optional `bars` to all three pattern interfaces and `crossStick` to the drum one. Replace the three interface blocks:

```ts
export interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
  /** Cell length in bars (default 1). When > 1, `hits` span 0..bars*beatsPerBar
   *  and the scheduler selects one bar per `absoluteBar % bars`. */
  bars?: number;
}
```

```ts
export interface CatalogBassPattern {
  id: string;
  label: string;
  hits: readonly CatalogBassHit[];
  /** Cell length in bars (default 1). See ChordPattern.bars. */
  bars?: number;
}
```

```ts
export interface CatalogDrumPattern {
  id: string;
  label: string;
  kicks: readonly DrumHit[];
  snares: readonly DrumHit[];
  hats: readonly DrumHit[];
  openHats?: readonly DrumHit[];
  ride?: readonly DrumHit[];
  /** Cross-stick / rim-click voice (bossa clave). */
  crossStick?: readonly DrumHit[];
  /** Cell length in bars (default 1). See ChordPattern.bars. */
  bars?: number;
}
```

- [ ] **Step 4: Implement `sliceCellToBar`**

In `src/progressions/audio/patterns.ts`, add this directly above the existing `repeatPatternToBeats` function (keep `repeatPatternToBeats` unchanged):

```ts
/**
 * Select the hits belonging to a single bar of a multi-bar pattern cell and
 * shift them back to bar-local beats (0..beatsPerBar). `cellBarIndex` is
 * `absoluteBar % bars`. Pure — used for 2-bar patterns (e.g. the bossa clave);
 * 1-bar patterns never call this (they keep the `repeatPatternToBeats` path).
 */
export function sliceCellToBar<T extends { beat: number }>(
  hits: readonly T[],
  cellBarIndex: number,
  beatsPerBar: number,
): T[] {
  const offset = cellBarIndex * beatsPerBar;
  return hits
    .filter((h) => h.beat >= offset && h.beat < offset + beatsPerBar)
    .map((h) => ({ ...h, beat: h.beat - offset }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t sliceCellToBar`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): pattern-cell data model — bars field + sliceCellToBar (Slice 2 §3.5)"
```

---

## Task 2: The three bossa patterns (data + resolution tests)

**Files:**
- Modify: `src/progressions/audio/patterns.ts`
- Test: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/patterns.test.ts`:

```ts
describe("bossa patterns", () => {
  it("rewrites the bossa drum pattern as a 2-bar cell with a son-clave cross-stick", () => {
    const bossa = getDrumPattern("bossa")!;
    expect(bossa.bars).toBe(2);
    expect(bossa.snares).toEqual([]); // cross-stick carries the rhythm
    expect(bossa.crossStick?.map((h) => h.beat)).toEqual([0, 1.5, 3, 5, 6]);
  });

  it("adds a 1-bar root-fifth bossa bass pattern", () => {
    const bass = getBassPattern("bossa")!;
    expect(bass.bars ?? 1).toBe(1);
    expect(bass.hits.map((h) => h.note)).toEqual(["root", "fifth"]);
  });

  it("adds a 2-bar syncopated bossa comp chord pattern", () => {
    const comp = getChordPattern("bossa-comp")!;
    expect(comp.bars).toBe(2);
    expect(comp.hits.map((h) => h.beat)).toEqual([0, 1.5, 3, 4.5, 6, 7.5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "bossa patterns"`
Expected: FAIL — `getChordPattern("bossa-comp")` returns `undefined` (and the existing `bossa` drum pattern has a `snares` array, so `toEqual([])` fails).

- [ ] **Step 3: Rewrite the `bossa` drum pattern**

In `src/progressions/audio/patterns.ts`, replace the existing `bossa` entry in `DRUM_PATTERNS` (the block `{ id: "bossa", label: "Bossa Nova", kicks: [...], snares: [...], hats: EIGHTH_HATS }`) with:

```ts
  {
    id: "bossa",
    label: "Bossa Nova",
    bars: 2,
    // Soft surdo heartbeat: beats 1 & 3 of each bar.
    kicks: [
      { beat: 0, velocity: 0.5 },
      { beat: 2, velocity: 0.6 },
      { beat: 4, velocity: 0.5 },
      { beat: 6, velocity: 0.6 },
    ],
    // No backbeat snare — the cross-stick clave carries the rhythm.
    snares: [],
    // Straight 8th hats across both bars (beats 0..7.5).
    hats: [
      { beat: 0, velocity: 0.4 }, { beat: 0.5, velocity: 0.3 },
      { beat: 1, velocity: 0.4 }, { beat: 1.5, velocity: 0.3 },
      { beat: 2, velocity: 0.4 }, { beat: 2.5, velocity: 0.3 },
      { beat: 3, velocity: 0.4 }, { beat: 3.5, velocity: 0.3 },
      { beat: 4, velocity: 0.4 }, { beat: 4.5, velocity: 0.3 },
      { beat: 5, velocity: 0.4 }, { beat: 5.5, velocity: 0.3 },
      { beat: 6, velocity: 0.4 }, { beat: 6.5, velocity: 0.3 },
      { beat: 7, velocity: 0.4 }, { beat: 7.5, velocity: 0.3 },
    ],
    // 3-2 son clave: bar 1 @ 0, 1.5, 3 · bar 2 @ 5 (bar2 beat 1), 6 (bar2 beat 2).
    crossStick: [
      { beat: 0, velocity: 0.8 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 3, velocity: 0.75 },
      { beat: 5, velocity: 0.7 },
      { beat: 6, velocity: 0.8 },
    ],
  },
```

- [ ] **Step 4: Add the bossa bass pattern**

In `src/progressions/audio/patterns.ts`, add this entry to the `BASS_PATTERNS` array (after the `funk-syncopated` entry, before the closing `]`):

```ts
  {
    id: "bossa",
    label: "Bossa Nova",
    // Root–fifth surdo (tonic–dominant alternation) — the recognizable bossa
    // pulse. The clave lock comes from the drums + comp; this stays 1-bar.
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 2, velocity: 0.8, note: "fifth", articulation: "legato" },
    ],
  },
```

- [ ] **Step 5: Add the bossa comp chord pattern**

In `src/progressions/audio/patterns.ts`, add this entry to the `CHORD_PATTERNS` array (after the `straight-quarters` entry, before the closing `]`):

```ts
  {
    id: "bossa-comp",
    label: "Bossa Comp",
    bars: 2,
    // Syncopated partido-alto: clave-locked anticipations that leave space.
    hits: [
      // bar 1
      { beat: 0, velocity: 0.7 },
      { beat: 1.5, velocity: 0.6 },
      { beat: 3, velocity: 0.55 },
      // bar 2: anticipated "& of 1" push, mid-bar, "& of 4" lead into the next phrase
      { beat: 4.5, velocity: 0.6 },
      { beat: 6, velocity: 0.6 },
      { beat: 7.5, velocity: 0.7 },
    ],
  },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "bossa patterns"`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): bossa clave drum + root-fifth bass + partido-alto comp patterns (Slice 2 §3.5)"
```

---

## Task 3: Cross-stick voice synthesis (`scheduleCrossStick`)

**Files:**
- Modify: `src/progressions/audio/sound/patchTypes.ts`
- Modify: `src/progressions/audio/drumKit.ts`
- Test: `src/progressions/audio/drumKit.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/progressions/audio/drumKit.test.ts`, add `scheduleCrossStick` to the destructured `import("./drumKit")` declarations and the `beforeEach` import assignment (mirror the existing `scheduleKick` plumbing). The declaration block currently reads:

```ts
  let scheduleKick: typeof import("./drumKit").scheduleKick;
  let scheduleSnare: typeof import("./drumKit").scheduleSnare;
  let scheduleHiHat: typeof import("./drumKit").scheduleHiHat;
  let scheduleRide: typeof import("./drumKit").scheduleRide;
```

Add below it:

```ts
  let scheduleCrossStick: typeof import("./drumKit").scheduleCrossStick;
```

And change the `beforeEach` import line from:

```ts
    ({ scheduleKick, scheduleSnare, scheduleHiHat, scheduleRide } =
      await import("./drumKit"));
```

to:

```ts
    ({ scheduleKick, scheduleSnare, scheduleHiHat, scheduleRide, scheduleCrossStick } =
      await import("./drumKit"));
```

Then add this `describe` block inside the outer `describe("drumKit — Tone backend", ...)`:

```ts
  describe("scheduleCrossStick", () => {
    it("constructs a MembraneSynth with a triangle click voice", () => {
      scheduleCrossStick({} as AudioNode, 1.5);
      expect(membraneSpies.ctorSpy).toHaveBeenCalledTimes(1);
      const [opts] = membraneSpies.ctorSpy.mock.calls[0]!;
      expect(opts.oscillator.type).toBe("triangle");
      expect(opts.envelope.sustain).toBe(0);
      expect(opts.envelope.decay).toBeCloseTo(0.06, 3);
    });

    it("triggers a high woody click (G4) at the requested time + velocity", () => {
      scheduleCrossStick({} as AudioNode, 2.5, { velocity: 0.8 });
      expect(membraneSpies.triggerAttackRelease).toHaveBeenCalledTimes(1);
      const [note, , time, velocity] =
        membraneSpies.triggerAttackRelease.mock.calls[0]!;
      expect(note).toBe("G4");
      expect(time).toBeCloseTo(2.5, 3);
      expect(velocity).toBeCloseTo(0.8, 2);
    });

    it("skips zero-velocity hits (no MembraneSynth constructed)", () => {
      scheduleCrossStick({} as AudioNode, 1, { velocity: 0 });
      expect(membraneSpies.ctorSpy).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/drumKit.test.ts -t scheduleCrossStick`
Expected: FAIL — `scheduleCrossStick is not a function`.

- [ ] **Step 3: Add the `crossStick` patch override field**

In `src/progressions/audio/sound/patchTypes.ts`, add a `crossStick` entry to `DrumVoiceParams` (after the `ride` line):

```ts
export interface DrumVoiceParams {
  // Partial overrides per drum voice; merged over the engine defaults.
  kick?: { pitchDecay?: number; octaves?: number; envelope?: Partial<EnvelopeSpec> };
  snare?: { noiseType?: "white" | "pink"; envelope?: Partial<EnvelopeSpec>; volume?: number };
  hihat?: { decay?: number; resonance?: number; octaves?: number };
  openHat?: { decay?: number };
  ride?: { decay?: number; harmonicity?: number; resonance?: number; volume?: number };
  crossStick?: { pitchDecay?: number; octaves?: number; envelope?: Partial<EnvelopeSpec> };
}
```

- [ ] **Step 4: Implement `scheduleCrossStick`**

In `src/progressions/audio/drumKit.ts`, add a dispose window constant next to the others (after the `RIDE_DISPOSE_MS` line):

```ts
const CROSS_STICK_DISPOSE_MS = 120; // cross-stick decay ~60 ms
```

Then add this section at the end of the file (after the Ride section), mirroring `scheduleKick`'s pool + schedule structure:

```ts
// ── Cross-Stick / Rim ────────────────────────────────────────────────────────
// A dry woody "tok" for the bossa clave: a short, high-pitched MembraneSynth
// click. Fully deterministic, no noise generation.
const DEFAULT_CROSS_STICK_ENV = {
  attack: 0.001,
  decay: 0.06,
  sustain: 0,
  release: 0.02,
  attackCurve: "exponential" as const,
};
const crossStickPools = new Map<
  string,
  ReturnType<typeof createReusableVoicePool<Tone.MembraneSynth>>
>();
function crossStickPool(kit?: DrumKitPatch) {
  const key = kitKey(kit);
  const existing = crossStickPools.get(key);
  if (existing) return existing;
  const ov = kit?.voices.crossStick;
  const pool = createReusableVoicePool<Tone.MembraneSynth>({
    createVoice: () =>
      new Tone.MembraneSynth({
        pitchDecay: ov?.pitchDecay ?? 0.008,
        octaves: ov?.octaves ?? 2,
        oscillator: { type: "triangle" },
        envelope: { ...DEFAULT_CROSS_STICK_ENV, ...(ov?.envelope ?? {}) },
      }),
  });
  crossStickPools.set(key, pool);
  return pool;
}

/**
 * Schedule a cross-stick / rim-click hit at `time`. Short MembraneSynth click
 * (triangle, tiny pitch-decay, ~60 ms decay) — the bossa clave timbre.
 */
export function scheduleCrossStick(
  dest: AudioNode,
  time: number,
  options: DrumHitOptions = {},
): DrumVoiceHandle {
  const velocity = clampVelocity(options.velocity);
  if (velocity <= 0) return NOOP_HANDLE;
  const now = Tone.now();
  const playbackStartTime = Math.max(now, time);
  const lease = crossStickPool(options.kit).lease(dest, now);
  const busyUntil = playbackStartTime + 0.12;
  lease.setBusyUntil(busyUntil);
  lease.voice.triggerAttackRelease("G4", 0.05, time, velocity);
  return deferredDisposeHandle(lease, time, busyUntil, CROSS_STICK_DISPOSE_MS);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/drumKit.test.ts -t scheduleCrossStick`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/drumKit.ts src/progressions/audio/sound/patchTypes.ts src/progressions/audio/drumKit.test.ts
git commit -m "feat(progressions): cross-stick rim voice (MembraneSynth click) (Slice 2 §3.5)"
```

---

## Task 4: Wire the cross-stick voice through the engine

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts:22` (the `DrumVoice` type) and `:121-129` (`collectDrumHits`)
- Modify: `src/progressions/audio/progressionAudioEngine.ts:17`
- Modify: `src/hooks/useProgressionAudioPlayback.ts:450-456`
- Test: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/buildAllLayers.test.ts` (inside the top-level `describe("buildAllLayers", ...)` block):

```ts
  it("emits cross-stick drum events for the bossa clave pattern", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "bossa",
      chordPatternId: "ballad-whole",
      steps: [step({ duration: { value: 1, unit: "bar" } })],
    });
    const crossSticks = out.drums.filter((d) => d.value.type === "crossStick");
    // Bar 1 (3-side) of the son clave: beats 0, 1.5, 3 → times 0, 1.5, 3 at 60bpm.
    expect(crossSticks.map((d) => d.time)).toEqual([0, 1.5, 3]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "cross-stick"`
Expected: FAIL — `crossSticks` is empty (`collectDrumHits` ignores the `crossStick` array; the events never appear).

- [ ] **Step 3: Add `"crossStick"` to the `DrumVoice` type**

In `src/progressions/audio/buildAllLayers.ts`, change line 22:

```ts
type DrumVoice = "kick" | "snare" | "hihat" | "openHat" | "ride" | "crossStick";
```

- [ ] **Step 4: Handle `crossStick` in `collectDrumHits`**

In `src/progressions/audio/buildAllLayers.ts`, add one line to `collectDrumHits` (after the `ride` loop, before `return out`):

```ts
function collectDrumHits(pattern: CatalogDrumPattern): VoicedDrumHit[] {
  const out: VoicedDrumHit[] = [];
  for (const h of pattern.kicks) out.push({ ...h, type: "kick" });
  for (const h of pattern.snares) out.push({ ...h, type: "snare" });
  for (const h of pattern.hats) out.push({ ...h, type: "hihat" });
  for (const h of pattern.openHats ?? []) out.push({ ...h, type: "openHat" });
  for (const h of pattern.ride ?? []) out.push({ ...h, type: "ride" });
  for (const h of pattern.crossStick ?? []) out.push({ ...h, type: "crossStick" });
  return out;
}
```

- [ ] **Step 5: Re-export `scheduleCrossStick` from the engine**

In `src/progressions/audio/progressionAudioEngine.ts`, change line 17:

```ts
export { scheduleCrossStick, scheduleHiHat, scheduleKick, scheduleRide, scheduleSnare } from "./drumKit";
```

- [ ] **Step 6: Add the playback dispatch case**

In `src/hooks/useProgressionAudioPlayback.ts`, add a `crossStick` case to the drum `switch` (after the `ride` case, around line 455):

```ts
            case "crossStick": eng.scheduleCrossStick(audio.layers.drums, audioTime, { velocity: value.velocity, kit: drumKit }); break;
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "cross-stick"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/progressionAudioEngine.ts src/hooks/useProgressionAudioPlayback.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): route cross-stick voice through engine + playback (Slice 2 §3.5)"
```

---

## Task 5: `bars`-aware slicing in the scheduler

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (chord loop ~229-261, bass loop ~263-290, drum loop ~292-312)
- Test: `src/progressions/audio/buildAllLayers.test.ts`

This task makes the second bar of a 2-bar cell actually play (the bar-2 clave hits, the comp's bar-2 syncopations). Before it, a `bars: 2` pattern falls through `repeatPatternToBeats`, which drops beats ≥ `beatsPerBar` — so only bar 1 is heard.

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/audio/buildAllLayers.test.ts`. First add `sliceCellToBar` is **not** needed here; we import nothing new. Add:

```ts
  it("plays the bar-2 clave hits on the second bar of a 2-bar cell", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "bossa",
      chordPatternId: "ballad-whole",
      // One 2-bar step → absolute bars 0 and 1.
      steps: [step({ duration: { value: 2, unit: "bar" } })],
    });
    const crossSticks = out.drums
      .filter((d) => d.value.type === "crossStick")
      .map((d) => d.time);
    // Bar 1 @ 0,1.5,3 ; bar 2 starts at 4s, clave beats 5,6 → local 1,2 → 5,6.
    expect(crossSticks).toEqual([0, 1.5, 3, 5, 6]);
  });

  it("plays the bossa comp's bar-2 syncopations on the second bar", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "bossa",
      chordPatternId: "bossa-comp",
      bassPatternId: "bossa",
      steps: [step({ duration: { value: 2, unit: "bar" } })],
    });
    // comp beats 0,1.5,3 (bar1) and 4.5,6,7.5 (bar2) → times identical at 60bpm.
    expect(out.chordStrums.map((s) => s.time)).toEqual([0, 1.5, 3, 4.5, 6, 7.5]);
  });

  it("leaves a 1-bar pattern (rock) emitting identical hits on every bar", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      drumPatternId: "rock",
      chordPatternId: "ballad-whole",
      steps: [step({ duration: { value: 2, unit: "bar" } })],
    });
    const kicksBar1 = out.drums.filter((d) => d.value.type === "kick" && d.time < 4).map((d) => d.time);
    const kicksBar2 = out.drums.filter((d) => d.value.type === "kick" && d.time >= 4).map((d) => d.time - 4);
    // rock kicks at 0, 1.5, 2 — same in both bars (the bars-default path is untouched).
    expect(kicksBar1).toEqual([0, 1.5, 2]);
    expect(kicksBar2).toEqual([0, 1.5, 2]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts -t "bar-2"`
Expected: FAIL — the first two tests fail (bar-2 hits are dropped, so `crossSticks` is `[0,1.5,3,0,1.5,3]` shifted and the comp times are `[0,1.5,3,4,5.5,7]`-ish from `repeatPatternToBeats` repeating bar 1). The third test passes already (guards the default path).

- [ ] **Step 3: Import `sliceCellToBar` into the scheduler**

In `src/progressions/audio/buildAllLayers.ts`, add `sliceCellToBar` to the existing import from `"./patterns"` (the block that already imports `repeatPatternToBeats`):

```ts
import {
  getBassPattern,
  getChordPattern,
  getDrumPattern,
  getDrumVariation,
  variationFiresOnBar,
  repeatPatternToBeats,
  sliceCellToBar,
  type CatalogDrumPattern,
  type DrumHit,
  type DrumVariation,
  type BassArticulation,
} from "./patterns";
```

- [ ] **Step 4: Apply cell slicing in the chord loop**

In `src/progressions/audio/buildAllLayers.ts`, inside `if (chordPattern && voicing.length > 0) {`, replace the line:

```ts
        const hits = repeatPatternToBeats(chordPattern.hits, eventBeats, input.beatsPerBar);
```

with:

```ts
        const chordCellBars = chordPattern.bars ?? 1;
        const hits = isBarUnit && chordCellBars > 1
          ? sliceCellToBar(chordPattern.hits, absoluteBar % chordCellBars, input.beatsPerBar)
          : repeatPatternToBeats(chordPattern.hits, eventBeats, input.beatsPerBar);
```

- [ ] **Step 5: Apply cell slicing in the bass loop**

In `src/progressions/audio/buildAllLayers.ts`, inside `if (bassPattern && bassLineNotes.length > 0) {`, replace the line:

```ts
        const hits = repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
```

with:

```ts
        const bassCellBars = bassPattern.bars ?? 1;
        const hits = isBarUnit && bassCellBars > 1
          ? sliceCellToBar(bassPattern.hits, absoluteBar % bassCellBars, input.beatsPerBar)
          : repeatPatternToBeats(bassPattern.hits, eventBeats, input.beatsPerBar);
```

- [ ] **Step 6: Apply cell slicing to the drum base pattern**

In `src/progressions/audio/buildAllLayers.ts`, the drum section currently reads:

```ts
      const firingVariationHits: VoicedDrumHit[] = variations
        .filter((v) => variationFiresOnBar(v, absoluteBar))
        .flatMap((v) => collectDrumHits(v.pattern));
      const drumHitsForBar: VoicedDrumHit[] = [...baseDrumHits, ...firingVariationHits];
```

Replace those four lines with (slice the multi-bar base to the current bar before merging the 1-bar variation hits):

```ts
      const drumCellBars = drumPattern?.bars ?? 1;
      const baseForBar: VoicedDrumHit[] = isBarUnit && drumCellBars > 1
        ? sliceCellToBar(baseDrumHits, absoluteBar % drumCellBars, input.beatsPerBar)
        : baseDrumHits;
      const firingVariationHits: VoicedDrumHit[] = variations
        .filter((v) => variationFiresOnBar(v, absoluteBar))
        .flatMap((v) => collectDrumHits(v.pattern));
      const drumHitsForBar: VoicedDrumHit[] = [...baseForBar, ...firingVariationHits];
```

Note: for the `bars > 1` drum path the sliced hits are already bar-local (beats `0..beatsPerBar`), and the subsequent `repeatPatternToBeats(drumHitsForBar, eventBeats, input.beatsPerBar)` call emits them once for the single bar (it is a no-op repeat at one-bar width) — leave that call unchanged.

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS (all tests in the file, including the three new ones and the existing suite).

- [ ] **Step 8: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): bars-aware cell slicing in the scheduler (Slice 2 §3.5)"
```

---

## Task 6: Wire the bossa-nova genre + tune the kit

**Files:**
- Modify: `src/progressions/audio/genres.ts:53-58` (the `bossa-nova` row)
- Modify: `src/progressions/audio/sound/instrumentPatches.ts:200-207` (`kit-bossa`)
- Test: `src/progressions/audio/genres.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/audio/genres.test.ts`, inside the `describe("genre styles", ...)` block:

```ts
  it("wires bossa-nova to the clave drum, surdo bass, and partido-alto comp", () => {
    const bossa = getGenreStyle("bossa-nova")!;
    expect(bossa.chordPattern).toBe("bossa-comp");
    expect(bossa.bassPattern).toBe("bossa");
    expect(bossa.drumPattern).toBe("bossa");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/genres.test.ts -t "bossa-nova to the clave"`
Expected: FAIL — `chordPattern` is `"straight-quarters"`, `bassPattern` is `"arpeggiated"`.

- [ ] **Step 3: Re-wire the bossa-nova genre row**

In `src/progressions/audio/genres.ts`, replace the `bossa-nova` entry:

```ts
  {
    id: "bossa-nova", label: "Bossa Nova", chordInstrument: "piano",
    chordPattern: "bossa-comp", bassPattern: "bossa",
    drumPattern: "bossa", drumVariations: [],
    tempoRange: [120, 140], suggestedTempo: 130, swing: 0,
  },
```

- [ ] **Step 4: Add the cross-stick override to the bossa kit**

In `src/progressions/audio/sound/instrumentPatches.ts`, replace the `kit-bossa` entry:

```ts
  {
    id: "kit-bossa", label: "Bossa",
    voices: {
      kick: { pitchDecay: 0.05, octaves: 5, envelope: { decay: 0.28 } },
      snare: { noiseType: "white", envelope: { decay: 0.12 } },
      hihat: { decay: 0.04 },
      crossStick: { pitchDecay: 0.006, octaves: 2, envelope: { decay: 0.05 } },
    },
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/progressions/audio/genres.test.ts`
Expected: PASS (the new test plus the existing suite — note `"references valid pattern IDs"` now resolves `bossa-comp`/`bossa`/`bossa`, and `"leaves ballad and bossa-nova without drum variations"` still holds since `drumVariations` stays `[]`).

- [ ] **Step 6: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/sound/instrumentPatches.ts src/progressions/audio/genres.test.ts
git commit -m "feat(progressions): wire bossa-nova genre to clave/surdo/partido-alto + tune kit (Slice 2 §3.5)"
```

---

## Task 7: Full verification + ear audition

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS — all suites green. If a snapshot or unrelated test fails, investigate before proceeding (do not update snapshots blindly).

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: no errors (eslint + stylelint clean).

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` type-checks clean and `vite build` succeeds. A type error here most likely means a `bars`/`crossStick` field or the `DrumVoice` union is out of sync — fix and re-run.

- [ ] **Step 4: Manual ear audition (required by spec §7 / parent §3.5)**

Run `pnpm run dev`, open the app, select the **Bossa Nova** genre, load a ≥4-bar progression, and play the backing track. Confirm by ear:
- the cross-stick plays a recognizable 2-bar son clave (not a 1-bar loop);
- the bass reads as a root–fifth surdo pulse, not an even arpeggio;
- the comp is syncopated and leaves space, locking with the clave;
- nothing clips or clashes.

Tune the §5 beat tables in `patterns.ts` by ear as needed; apply each tweak as a small follow-up commit:

```bash
git add src/progressions/audio/patterns.ts
git commit -m "fix(progressions): tune bossa <clave|bass|comp> by ear (Slice 2 §3.5)"
```

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to open the PR (or merge), ensuring the PR title/body follow Conventional Commits and reference Slice 2 §3.5.

---

## Self-review notes

- **Spec coverage:** §3 cell mechanism → Task 1 + Task 5; §4 cross-stick voice (all 7 touchpoints) → Tasks 1 (field), 3 (synth + patch field), 4 (type/collect/export/dispatch), 6 (kit override); §5.1 drum clave → Task 2; §5.2 bass → Task 2; §5.3 comp → Task 2; §6 genre wiring → Task 6; §7 testing + audition → Tasks 1–6 (per-task) + Task 7. No gaps.
- **Type consistency:** `bars` (3 interfaces), `crossStick` (`CatalogDrumPattern` field, `DrumVoice` member, `DrumVoiceParams` override, dispatch case), `sliceCellToBar` (defined Task 1, imported Task 5), `scheduleCrossStick` (defined Task 3, exported Task 4, dispatched Task 4) all match across tasks.
- **Determinism:** no `Date.now`/`Math.random` introduced; slicing is pure on `absoluteBar`.
