# Blues Shuffle Strum Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Blues backing track an idiomatic guitar shuffle by rewriting `shuffle-comp` into a swung eighth-note shuffle strum, defaulting the Blues genre to a strummed guitar, and preserving the Jazz Organ tone via an optional per-genre secondary chord patch.

**Architecture:** Pure data changes to the pattern/genre/mix catalogs plus one small resolver change. The strum voice already reverses note order for up-strokes and the swing engine already delays `.5` off-beats to the late triplet, so the pattern is written in straight eighths. A new optional `GenreMix.patches.chordAlt` lets the chord-voice resolver return the genre's organ when the user selects a keys instrument, even though the default is now a guitar.

**Tech Stack:** TypeScript, React 19, Jotai, Tone.js (progression playback), Vitest. Package manager is **pnpm**.

**Spec:** `docs/superpowers/specs/2026-06-10-blues-shuffle-strum-realism-design.md`. Voicing/playback rationale: `docs/design/audio-voicing-engine.md`.

---

## File Structure

- `src/progressions/audio/patterns.ts` — rewrite the `shuffle-comp` `ChordPattern` hits (Task 1).
- `src/progressions/audio/genres.ts` — Blues `chordInstrument: "organ" → "strum"` (Task 2).
- `src/progressions/audio/sound/genreMixPresets.ts` — add `chordAlt?` to the `GenreMix` patches type; update the Blues preset's `chord` + `chordAlt` (Task 2).
- `src/progressions/audio/instruments/index.ts` — extend `getChordVoiceForInstrument` with an optional alt patch and family-match selection (Task 3).
- `src/hooks/useProgressionAudioPlayback.ts` — thread `mix.patches.chordAlt` to the voice resolver (Task 4).
- `docs/design/audio-voicing-engine.md` — record the decision + provenance (Task 5).

Tests are co-located: `patterns.test.ts`, `genreMixPresets.test.ts`, `instruments/index.test.ts`.

---

## Task 1: Rewrite `shuffle-comp` into the eighth-note shuffle strum

**Files:**
- Modify: `src/progressions/audio/patterns.ts:168-175`
- Test: `src/progressions/audio/patterns.test.ts:575-580`

- [ ] **Step 1: Replace the existing `shuffle-comp` strum-directions test with the fuller-shape test**

In `src/progressions/audio/patterns.test.ts`, find this test inside the `describe("strum directions", …)` block:

```ts
  it("shuffle-comp anchors a downstroke on the one and an upstroke pickup", () => {
    const p = getChordPattern("shuffle-comp")!;
    const byBeat = new Map(p.hits.map((h) => [h.beat, h.direction]));
    expect(byBeat.get(0)).toBe("down");
    expect(byBeat.get(1.5)).toBe("up");
  });
```

Replace it with:

```ts
  it("shuffle-comp is a swung eighth-note shuffle strum: down on beats, muted up on the &s", () => {
    const p = getChordPattern("shuffle-comp")!;
    // Eight hits across the bar — a downstroke on every beat, an up on every "&".
    expect(p.hits.map((h) => h.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    for (const h of p.hits) {
      if (h.beat % 1 === 0) {
        expect(h.direction, `beat ${h.beat}`).toBe("down");
        expect(h.articulation, `beat ${h.beat}`).toBeUndefined(); // full comp chord
      } else {
        expect(h.direction, `beat ${h.beat}`).toBe("up");
        expect(h.articulation, `beat ${h.beat}`).toBe("muted"); // ghost up-brush
      }
    }
    // Front-weighted accents: the "1" strongest, beat 3 the secondary accent,
    // and every downbeat louder than every ghost off-beat.
    const byBeat = new Map(p.hits.map((h) => [h.beat, h.velocity]));
    expect(byBeat.get(0)!).toBeGreaterThan(byBeat.get(2)!);
    expect(byBeat.get(2)!).toBeGreaterThan(byBeat.get(1)!);
    const maxOffbeat = Math.max(...p.hits.filter((h) => h.beat % 1 !== 0).map((h) => h.velocity));
    const minDownbeat = Math.min(...p.hits.filter((h) => h.beat % 1 === 0).map((h) => h.velocity));
    expect(minDownbeat).toBeGreaterThan(maxOffbeat);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts -t "swung eighth-note shuffle strum"`
Expected: FAIL — the current `shuffle-comp` has only 2 hits (`[0, 1.5]`), so `expect(p.hits.map(...)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])` fails.

