# Funk Color-Stab Voicing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the funk color-stab's 6-note root-position extension stack with a compact, rootless, voice-led funk "grip", and make the two color-stabs down-strummed at a lower velocity — fixing the register jump, mud, harmonic clash, and volume spike all at once.

**Architecture:** A new pure `buildFunkColorVoicing(root, quality, prevVoicing?)` produces a rootless 3-note guide-tone+color grip per quality, voice-led via the existing `getNearestInversion` so it sits in the comp's register. `buildAllLayers` uses it for `color-stab` hits (voice-led to the current chord). The old `extendFunkVoicing`/`FUNK_EXTENSION_SEMITONES` are removed. Sequenced green-at-every-commit: add the builder, wire it in, change the comp, then delete the dead code.

**Tech Stack:** TypeScript, Vitest. Files: `progressionAudio.ts`, `audio/buildAllLayers.ts`, `audio/patterns.ts` + co-located tests.

---

### Task 1: Add `buildFunkColorVoicing` + `FUNK_COLOR_TONES` (additive)

**Files:**
- Modify: `src/progressions/progressionAudio.ts`
- Modify: `src/progressions/progressionAudio.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/progressions/progressionAudio.test.ts`, add this new `describe` block at the end of the file (after the existing `extendFunkVoicing` block — which stays for now). It imports `buildFunkColorVoicing`; update the top-of-file import in the next step's edit, but for now also add `buildFunkColorVoicing` to the existing import on line 2 (`import { resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole, extendFunkVoicing, buildFunkColorVoicing } from "./progressionAudio";`).

```ts
describe("buildFunkColorVoicing", () => {
  const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const pcSet = (notes: readonly string[]) => new Set(notes.map((n) => n.replace(/-?\d+$/, "")));
  const midi = (n: string) => { const m = n.match(/^([A-G]#?)(-?\d+)$/)!; return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12; };

  it("dominant 7 grip is a rootless 3 / b7 / 9 (the E9 grip)", () => {
    const v = buildFunkColorVoicing("G", "7");
    expect(v).toHaveLength(3);
    const pcs = pcSet(v);
    expect(pcs).toEqual(new Set(["B", "F", "A"])); // 3=B, b7=F, 9=A
    expect(pcs.has("F")).toBe(true); // dominant MUST carry the b7 color
    expect(pcs.has("G")).toBe(false); // rootless — the bass covers the root
  });

  it("major grip is 3 / 6 / 9 and never adds a b7 (no tonic clash)", () => {
    const v = buildFunkColorVoicing("C", "M");
    expect(v).toHaveLength(3);
    const pcs = pcSet(v);
    expect(pcs).toEqual(new Set(["E", "A", "D"])); // 3 / 6 / 9
    expect(pcs.has("A#")).toBe(false); // clash guard: NO b7 on a major chord
    expect(pcs.has("C")).toBe(false); // rootless
  });

  it("minor grip is a rootless b3 / b7 / 9 (m9)", () => {
    const v = buildFunkColorVoicing("A", "m");
    expect(v).toHaveLength(3);
    expect(pcSet(v)).toEqual(new Set(["C", "G", "B"])); // b3=C, b7=G, 9=B
    expect(pcSet(v).has("A")).toBe(false);
  });

  it("every defined grip omits the chord root (rootless)", () => {
    for (const [root, quality] of [["C", "7"], ["D", "M"], ["E", "m"], ["F", "m7"], ["G", "maj7"]] as const) {
      expect(pcSet(buildFunkColorVoicing(root, quality)).has(root), `${root}${quality}`).toBe(false);
    }
  });

  it("voice-leads the grip near the previous voicing (no register jump)", () => {
    const prev = ["G3", "B3", "D4"];
    const v = buildFunkColorVoicing("C", "7", prev);
    const lo = Math.min(...v.map(midi)), hi = Math.max(...v.map(midi));
    const prevLo = Math.min(...prev.map(midi)), prevHi = Math.max(...prev.map(midi));
    expect(lo).toBeGreaterThanOrEqual(prevLo - 12);
    expect(hi).toBeLessThanOrEqual(prevHi + 12);
  });

  it("falls back to the plain voice-led triad for a quality without a grip", () => {
    // dim has no funk grip → delegates to resolveChordVoicing (the plain triad).
    expect(buildFunkColorVoicing("C", "dim")).toEqual(resolveChordVoicing("C", "dim", undefined, undefined));
  });

  it("returns [] for an unknown root", () => {
    expect(buildFunkColorVoicing("H", "7")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/progressions/progressionAudio.test.ts`
Expected: FAIL — `buildFunkColorVoicing` is not exported yet.

