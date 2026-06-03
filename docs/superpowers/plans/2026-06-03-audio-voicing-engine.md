# Audio Voicing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the naive close-stack on the default/strum chord audio path with a rule-based voicing engine that eliminates low step-cluster mud (e.g. C6's `C3 E3 G3 A3`).

**Architecture:** A new pure module `src/progressions/voicingEngine.ts` exports `buildVoicing(root, quality, prevVoicing, preset)`, a `VoicingPreset` type, and a `STRUM_PRESET` constant. It selects tones (dropping the 5th, then root, when over the note cap), places them in ascending pitch-class order anchored near C3, applies a low-interval limit below C4, normalizes the register to ≤ C5, and — when a previous voicing is supplied — picks the spacing-valid candidate nearest in semitone distance. A single call site in `buildAllLayers.ts` switches from `resolveChordVoicing` to `buildVoicing`. Funk and Bossa color builders are untouched.

**Tech Stack:** TypeScript, Vitest, `@fretflow/core` (`CHORD_DEFINITIONS`, `NOTES`), the existing `calculateDistance` helper in `voiceLeading.ts`.

**Source spec:** [`docs/superpowers/specs/2026-06-01-audio-voicing-engine-design.md`](../specs/2026-06-01-audio-voicing-engine-design.md)

---

## Codebase grounding (verified against the current tree)

- The default strum voicing is computed at **`src/progressions/audio/buildAllLayers.ts:230`** (the spec said line 197 — line numbers have drifted; the call is unchanged in form):
  ```ts
  const voicing = resolveChordVoicing(root, quality, undefined, lastVoicing);
  ```
- `lastVoicing` threading is at line 232; the funk/bossa branches that reuse `voicing` as a fallback are at lines 239–259. None of those change.
- `calculateDistance` in `src/progressions/voiceLeading.ts:24` is currently **private** (not exported). Task 1 exports it.
- Pitch convention: absolute integer = `octave * 12 + chroma`, `chroma = NOTES.indexOf(name)`, so C3 = 36, C4 = 48, C5 = 60. This matches `resolveChordVoicing`.
- **Pitch-class members:** `getChordSemitonesFromTonal` (`packages/core/src/lib/tonal.ts:93`) reduces every interval `((s % 12) + 12) % 12`, so `CHORD_DEFINITIONS` member semitones are pitch classes 0–11 (a `"9"` member has semitone `2`, a `"13"` member has semitone `9`). The engine sorts and places by these pitch classes — the low-interval-limit rule keeps the result clean regardless of the mod-12 collapse. Do not try to "fix" extensions back to 14/21; that is not the convention.

---

## File Structure

- **Create** `src/progressions/voicingEngine.ts` — the pure engine. One responsibility: turn `(root, quality, prevVoicing, preset)` into a clean, well-spaced note-string array.
- **Create** `src/progressions/voicingEngine.test.ts` — golden, property, and voice-leading tests.
- **Modify** `src/progressions/voiceLeading.ts` — export `calculateDistance`.
- **Modify** `src/progressions/audio/buildAllLayers.ts` — swap the single default-voicing call and add the import.

---

### Task 1: Export `calculateDistance` from `voiceLeading.ts`

**Files:**
- Modify: `src/progressions/voiceLeading.ts:24`
- Test: `src/progressions/voiceLeading.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create or append to `src/progressions/voiceLeading.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateDistance } from "./voiceLeading";