- [ ] **Step 3: Rewrite the `shuffle-comp` pattern**

In `src/progressions/audio/patterns.ts`, replace this block:

```ts
  {
    id: "shuffle-comp",
    label: "Shuffle Comp",
    hits: [
      { beat: 0, velocity: 0.9, direction: "down" },
      { beat: 1.5, velocity: 0.6, direction: "up" },
    ],
  },
```

with:

```ts
  {
    id: "shuffle-comp",
    label: "Shuffle Comp",
    // Eighth-note blues shuffle strum: a downstroke on every beat and a soft
    // muted up-brush on every swung "&". The swing engine delays the .5
    // off-beats to the late triplet, so straight eighths here play as the
    // long–short shuffle. Front-weighted accents (the "1" strongest, beat 3 the
    // secondary accent); off-beats are ghost strokes. Muted off-beats use the
    // short choke duration — audible on both the strum voice (a muted up-brush)
    // and the organ alt (a short ghost blip). Spec:
    // docs/superpowers/specs/2026-06-10-blues-shuffle-strum-realism-design.md
    hits: [
      { beat: 0, velocity: 0.9, direction: "down" },
      { beat: 0.5, velocity: 0.4, direction: "up", articulation: "muted" },
      { beat: 1, velocity: 0.72, direction: "down" },
      { beat: 1.5, velocity: 0.4, direction: "up", articulation: "muted" },
      { beat: 2, velocity: 0.8, direction: "down" },
      { beat: 2.5, velocity: 0.4, direction: "up", articulation: "muted" },
      { beat: 3, velocity: 0.72, direction: "down" },
      { beat: 3.5, velocity: 0.5, direction: "up", articulation: "muted" },
    ],
  },
```

- [ ] **Step 4: Run the patterns test file to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/patterns.test.ts`
Expected: PASS — the new shuffle-comp test passes, and the catalog tests ("has 10 chord patterns", "all pattern beats are in range [0, bars * 4)") stay green (still 10 patterns; all beats < 4).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/patterns.ts src/progressions/audio/patterns.test.ts
git commit -m "feat(progression): rewrite shuffle-comp as an eighth-note shuffle strum"
```

---

## Task 2: Default Blues to a strummed guitar + add the `chordAlt` patch

The `genreMixPresets.test.ts` invariant requires a genre's chord-patch family to match its `chordInstrument` family, so `genres.ts` and `genreMixPresets.ts` MUST change together in this task.

**Files:**
- Modify: `src/progressions/audio/genres.ts:32-36`
- Modify: `src/progressions/audio/sound/genreMixPresets.ts` (the `GenreMix` interface, ~lines 16-20, and the `blues` preset block)
- Test: `src/progressions/audio/sound/genreMixPresets.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/progressions/audio/sound/genreMixPresets.test.ts`, add these two tests inside the top-level `describe("genre mix presets", …)` block (e.g. right after the existing `"genre chord-patch family matches…"` test):

```ts
  it("defaults blues to a strummed guitar with the organ preserved as the alt patch", () => {
    const blues = getGenreMix("blues")!;
    const primary = getChordPatch(blues.patches.chord)!;
    expect(primary.family).toBe("strum"); // default out-of-the-box = strummed guitar
    expect(blues.patches.chordAlt).toBe("chord-jazz-organ");
    const alt = getChordPatch(blues.patches.chordAlt!)!;
    expect(alt.family).toBe("poly"); // organ still reachable via the keys instrument
  });

  it("any genre's chordAlt (when present) is the opposite family of its default chord patch", () => {
    for (const m of GENRE_MIX_PRESETS) {
      if (!m.patches.chordAlt) continue;
      const primary = getChordPatch(m.patches.chord)!;
      const alt = getChordPatch(m.patches.chordAlt)!;
      expect(alt.family, `${m.genre}`).not.toBe(primary.family);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts -t "preserved as the alt patch"`
Expected: FAIL — today `blues.patches.chord` is `chord-jazz-organ` (poly), so `expect(primary.family).toBe("strum")` fails and `blues.patches.chordAlt` is `undefined`.

- [ ] **Step 3: Add `chordAlt?` to the `GenreMix` patches type**

In `src/progressions/audio/sound/genreMixPresets.ts`, change the `GenreMix` interface:

```ts
export interface GenreMix {
  genre: string;
  patches: { bass: string; chord: string; drumKit: string };
  perInstrument: Record<MixInstrument, InstrumentMix>;
  master: MasterMix;
}
```

to:

```ts
export interface GenreMix {
  genre: string;
  /** `chord` is the default-family patch (its family must match the genre's
   *  `chordInstrument`). `chordAlt`, when set, is the patch for the *other*
   *  family — used when the user switches the instrument away from the default
   *  (e.g. Blues defaults to a strum guitar but offers the organ via `chordAlt`). */
  patches: { bass: string; chord: string; chordAlt?: string; drumKit: string };
  perInstrument: Record<MixInstrument, InstrumentMix>;
  master: MasterMix;
}
```

- [ ] **Step 4: Update the Blues mix preset**

In `src/progressions/audio/sound/genreMixPresets.ts`, find the `blues` preset and change its `patches` line:

```ts
    genre: "blues",
    patches: { bass: "bass-upright", chord: "chord-jazz-organ", drumKit: "kit-blues-shuffle" },
```

to:

```ts
    genre: "blues",
    patches: { bass: "bass-upright", chord: "chord-steel-strum", chordAlt: "chord-jazz-organ", drumKit: "kit-blues-shuffle" },
```

- [ ] **Step 5: Default the Blues genre to the strum instrument**

In `src/progressions/audio/genres.ts`, change the Blues entry's `chordInstrument`:

```ts
  {
    id: "blues", label: "Blues", chordInstrument: "organ",
    chordPattern: "shuffle-comp", bassPattern: "shuffle",
    drumPattern: "blues-shuffle", drumVariations: ["blues-fill-4"], chordVariations: [], bassVariations: [],
    tempoRange: [70, 110], suggestedTempo: 85, swing: 0.33,
  },
```

to (only `chordInstrument` changes):

```ts
  {
    id: "blues", label: "Blues", chordInstrument: "strum",
    chordPattern: "shuffle-comp", bassPattern: "shuffle",
    drumPattern: "blues-shuffle", drumVariations: ["blues-fill-4"], chordVariations: [], bassVariations: [],
    tempoRange: [70, 110], suggestedTempo: 85, swing: 0.33,
  },
```

- [ ] **Step 6: Run the mix-presets test file to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/sound/genreMixPresets.test.ts`
Expected: PASS — the two new tests pass, and the existing `"genre chord-patch family matches the genre's chordInstrument family"` invariant stays green (Blues is now strum/strum).

- [ ] **Step 7: Commit**

```bash
git add src/progressions/audio/genres.ts src/progressions/audio/sound/genreMixPresets.ts src/progressions/audio/sound/genreMixPresets.test.ts
git commit -m "feat(progression): default Blues to a strum guitar, keep organ as chordAlt"
```

---

## Task 3: Resolve the chord voice from the primary or alt patch by family

**Files:**
- Modify: `src/progressions/audio/instruments/index.ts:32-42`
- Test: `src/progressions/audio/instruments/index.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/progressions/audio/instruments/index.test.ts`, add these three tests inside the existing `describe("chord voice resolution by instrument + genre patch", …)` block:

```ts
  it("prefers the genre alt patch when it matches the selected family", () => {
    // Blues-style config: strum default + organ alt. Selecting a keys
    // instrument resolves to the alt (organ), not the family fallback (piano).
    const organ = getChordVoiceForInstrument("organ", "chord-steel-strum", "chord-jazz-organ");
    const organDirect = getChordVoiceForInstrument("organ", "chord-jazz-organ");
    expect(organ).toBe(organDirect);
  });

  it("uses the primary patch when it matches the selected family, ignoring the alt", () => {
    const strum = getChordVoiceForInstrument("strum", "chord-steel-strum", "chord-jazz-organ");
    const strumDirect = getChordVoiceForInstrument("strum", "chord-steel-strum");
    expect(strum).toBe(strumDirect);
  });

  it("falls back to the family default when neither primary nor alt matches the family", () => {
    // Both patches are poly; selecting strum matches neither → steel default.
    const strum = getChordVoiceForInstrument("strum", "chord-epiano", "chord-jazz-organ");
    const steelDefault = getChordVoiceForInstrument("strum", "chord-steel-strum");
    expect(strum).toBe(steelDefault);
  });