- [ ] **Step 3: Implement the builder in `progressionAudio.ts`**

In `src/progressions/progressionAudio.ts`, add the following immediately AFTER the existing `extendFunkVoicing` function (leave `extendFunkVoicing` and `FUNK_EXTENSION_SEMITONES` in place — they are removed in Task 4). `NOTES`, `resolveChordVoicing`, `getNearestInversion`, and `PROGRESSION_CHORD_ROOT_OCTAVE` are already in scope in this file.

```ts
/**
 * Rootless funk "color grip" tones per chord quality, as semitone offsets above
 * the chord root. Compact guide-tone + color shapes — the root (offset 0) is
 * intentionally omitted because the funk bass covers it (no low-register mud).
 * Major deliberately uses 6/9 (no b7) so a tonic chord is coloured without being
 * turned into a clashing dominant. Qualities not listed get the plain triad.
 *   +3 = b3,  +4 = 3,  +9 = 6,  +10 = b7,  +11 = maj7,  +14 = 9
 */
const FUNK_COLOR_TONES: Record<string, readonly number[]> = {
  "7": [4, 10, 14], // dominant: 3 / b7 / 9 — the classic "E9" grip
  M: [4, 9, 14], // major: 3 / 6 / 9 — 6-9 colour, NO b7 (would clash on a tonic)
  m: [3, 10, 14], // minor: b3 / b7 / 9 — m9
  m7: [3, 10, 14], // m7: b3 / b7 / 9 — m9
  maj7: [4, 11, 14], // maj7: 3 / 7 / 9 — maj9
};

/**
 * Build a compact, rootless, voice-led funk colour voicing for a chord. Pure.
 * Maps the quality's colour tones to note names and realises them voice-led near
 * `prevVoicing` (via getNearestInversion) so the grip lands in the same register
 * as the surrounding comp — no register jump. Falls back to the plain voice-led
 * triad when the quality has no defined grip (dim/aug/sus/6). Returns [] for an
 * unknown root.
 */
export function buildFunkColorVoicing(
  root: string,
  quality: string,
  prevVoicing?: string[],
): string[] {
  const rootIndex = NOTES.indexOf(root);
  if (rootIndex < 0) return [];
  const offsets = FUNK_COLOR_TONES[quality];
  if (!offsets) {
    return resolveChordVoicing(root, quality, undefined, prevVoicing);
  }
  const noteNames = offsets.map((o) => NOTES[(((rootIndex + o) % 12) + 12) % 12]);
  return getNearestInversion(prevVoicing ?? [], noteNames, PROGRESSION_CHORD_ROOT_OCTAVE);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/progressions/progressionAudio.test.ts`
Expected: PASS (new block green; existing `extendFunkVoicing` block still green).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc -b` → expect exit 0 (trust the shell exit code, not IDE diagnostics).

```bash
git add src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts
git commit -m "feat(progressions): add rootless voice-led funk color voicing builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(commitlint requires a LOWERCASE subject; the lint-staged "could not find any staged files" line is harmless.)

---

### Task 2: Wire `buildAllLayers` to the new color voicing

**Files:**
- Modify: `src/progressions/audio/buildAllLayers.ts`
- Modify: `src/progressions/audio/buildAllLayers.test.ts`

- [ ] **Step 1: Update the two existing funk voicing tests (write the new expectations first)**

In `src/progressions/audio/buildAllLayers.test.ts`:

(a) Add the imports needed. The file already imports from `../progressionAudio` is NOT guaranteed — add this import near the top (after the existing imports):
```ts
import { buildFunkColorVoicing, resolveChordVoicing } from "../progressionAudio";
```

(b) REPLACE the existing test `it("voices funk hits by articulation: root=1 note, stab=plain, color-stab=spicy", ...)` (the one asserting `at(2.5).value.voicing).toEqual(["C3", "E3", "G3", "A#3", "D4"])`) with:
```ts
  it("voices funk hits by articulation: root=1 note, stab=plain, color-stab=funk grip", async () => {
    const out = await buildAllLayersAsync({
      ...baseInput,
      chordPatternId: "funk-scratch",
      steps: [step({ root: "C", quality: "M", duration: { value: 1, unit: "bar" } })],
    });
    // tempo 60 => 1 beat = 1s, so hit time === beat.
    const at = (t: number) => out.chordStrums.find((s) => s.time === t)!;
    expect(at(0).value.voicing).toEqual(["C3"]); // root anchor on the one
    expect(at(1).value.voicing).toEqual(["C3", "E3", "G3"]); // plain stab on 2
    // color-stab uses the voice-led rootless funk grip, voice-led to the bar's triad.
    expect(at(2.5).value.voicing).toEqual(buildFunkColorVoicing("C", "M", ["C3", "E3", "G3"]));
  });
```