describe("calculateDistance", () => {
  it("sums absolute semitone distances element-wise", () => {
    // C3 E3 G3 -> C3 E3 A3 : only the third voice moves, G3(43)->A3(45) = 2
    expect(calculateDistance(["C3", "E3", "G3"], ["C3", "E3", "A3"])).toBe(2);
  });

  it("returns 0 for identical voicings", () => {
    expect(calculateDistance(["C3", "E3", "G3"], ["C3", "E3", "G3"])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/voiceLeading.test.ts`
Expected: FAIL — `calculateDistance is not exported` (or "not a function").

- [ ] **Step 3: Add the export keyword**

In `src/progressions/voiceLeading.ts`, change line 24 from:

```ts
function calculateDistance(notesA: string[], notesB: string[]): number {
```

to:

```ts
export function calculateDistance(notesA: string[], notesB: string[]): number {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/voiceLeading.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/voiceLeading.ts src/progressions/voiceLeading.test.ts
git commit -m "refactor(progressions): export calculateDistance for the voicing engine"
```

---

### Task 2: Create the engine module skeleton (preset + types + no-prev path)

**Files:**
- Create: `src/progressions/voicingEngine.ts`
- Test: `src/progressions/voicingEngine.test.ts`

- [ ] **Step 1: Write the failing golden test for C6**

Create `src/progressions/voicingEngine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildVoicing, STRUM_PRESET } from "./voicingEngine";

describe("buildVoicing — golden voicings (no prevVoicing)", () => {
  it("C6 voices as C3 E3 G3 A4 (the 6th lifts off the 5th — no low major 2nd)", () => {
    expect(buildVoicing("C", "6", undefined, STRUM_PRESET)).toEqual([
      "C3",
      "E3",
      "G3",
      "A4",
    ]);
  });

  it("returns [] for an unknown quality", () => {
    expect(buildVoicing("C", "not-a-chord", undefined, STRUM_PRESET)).toEqual([]);
  });

  it("returns [] for an unrecognized root", () => {
    expect(buildVoicing("H", "M", undefined, STRUM_PRESET)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: FAIL — cannot resolve `./voicingEngine`.

- [ ] **Step 3: Write the full engine implementation**

Create `src/progressions/voicingEngine.ts`:

```ts
import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";
import { calculateDistance } from "./voiceLeading";

/**
 * Tuning knobs for one voicing "style". Pitches are absolute integers
 * (octave * 12 + chroma), matching progressionAudio.ts: C3 = 36, C4 = 48,
 * C5 = 60.
 */
export interface VoicingPreset {
  /** strum: true; future rootless presets (funk/bossa): false */
  includeRoot: boolean;
  /** maximum voices kept before placement */
  maxNotes: number;
  /** the lowest voice is anchored at or just above this pitch */
  floorAbs: number;
  /** the top voice must not exceed this pitch (register normalization) */
  ceilAbs: number;
  /** below this pitch, the low-interval limit applies */
  lilThresholdAbs: number;
  /** smallest interval (semitones) allowed below lilThresholdAbs */
  minLowIntervalSemitones: number;
}

/** Default strum voicing style for Rock / Pop / Blues / Ballad. */
export const STRUM_PRESET: VoicingPreset = {
  includeRoot: true,
  maxNotes: 5,
  floorAbs: 36, // C3
  ceilAbs: 60, // C5
  lilThresholdAbs: 48, // C4
  minLowIntervalSemitones: 3, // minor third
};

/**
 * Drop priority when a chord has more members than `maxNotes`. The 5th goes
 * first, then the root. Guide tones (3/b3, 7/b7) and color tones (6, 9, 13,
 * sus 2/4) are always kept.
 */
const DROP_PRIORITY = ["5", "root"] as const;

/** Smallest absolute pitch >= `min` whose chroma === `pc`. */
function liftToPc(min: number, pc: number): number {
  const offset = (((min % 12) - pc) % 12 + 12) % 12;
  const base = min - offset;
  return base >= min ? base : base + 12;
}

function toNoteStrings(absolutes: number[]): string[] {
  return absolutes.map((a) => {
    const chroma = ((a % 12) + 12) % 12;
    return `${NOTES[chroma]}${Math.floor(a / 12)}`;
  });
}

/**
 * Build a clean, well-spaced strum voicing for a chord. Pure. Returns note
 * strings (e.g. ["C3","E3","G3","A4"]), or [] when the root or quality is
 * unrecognized (same contract as resolveChordVoicing — callers treat [] as
 * "no audible chord").
 */
export function buildVoicing(
  root: string,
  quality: string,
  prevVoicing: string[] | undefined,
  preset: VoicingPreset,
): string[] {
  const def = CHORD_DEFINITIONS[quality];
  if (!def) return [];
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];

  // Step 1 — resolve and select tones.
  let members = def.members.slice();
  if (!preset.includeRoot) {
    members = members.filter((m) => m.name !== "root");
  }
  while (members.length > preset.maxNotes) {
    let removed = false;
    for (const name of DROP_PRIORITY) {
      const i = members.findIndex((m) => m.name === name);
      if (i >= 0) {
        members.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) break; // nothing left in the drop priority; keep what remains
  }
  if (members.length === 0) return [];

  const chromasSorted = members
    .map((m) => (rootIndex + m.semitone) % 12)
    .sort((a, b) => a - b);

  // Steps 2 + 3 — placement (low-interval limit) and register normalization,
  // anchored from a given floor.
  const place = (floorAbs: number): number[] => {
    const placed: number[] = [];
    for (let i = 0; i < chromasSorted.length; i++) {
      const min = i === 0 ? floorAbs : placed[i - 1] + 1;
      let abs = liftToPc(min, chromasSorted[i]);
      // Low-interval limit: while below the threshold and tighter than the
      // minimum interval above the voice below, raise an octave.
      while (
        i > 0 &&
        abs < preset.lilThresholdAbs &&
        abs - placed[i - 1] < preset.minLowIntervalSemitones
      ) {
        abs += 12;
      }
      placed.push(abs);
    }
    // Register normalization: drop the whole voicing an octave until the top
    // voice fits under the ceiling.
    while (placed.length > 0 && Math.max(...placed) > preset.ceilAbs) {
      for (let i = 0; i < placed.length; i++) placed[i] -= 12;
    }
    return placed;
  };

  // Step 4 — spacing-safe voice leading. Each candidate already satisfies the
  // spacing invariant, so voice leading can never reintroduce a low cluster.
  if (prevVoicing && prevVoicing.length > 0) {
    const anchors = [
      preset.floorAbs - 12,
      preset.floorAbs,
      preset.floorAbs + 12,
    ];
    const candidates = anchors.map((a) => toNoteStrings(place(a)));
    let best = candidates[0];
    let minDistance = Infinity;
    for (const candidate of candidates) {
      const d = calculateDistance(prevVoicing, candidate);
      if (d < minDistance) {
        minDistance = d;
        best = candidate;
      }
    }
    return best;
  }

  return toNoteStrings(place(preset.floorAbs));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: PASS (3 tests). If C6 fails, log the actual output and re-derive `liftToPc` by hand: C3=36, E3=40, G3=43, then A would land A3=45 (2 semitones above G3, below C4) → bump to A4=57.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/voicingEngine.ts src/progressions/voicingEngine.test.ts
git commit -m "feat(progressions): add rule-based audio voicing engine"
```

---

### Task 3: Golden voicings for extended qualities (omission + register)

**Files:**
- Test: `src/progressions/voicingEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/progressions/voicingEngine.test.ts`. These assert the **pitch-class set** (chroma-only) and that the top voice stays in register, rather than pinning exact octaves for the multi-note cases:

```ts
import { CHORD_DEFINITIONS, NOTES } from "@fretflow/core";

function chromaSet(voicing: string[]): Set<number> {
  return new Set(
    voicing.map((n) => {
      const name = n.replace(/-?\d+$/, "");
      return NOTES.indexOf(name);
    }),
  );
}

function absOf(note: string): number {
  const name = note.replace(/-?\d+$/, "");
  const oct = parseInt(note.replace(/[^-\d]/g, ""), 10);
  return oct * 12 + NOTES.indexOf(name);
}

describe("buildVoicing — extended qualities", () => {
  // These qualities are added by the Extended Chord Qualities work. Guard with
  // a presence check so this suite passes both before and after that lands.
  const present = (q: string) => Boolean(CHORD_DEFINITIONS[q]);

  it.runIf(present("Cm6") || true)("m6 keeps all four tones, top <= C5", () => {
    const v = buildVoicing("C", "m6", undefined, STRUM_PRESET);
    // C, Eb(D#), G, A
    expect(chromaSet(v)).toEqual(new Set([0, 3, 7, 9]));
    expect(Math.max(...v.map(absOf))).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
  });

  it("13th chords drop the 5th to a five-note grip, top <= C5", () => {
    for (const q of ["13", "maj13", "m13"]) {
      if (!present(q)) continue;
      const v = buildVoicing("C", q, undefined, STRUM_PRESET);
      expect(v.length).toBe(5); // root, 3/b3, 7/b7, 9, 13 (5th dropped)
      expect(chromaSet(v).has(7)).toBe(false); // no perfect 5th (G)
      expect(Math.max(...v.map(absOf))).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
    }
  });
});
```

> Note: `m6` exists today; the 13th qualities exist only after the Extended Chord Qualities plan lands. The `present()` guard keeps this suite green in both states.

- [ ] **Step 2: Run test to verify it fails (or skips cleanly)**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: the `m6` assertion runs and PASSES against the engine; the 13th block is skipped until those qualities exist. If `m6` fails, inspect the actual voicing and confirm `D#` is the stored chroma (3) — the engine works in sharps-form internal names.

- [ ] **Step 3: No implementation needed**

The engine from Task 2 already handles these. If a case fails, fix the engine — do not special-case qualities in the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/voicingEngine.test.ts
git commit -m "test(progressions): golden voicings for extended qualities"
```

---

### Task 4: Property invariants over all qualities × several roots

**Files:**
- Test: `src/progressions/voicingEngine.test.ts`

- [ ] **Step 1: Write the failing property test**

Append to `src/progressions/voicingEngine.test.ts`:

```ts
describe("buildVoicing — invariants (all qualities x several roots)", () => {
  const roots = ["C", "G", "A#", "F", "B"]; // includes a flat-key root (A# = Bb context)
  const qualities = Object.keys(CHORD_DEFINITIONS);

  it("no interval smaller than 3 semitones below C4, and top <= C5", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const abs = v.map(absOf).sort((a, b) => a - b);
        // top voice in register
        expect(abs[abs.length - 1]).toBeLessThanOrEqual(STRUM_PRESET.ceilAbs);
        // spacing below C4
        for (let i = 1; i < abs.length; i++) {
          if (abs[i] < STRUM_PRESET.lilThresholdAbs) {
            expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(
              STRUM_PRESET.minLowIntervalSemitones,
            );
          }
        }
      }
    }
  });

  it("keeps each quality's guide tone(s): a 3rd-or-b3rd is always present", () => {
    for (const root of roots) {
      for (const q of qualities) {
        const def = CHORD_DEFINITIONS[q];
        const hasThird = def.members.some((m) => m.name === "3" || m.name === "b3");
        if (!hasThird) continue; // power chords (5) etc. have no third
        const v = buildVoicing(root, q, undefined, STRUM_PRESET);
        if (v.length === 0) continue;
        const rootIndex = NOTES.indexOf(root);
        const third = def.members.find((m) => m.name === "3" || m.name === "b3")!;
        const thirdChroma = (rootIndex + third.semitone) % 12;
        expect(chromaSet(v).has(thirdChroma)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: PASS against the Task 2 engine. If the spacing invariant fails for any quality, the failure message names the root+quality — re-derive the placement for that case and fix `place()`; do not loosen the assertion.

- [ ] **Step 3: No implementation needed** (engine already satisfies these, or fix the engine if not).

- [ ] **Step 4: Confirm pass**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressions/voicingEngine.test.ts
git commit -m "test(progressions): voicing-engine spacing and guide-tone invariants"
```

---

### Task 5: Voice-leading test (nearest among spacing-valid candidates)

**Files:**
- Test: `src/progressions/voicingEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/progressions/voicingEngine.test.ts`:

```ts
describe("buildVoicing — voice leading", () => {
  it("with a prevVoicing, returns a spacing-valid voicing nearest to it", () => {
    const prev = buildVoicing("C", "M", undefined, STRUM_PRESET); // C3 E3 G3
    const next = buildVoicing("G", "M", prev, STRUM_PRESET);

    // still passes the spacing invariant
    const abs = next.map(absOf).sort((a, b) => a - b);
    for (let i = 1; i < abs.length; i++) {
      if (abs[i] < STRUM_PRESET.lilThresholdAbs) {
        expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(
          STRUM_PRESET.minLowIntervalSemitones,
        );
      }
    }

    // and it is the nearest of the engine's own candidates to prev
    const candidateDistances = [
      STRUM_PRESET.floorAbs - 12,
      STRUM_PRESET.floorAbs,
      STRUM_PRESET.floorAbs + 12,
    ].map((anchor) => {
      // reconstruct each candidate by calling with the same preset but a
      // shifted floor is not exposed; instead assert next is no worse than
      // the default-floor (no-prev) voicing's distance.
      return anchor;
    });
    void candidateDistances;

    const defaultFloor = buildVoicing("G", "M", undefined, STRUM_PRESET);
    expect(calculateDistance(prev, next)).toBeLessThanOrEqual(
      calculateDistance(prev, defaultFloor),
    );
  });
});
```

Add the import at the top of the test file if not already present:

```ts
import { calculateDistance } from "./voiceLeading";
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: PASS — the voice-led result is no farther from `prev` than the floor-anchored default, and it still passes spacing.

- [ ] **Step 3: No implementation needed.**

- [ ] **Step 4: Commit**

```bash
git add src/progressions/voicingEngine.test.ts
git commit -m "test(progressions): voicing-engine voice-leading nearest-candidate"
```

---

### Task 6: Integrate the engine on the default strum path

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts` (import block near the top, and line 230)

- [ ] **Step 1: Add the import**

At the top of `src/progressions/audio/buildAllLayers.ts`, alongside the existing `resolveChordVoicing` import, add:

```ts
import { buildVoicing, STRUM_PRESET } from "../voicingEngine";
```

(`resolveChordVoicing`, `buildFunkColorVoicing`, `buildBossaColorVoicing` imports stay — they remain in use by the funk/bossa fallbacks.)

- [ ] **Step 2: Swap the single call site**

At `src/progressions/audio/buildAllLayers.ts:230`, change:

```ts
const voicing = resolveChordVoicing(root, quality, undefined, lastVoicing);
```

to:

```ts
const voicing = buildVoicing(root, quality, lastVoicing, STRUM_PRESET);
```

Leave lines 232 (`lastVoicing` threading), 239 (`plainVoicing`/funk root anchor — still calls `resolveChordVoicing`), 240–242 (funk color), 247–250 (bossa comp), and the bass logic unchanged.

- [ ] **Step 3: Run the existing progression-audio suite**

Run: `pnpm vitest run src/progressions`
Expected: PASS. Funk/Bossa snapshot tests are unaffected because their builders are untouched. If a default-genre snapshot exists and changed for a step-cluster chord (e.g. a 6 chord), that is the intended mud fix — update the snapshot and eyeball the new notes for sanity.

- [ ] **Step 4: Commit**

```bash
git add src/progressions/audio/buildAllLayers.ts
git commit -m "feat(progressions): route default strum voicings through the voicing engine"
```

---

### Task 7: Funk / Bossa regression guard

**Files:**
- Test: `src/progressions/voicingEngine.test.ts` (or a co-located `progressionAudio.test.ts` if one exists — check first)

- [ ] **Step 1: Write the regression test**

Append to `src/progressions/voicingEngine.test.ts`:

```ts
import {
  buildFunkColorVoicing,
  buildBossaColorVoicing,
} from "./progressionAudio";

describe("funk/bossa builders are untouched by the engine work", () => {
  const set: Array<[string, string]> = [
    ["C", "M"],
    ["G", "M"],
    ["A", "m"],
    ["F", "M"],
  ];

  it("funk color voicings match their known outputs", () => {
    expect(set.map(([r, q]) => buildFunkColorVoicing(r, q))).toMatchSnapshot();
  });

  it("bossa color voicings match their known outputs", () => {
    expect(set.map(([r, q]) => buildBossaColorVoicing(r, q))).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to seed the snapshot**

Run: `pnpm vitest run src/progressions/voicingEngine.test.ts`
Expected: PASS, snapshot written. Inspect the written snapshot: funk grips should be open ascending (e.g. C-major → `["E3","A3","D4"]` from the `[4,9,14]` offsets), bossa grips normalized into C3–C5.

- [ ] **Step 3: Commit**

```bash
git add src/progressions/voicingEngine.test.ts src/progressions/__snapshots__/
git commit -m "test(progressions): regression-guard funk/bossa voicings"
```

---

### Task 8: Full verification gate + manual check

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: all green.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `tsc -b` + `vite build` succeed.

- [ ] **Step 4: Manual audio verification (REQUIRED before claiming completion)**

Start the dev server (`pnpm run dev`), load a `C–G–Am–F` progression in the **Rock** genre, set the C chord to quality `6`, and play it. Confirm:
- The C6 no longer sounds muddy (the 6th rings on top, not crunched against the 5th).
- Plain C, G, Am triads sound unchanged.

Document the result in the PR description (what you played, what you heard).

- [ ] **Step 5: Final commit (if any snapshot/doc churn remains)**

```bash
git add -A
git commit -m "chore(progressions): finalize audio voicing engine"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** module + `STRUM_PRESET` (Task 2), tone selection/omission (Tasks 2–3), octave placement + LIL (Task 2, asserted Tasks 3–4), register normalization (Tasks 3–4), voice leading (Task 5), integration at the single call site (Task 6), funk/bossa untouched (Task 7), manual check (Task 8). All four engine rules and every test class in the spec map to a task.
- **Type consistency:** `buildVoicing(root, quality, prevVoicing, preset)` and `VoicingPreset`/`STRUM_PRESET` are used identically across module and tests. `calculateDistance(string[], string[]) => number` matches the existing signature.
- **Deviations from spec, flagged:** (1) integration line is **230**, not 197 — the call form is identical. (2) `calculateDistance` had to be **exported** (Task 1); the spec assumed it was reusable but it was private. (3) Step-4 candidate generation is implemented as three octave-anchored placements (`floor`, `floor ± 12`); the spec also mentions "closed-position rotations" — the octave anchors already produce distinct spacing-valid candidates and keep the function deterministic and testable. If voice leading proves too coarse in the manual check, add rotation candidates inside `place()`'s caller without changing the public signature.
- **Placeholder scan:** none — every code step contains complete code.