```

- [ ] **Step 2: Run the tests to verify the alt-match test fails**

Run: `pnpm exec vitest run src/progressions/audio/instruments/index.test.ts -t "prefers the genre alt patch"`
Expected: FAIL — the current 2-arg signature ignores the third argument, so selecting `"organ"` with a strum primary falls back to grand piano instead of resolving to the jazz organ.

- [ ] **Step 3: Extend `getChordVoiceForInstrument` with the optional alt patch**

In `src/progressions/audio/instruments/index.ts`, replace the function:

```ts
export function getChordVoiceForInstrument(
  instrument: ChordInstrumentId,
  genrePatchId: string,
): ChordVoice {
  const family = familyForInstrument(instrument);
  const genrePatch = getChordPatch(genrePatchId);
  const patch = genrePatch && genrePatch.family === family
    ? genrePatch
    : getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY[family])!;
  return voiceForPatch(patch);
}
```

with:

```ts
export function getChordVoiceForInstrument(
  instrument: ChordInstrumentId,
  genrePatchId: string,
  genreAltPatchId?: string,
): ChordVoice {
  const family = familyForInstrument(instrument);
  // Prefer whichever of the genre's primary/alt patches matches the selected
  // instrument family; otherwise fall back to that family's default patch.
  const candidates = [genrePatchId, genreAltPatchId]
    .map((id) => (id ? getChordPatch(id) : undefined))
    .filter((p): p is ChordPatch => p !== undefined);
  const patch = candidates.find((p) => p.family === family)
    ?? getChordPatch(DEFAULT_CHORD_PATCH_BY_FAMILY[family])!;
  return voiceForPatch(patch);
}
```

(`ChordPatch` is already imported at the top of the file: `import type { ChordFamily, ChordPatch } from "../sound/patchTypes";`.)

- [ ] **Step 4: Run the instruments test file to verify it passes**

Run: `pnpm exec vitest run src/progressions/audio/instruments/index.test.ts`
Expected: PASS — all five tests pass, including the existing `"falls back to the family default when instrument family != genre patch family"` (2-arg call, `genreAltPatchId` undefined → unchanged behavior).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/instruments/index.ts src/progressions/audio/instruments/index.test.ts
git commit -m "feat(progression): resolve chord voice from primary or alt patch by family"
```

---

## Task 4: Thread `chordAlt` through the playback hook

This is integration glue inside a large effect that has no unit test; it is covered by the TypeScript build (Task 6) and the manual listen check. Make the edit precisely.

**Files:**
- Modify: `src/hooks/useProgressionAudioPlayback.ts:470` and `:579`

- [ ] **Step 1: Read the chord alt patch id from the mix**

In `src/hooks/useProgressionAudioPlayback.ts`, find:

```ts
      const chordPatchId = mix.patches.chord;
```

and add the alt id directly below it:

```ts
      const chordPatchId = mix.patches.chord;
      const chordAltPatchId = mix.patches.chordAlt;
```

- [ ] **Step 2: Pass the alt id to the voice resolver**

In the same file, find (inside the `chordStrumPart` `onEvent` callback):

```ts
          const voice = eng.getChordVoiceForInstrument(instrumentRef.current, chordPatchId);
```

and change it to:

```ts
          const voice = eng.getChordVoiceForInstrument(instrumentRef.current, chordPatchId, chordAltPatchId);
```

- [ ] **Step 3: Type-check the file**

Run: `pnpm exec tsc -b`
Expected: PASS (no type errors). `chordAltPatchId` is `string | undefined`, matching the new optional third parameter.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useProgressionAudioPlayback.ts
git commit -m "feat(progression): pass the genre chordAlt patch to the chord voice resolver"
```

---

## Task 5: Document the decision in the durable design doc

**Files:**
- Modify: `docs/design/audio-voicing-engine.md` (add a subsection after §3.1, and a provenance entry in §7)

- [ ] **Step 1: Add a new §3.2 subsection**

In `docs/design/audio-voicing-engine.md`, find the end of §3.1 — the line `skipped. **[spec]**` followed by a blank line and the `---` separator before `## 4`. Insert the following **between** that `**[spec]**` paragraph and the `---` line:

```markdown

### 3.2 Per-genre chord instrument default & the secondary `chordAlt` patch

Each genre declares a default chord instrument family (`GenreStyle.chordInstrument`:
`strum` → guitar, `piano`/`organ` → keys) and a single default chord patch
(`GenreMix.patches.chord`), whose family must match the default instrument (enforced by a
`genreMixPresets.test.ts` invariant). The instrument dropdown's *Piano* and *Organ* both map
to the `poly` family, so they are not distinct timbres — the only real switch is **guitar vs.
keys**, and the specific keys timbre is whatever poly patch the genre provides. **[internal]**

**Blues defaults to a strummed guitar (shipped this spec).** Blues already used shuffle bass
+ blues-shuffle drums; its chord default moved from the Jazz Organ to a steel strum so the
eighth-note shuffle strum (§ the `shuffle-comp` pattern) is heard out of the box, matching
how Rock and Funk already default to a guitar. **[internal]**

**Preserving the organ — `GenreMix.patches.chordAlt`.** Because the resolver picks the genre
patch whose family matches the selected instrument, switching the default to a strum patch
would otherwise make *Organ* fall back to the generic grand piano. An optional `chordAlt`
patch (the opposite family of `chord`) is consulted when the user switches instrument family:
`getChordVoiceForInstrument(instrument, primaryId, altId?)` returns whichever of primary/alt
matches the selected family, else the family default. Blues sets `chordAlt: "chord-jazz-organ"`
so selecting *Organ*/*Piano* restores the Jazz Organ. **Known limitation:** the chord
channel's EQ/saturation insert (`buildSignalGraph`) follows the *default* patch, so the alt
timbre routes through the default patch's channel insert. **[internal]**
```

- [ ] **Step 2: Add a provenance entry in §7**

In `docs/design/audio-voicing-engine.md`, under `## 7. Provenance` → the `**Shipped:**` list, add this bullet after the `2026-06-09-separate-audio-contexts-design.md` entry:

```markdown
- `2026-06-10-blues-shuffle-strum-realism-design.md` — the eighth-note Blues shuffle strum
  (`shuffle-comp`), the Blues strum-guitar default, and the per-genre `chordAlt` secondary
  chord patch with family-matched voice resolution (§3.2).
```

- [ ] **Step 3: Commit**

```bash
git add docs/design/audio-voicing-engine.md
git commit -m "docs(progression): record Blues strum default + chordAlt rationale"
```

---

## Task 6: Full verification + manual listen

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: All tests pass. The previously-passing count rises by the new cases (1 rewritten + 2 mix + 3 resolver). No regressions in `patterns.test.ts`, `genreMixPresets.test.ts`, or `instruments/index.test.ts`.

- [ ] **Step 3: Production build (type-check + bundle)**

Run: `pnpm run build`
Expected: `tsc -b` passes and `vite build` succeeds.

- [ ] **Step 4: Manual listen (the change is audible-by-ear; do not skip)**

Run: `pnpm run dev`, open the app, open the Song tab → Backing Track, and:
- Select the **Blues** genre and play. Confirm the chord layer is a **strummed guitar** shuffle by default — downstrokes on the beats with soft, swung up-brushes on the "&"s (not even eighth notes, not the old 2-hit comp).
- Switch the **Chord instrument** dropdown to **Organ**. Confirm the **Jazz Organ** tone returns (the `chordAlt` path), still playing the shuffle rhythm.
- Confirm the downstroke ring is not too long across the Blues tempo range (70–110 BPM). If it rings too long or the off-beats are too loud/quiet, tune the `shuffle-comp` velocities/`direction` in `patterns.ts` (the spec lists the values as a starting point) and re-run Task 1's test.

- [ ] **Step 5: Final state check**

Run: `git status` and `git log --oneline -7`
Expected: working tree clean; commits from Tasks 1–5 present on the feature branch.

---

## Self-Review Notes

- **Spec coverage:** §Design 1 → Task 1; §Design 2 (Blues default) → Task 2 (Steps 5); §Design 3 (`chordAlt` type + Blues patch + resolver + call site) → Tasks 2–4; §Testing → Tasks 1–3 unit tests + Task 6 manual; §Known limitation → documented in Task 5.
- **Type consistency:** the resolver param is `genreAltPatchId?: string`; the hook passes `chordAltPatchId` (`string | undefined`) from `mix.patches.chordAlt` (`string | undefined`) — matches. `chordAlt` is optional on `GenreMix.patches`, so all other genres and `DEFAULT_GENRE_MIX` need no change.
- **Backward compatibility:** existing 2-arg `getChordVoiceForInstrument` calls (the other `index.test.ts` cases) leave `genreAltPatchId` undefined → the candidates list contains only the primary → identical behavior to before.