(c) REPLACE the existing test `it("keeps funk color-stab spice in the root-octave register regardless of the previous chord", ...)` (asserting `bar2Color.value.voicing).toEqual(["F3", "A3", "C4", "D#4", "G4"])`) with:
```ts
  it("voice-leads funk color-stabs into the current chord's register (rootless grip)", async () => {
    // The colour grip is voice-led to the CURRENT bar's triad, so it sits with the
    // comp instead of jumping to a fixed root-position extension stack.
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
    // Bar 2's lastVoicing = F major voice-led to the C triad; the grip voice-leads to that.
    const fVoicing = resolveChordVoicing("F", "M", undefined, ["C3", "E3", "G3"]);
    expect(bar2Color.value.voicing).toEqual(buildFunkColorVoicing("F", "M", fVoicing));
    // Rootless: the grip never contains the chord root pitch class.
    const pcs = new Set(bar2Color.value.voicing.map((n) => n.replace(/-?\d+$/, "")));
    expect(pcs.has("F")).toBe(false);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: FAIL — buildAllLayers still emits the old `spicyVoicing` (root-position stack), not the voice-led grip.

- [ ] **Step 3: Wire the builder into `buildAllLayers.ts`**

In `src/progressions/audio/buildAllLayers.ts`:

(a) Change the import block (lines 1-6) to swap `extendFunkVoicing` for `buildFunkColorVoicing`:
```ts
import {
  resolveBassNoteForRole,
  resolveChordVoicing,
  resolveBassLineNotes,
  buildFunkColorVoicing,
} from "../progressionAudio";
```

(b) REPLACE the voicing-prep block (currently the `needsPlainVoicing` / `plainVoicing` / `spicyVoicing` / `rootNoteVoicing` lines, ~lines 189-203) with:
```ts
    // Split the funk voicing intents: the "root" anchor needs the plain triad's
    // root note; the "color-stab" needs a voice-led rootless funk grip in the
    // current chord's register. Computed only when the pattern uses each hit.
    const needsRootAnchor = !!chordPattern?.hits.some((h) => h.articulation === "root");
    const needsColor = !!chordPattern?.hits.some((h) => h.articulation === "color-stab");
    const plainVoicing = needsRootAnchor ? resolveChordVoicing(root, quality) : voicing;
    const colorVoicing = needsColor
      ? buildFunkColorVoicing(root, quality, lastVoicing)
      : voicing;
    const rootNoteVoicing =
      needsRootAnchor && plainVoicing.length > 0 ? [plainVoicing[0]] : voicing;
```

(c) In the per-hit voicing selection (the `voicing:` ternary inside the `chordStrums.push`, ~lines 242-247), replace `spicyVoicing` with `colorVoicing`:
```ts
              voicing:
                hit.articulation === "color-stab"
                  ? colorVoicing
                  : hit.articulation === "root"
                    ? rootNoteVoicing
                    : voicing,
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/progressions/audio/buildAllLayers.test.ts`
Expected: PASS (both updated funk tests green; the duration/other tests unaffected).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc -b` → expect exit 0. (`extendFunkVoicing` is now unused but still exported — that is fine; it is removed in Task 4.)

```bash
git add src/progressions/audio/buildAllLayers.ts src/progressions/audio/buildAllLayers.test.ts
git commit -m "feat(progressions): voice funk color-stabs with the rootless funk grip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Make the color-stabs down-strummed at a lower velocity

**Files:**
- Modify: `src/progressions/audio/patterns.ts`
- Modify: `src/progressions/audio/patterns.test.ts`

- [ ] **Step 1: Update the funk-scratch comp test (write the new expectation first)**

In `src/progressions/audio/patterns.test.ts`, REPLACE the existing test `it("has exactly one plain stab and two color-stabs on offbeat upstrokes", ...)` (inside `describe("funk-scratch chord comp", ...)`) with:
```ts
  it("has one plain stab and two color-stabs as down-strummed offbeat accents", () => {
    const stabs = funk.hits.filter((h) => h.articulation === "stab");
    const colors = funk.hits.filter((h) => h.articulation === "color-stab");
    expect(stabs).toHaveLength(1);
    expect(colors).toHaveLength(2);
    expect(colors.map((c) => c.beat).sort((a, b) => a - b)).toEqual([2.5, 3.5]);
    for (const c of colors) {
      expect(c.beat % 1).toBeCloseTo(0.5); // syncopated upbeats (the "&")
      expect(c.direction).toBe("down"); // down-strummed, not up
      expect(c.velocity).toBeLessThan(stabs[0].velocity); // sit under the main stab
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts`
Expected: FAIL — the color-stabs are still `direction: "up"` at velocity 0.8/0.82.

- [ ] **Step 3: Edit the two color-stab hits in `patterns.ts`**

In `src/progressions/audio/patterns.ts`, inside the `funk-scratch` comp `hits` array, change the two `color-stab` lines. They currently read:
```ts
      { beat: 2.5, velocity: 0.8, direction: "up", articulation: "color-stab" },
```
and
```ts
      { beat: 3.5, velocity: 0.82, direction: "up", articulation: "color-stab" },
```
Change them to (velocity down, direction down):
```ts
      { beat: 2.5, velocity: 0.6, direction: "down", articulation: "color-stab" },
```
and
```ts
      { beat: 3.5, velocity: 0.62, direction: "down", articulation: "color-stab" },
```
Leave every other hit (root, muted, stab) unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/progressions/audio/patterns.test.ts`
Expected: PASS. (The existing `"accents the one hardest"` test still passes: beat-0 root is 0.9, above the new 0.6/0.62 color-stabs.)

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc -b` → expect exit 0.

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progressions): funk color-stabs down-strummed at lower velocity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Remove the dead `extendFunkVoicing` + `FUNK_EXTENSION_SEMITONES`

**Files:**
- Modify: `src/progressions/progressionAudio.ts`
- Modify: `src/progressions/progressionAudio.test.ts`

- [ ] **Step 1: Confirm `extendFunkVoicing` has no remaining non-test references**

Run: `grep -rn "extendFunkVoicing\|FUNK_EXTENSION_SEMITONES" src/`
Expected: matches ONLY in `progressionAudio.ts` (the definition) and `progressionAudio.test.ts` (the import + the `describe("extendFunkVoicing", ...)` block). If any OTHER file still references it, STOP and report — Task 2 should have removed the `buildAllLayers.ts` usage.

- [ ] **Step 2: Remove the definition from `progressionAudio.ts`**

In `src/progressions/progressionAudio.ts`, delete the entire `FUNK_EXTENSION_SEMITONES` const (with its doc comment) and the entire `extendFunkVoicing` function (with its doc comment). Leave `buildFunkColorVoicing`, `FUNK_COLOR_TONES`, and everything else intact.

- [ ] **Step 3: Remove the obsolete tests from `progressionAudio.test.ts`**

In `src/progressions/progressionAudio.test.ts`:
(a) Delete the entire `describe("extendFunkVoicing", () => { ... });` block.
(b) Remove `extendFunkVoicing` from the top-of-file import (keep `resolveBassLineNotes, resolveChordVoicing, resolveBassNoteForRole, buildFunkColorVoicing`).

- [ ] **Step 4: Confirm it's fully gone**

Run: `grep -rn "extendFunkVoicing\|FUNK_EXTENSION_SEMITONES" src/`
Expected: ZERO matches.

- [ ] **Step 5: Typecheck + run the affected tests**

Run: `pnpm exec tsc -b` → expect exit 0.
Run: `pnpm vitest run src/progressions/progressionAudio.test.ts src/progressions/audio/buildAllLayers.test.ts` → expect all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progressions/progressionAudio.ts src/progressions/progressionAudio.test.ts
git commit -m "refactor(progressions): remove dead extendFunkVoicing extension stack

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the complete gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint clean, all tests pass, `tsc -b` + `vite build` exit 0. Trust the shell exit code, not IDE diagnostics.

- [ ] **Step 2: If anything fails, fix at root cause and re-run**

Trace any failure to its cause (most likely a stray `extendFunkVoicing`/`spicyVoicing` reference or an import gap) and fix that — do not patch around it. Re-run the full gate until green.

---

### Verification (by ear — user)

Audio timbre/voicing cannot be unit-tested. After the gate is green and pushed to PR #489, the user auditions the **Funk** genre and confirms the color stabs now (a) are down-strummed, (b) sit in the same register as the surrounding strums (no jump), (c) sound clean/compact rather than muddy, (d) don't clash harmonically, and (e) don't spike in volume. Nudge levers if needed:
- **Want more spice on dominants** → add `21` (13th) to the `"7"` grip in `FUNK_COLOR_TONES` (makes it a 4-note grip).
- **Still slightly loud** → drop the color-stab velocity further (0.6 → 0.55) in `patterns.ts`.
- **Want the major chords brighter/jazzier** → swap the major grip `[4, 9, 14]` to `[4, 11, 14]` (maj9 instead of 6/9).
