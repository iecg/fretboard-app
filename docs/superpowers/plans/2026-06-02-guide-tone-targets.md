# Guide-Tone Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chord-transition *slide* with a beat-synced **guide-tone target cue** — a beat before each chord change, the next chord's 3rd & 7th bloom into focus (brighten + an expanding ring that lands on the downbeat) while every other note dims.

**Architecture:** Reuse the existing pass-2 step-relative lead-in (`leadInActiveAtom`) and the already-computed `nextChordGuideTonesAtom`. Repurpose the lead-in branch of `getEmphasis` to emit a single `guide-target` role (for the next chord's guide tones) and dim everything else. Render the ring + (optional) degree label in `FretboardNote` with a pure-CSS keyframe whose duration is the existing `--lead-in-duration` var. Delete all the slide machinery (`voiceLeading.ts`, `voiceLeadOffset`, `--vl-dx/--vl-dy`, the `note-incoming-slide` keyframe).

**Tech Stack:** React 19 + TypeScript, Jotai atoms, CSS Modules, Vitest + Testing Library. Music theory via `@fretflow/core` (Tonal-backed). Continuous motion must be compositor-only (`transform`/`opacity`, no per-frame JS) — the standing no-perf-regression constraint.

**Spec:** `docs/superpowers/specs/2026-06-02-guide-tone-targets-design.md`

---

## File Map

| File | Responsibility | Change |
|------|----------------|--------|
| `src/store/practiceLensAtoms.ts` | guide-tone derivation | Task 1 (5th fallback), Task 6 (labels atom) |
| `src/store/practiceLensAtoms.test.ts` | atom tests | Task 1, Task 6 |
| `src/components/FretboardSVG/utils/semantics.ts` | per-note emphasis | Task 2 (rewrite lead-in branch), Task 6 (label field) |
| `src/components/FretboardSVG/utils/semantics.test.ts` | emphasis tests | Task 2, Task 6 |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` | builds rendered notes | Task 3 (drop voice-leading pass) |
| `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` | builder tests | Task 3 |
| `src/components/FretboardSVG/utils/voiceLeading.ts` | slide pairing | Task 3 (**delete**) |
| `src/components/FretboardSVG/utils/voiceLeading.test.ts` | slide tests | Task 3 (**delete**) |
| `src/components/FretboardSVG/FretboardNote.tsx` | per-note SVG | Task 3 (remove `--vl`), Task 4 (ring), Task 6 (label) |
| `src/components/FretboardSVG/FretboardNote.test.tsx` | note render tests | Task 3, Task 4, Task 6 |
| `src/components/FretboardSVG/hooks/useEmphasisContext.ts` | emphasis context | Task 6 (labels) |
| `src/components/FretboardSVG/FretboardSVG.module.css` | note styling | Task 5 (remove slide, add ring) |

> **Do NOT touch** `src/progressions/voiceLeading.test.ts` / `progressionAudio.ts` — that's the unrelated *audio* voicing voice-leading, a different module.

---

## Task 1: Guide-tone 5th fallback for triads

The spec decision: a triad (no 7th) falls back to **3rd + 5th** so there are always two targets; a power chord (no 3rd) stays empty. `nextChordGuideTonesAtom` currently returns only the 3rd for triads.

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (`nextChordGuideTonesAtom`, ~lines 495–518)
- Test: `src/store/practiceLensAtoms.test.ts` (`describe("nextChordGuideTonesAtom")`, ~lines 486–540)

- [ ] **Step 1: Update the two existing triad expectations + add a fallback test**

In `src/store/practiceLensAtoms.test.ts`, change the existing triad assertions to expect the 5th, and add a dedicated fallback test.

Replace the test at ~line 498 (`returns the 3rd and 7th of the next chord (I→V ...)`):

```ts
  it("triad next chord (no 7th) returns 3rd + 5th (I→V in C Major: G major → B, D)", () => {
    const store = makeDefaultStore();
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones).toEqual(new Set(["B", "D"]));
  });
```

Replace the wrap test at ~line 533 (`wraps around: last step's next guide tones ...`):

```ts
  it("wraps around: last step's next guide tones come from the first step (C major → E, G)", () => {
    const store = makeDefaultStore();
    store.set(activeProgressionStepIndexAtom, 3);
    const guideTones = store.get(nextChordGuideTonesAtom);
    expect(guideTones).toEqual(new Set(["E", "G"]));
  });
```

Add after the power-chord test (~line 525):

```ts
  it("seventh chord does NOT add the 5th (3rd + 7th only)", () => {
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "7" } : s,
    ));
    expect(store.get(nextChordGuideTonesAtom)).toEqual(new Set(["B", "F"]));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/store/practiceLensAtoms.test.ts -t "nextChordGuideTonesAtom"`
Expected: FAIL — the triad tests get `Set(["B"])` / `Set(["E"])`, missing the 5th.

- [ ] **Step 3: Implement the 5th fallback**

In `src/store/practiceLensAtoms.ts`, replace the body of `nextChordGuideTonesAtom` after the `rootIndex` guard (the `const guideTones = new Set<string>(); for (...) {...} return guideTones;` block, ~lines 511–517) with:

```ts
  const guideTones = new Set<string>();
  let hasThird = false;
  let hasSeventh = false;
  for (const member of def.members) {
    if (GUIDE_TONE_RAW.has(member.name)) {
      guideTones.add(NOTES[(rootIndex + member.semitone) % 12]);
      if (member.name === "3" || member.name === "b3") hasThird = true;
      if (member.name === "7" || member.name === "b7") hasSeventh = true;
    }
  }
  // Triad fallback: a chord with a 3rd but no 7th has only one guide tone, so
  // add the 5th to give the soloist a second target. Power chords (no 3rd) get
  // nothing — there's no quality-defining tone to aim for.
  if (hasThird && !hasSeventh) {
    const fifth = def.members.find(
      (m) => m.name === "5" || m.name === "b5" || m.name === "#5",
    );
    if (fifth) guideTones.add(NOTES[(rootIndex + fifth.semitone) % 12]);
  }
  return guideTones;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/store/practiceLensAtoms.test.ts -t "nextChordGuideTonesAtom"`
Expected: PASS (all cases including the power-chord-empty and seventh-chord-no-5th).

- [ ] **Step 5: Commit**

```bash
git add src/store/practiceLensAtoms.ts src/store/practiceLensAtoms.test.ts
git commit -m "feat(fretboard): guide-tone 5th fallback for triads"
```

---

## Task 2: Rewrite the lead-in emphasis → guide-target + dim-the-rest

Repurpose `getEmphasis`'s lead-in branch. Today it emits `incoming`/`departing`/`held` roles (the slide model). New behavior: during lead-in, a note whose pitch class is one of the next chord's guide tones gets a single `guide-target` role (brighten + ring hue); **every other note dims** (the spotlight). No targets (empty guide set) → no dim.

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`TransitionRole`, `getEmphasis`, add a constant)
- Test: `src/components/FretboardSVG/utils/semantics.test.ts` (`describe("getEmphasis - voice-leading emphasis")`, ~lines 301–399)

- [ ] **Step 1: Rewrite the lead-in test suite**

In `src/components/FretboardSVG/utils/semantics.test.ts`, replace every test from `it("marks an incoming pitch class ...")` (~line 321) through the end of the `describe` block (~line 398) — i.e. delete the incoming/departing/held tests — with:

```ts
  it("marks a next-chord guide tone as 'guide-target' during lead-in", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B", nextGuideTones: new Set(["B", "D"]),
    };
    expect(getEmphasis("scale-only", false, ctx)).toEqual({
      glowColor: "var(--note-incoming)", radiusBoost: 1.15, opacityBoost: 1,
      transitionRole: "guide-target",
    });
  });

  it("guide-target fires regardless of the underlying noteClass", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "F", nextGuideTones: new Set(["F"]),
    };
    expect(getEmphasis("note-inactive", false, ctx).transitionRole).toBe("guide-target");
  });

  it("dims a non-target note during lead-in when targets exist", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set(["B", "D"]),
    };
    expect(getEmphasis("chord-tone-in-scale", true, ctx)).toEqual({
      radiusBoost: 1, opacityBoost: 0.4,
    });
  });

  it("does NOT dim when there are no targets (empty guide set)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set<string>(),
    };
    // Falls through to the base model: scale-only dims to its normal 0.7, NOT 0.4.
    expect(getEmphasis("scale-only", false, ctx)).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("outside the lead-in window, a held common tone keeps a static hold glow (no role)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A", commonWithNext: new Set(["A"]), leadInActive: false,
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1,
    });
  });

  it("outside the lead-in window, a guide tone produces no role", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B", nextGuideTones: new Set(["B"]), leadInActive: false,
    };
    expect(getEmphasis("note-inactive", false, ctx).transitionRole).toBeUndefined();
  });
```

(Keep the existing `falls back to tones-base when leadContext is undefined` test at the top of the block unchanged.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "voice-leading emphasis"`
Expected: FAIL — `guide-target` is not yet a value `getEmphasis` returns; the dim returns `0.8`/`incoming` shape instead.

- [ ] **Step 3: Add the role and a constant**

In `src/components/FretboardSVG/utils/semantics.ts`, extend the role union (~line 13):

```ts
export type TransitionRole = "held" | "incoming" | "departing" | "guide-target";
```

Add this constant just above `getEmphasis` (~line 74):

```ts
/** Opacity multiplier applied to every non-target note during the lead-in
 *  window — the "dim-the-rest" spotlight that makes the guide tones pop. */
const LEAD_IN_DIM_OPACITY = 0.4;
```

- [ ] **Step 4: Rewrite the `getEmphasis` body**

Replace the entire body of `getEmphasis` (from the `const { ... } = leadContext;` destructure through the final `return applyTonesBase(...)`, ~lines 84–123) with:

```ts
  const { notePc, nextGuideTones, commonWithNext, leadInActive } = leadContext;

  // Lead-in: bloom the next chord's guide tones, dim everything else. Only when
  // there ARE targets — an empty guide set (power chord / no next step) must not
  // dim the whole board for no reason.
  if (leadInActive && nextGuideTones.size > 0) {
    if (nextGuideTones.has(notePc)) {
      return {
        glowColor: "var(--note-incoming)",
        radiusBoost: 1.15,
        opacityBoost: 1,
        transitionRole: "guide-target",
      };
    }
    return { radiusBoost: 1, opacityBoost: LEAD_IN_DIM_OPACITY };
  }

  // Outside the window (or no targets): held common tones keep a gentle hold
  // glow; everything else uses the base model.
  if (CHORD_TONE_CLASSES.has(noteClass) && commonWithNext.has(notePc)) {
    return { glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 };
  }
  return applyTonesBase(noteClass, isGuideTone);
```

> Note: `incomingTones`/`departingTones` remain on `LeadLensContext` (still populated by `useEmphasisContext`) but are no longer read here. Pruning them is out of scope (a later cleanup) — leaving them avoids rippling into `useEmphasisContext` and `buildAnimatedFretboardNotes`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS (whole file — confirm no other test referenced the removed roles).

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "feat(fretboard): lead-in emphasis lights guide tones, dims the rest"
```

---

## Task 3: Delete the slide machinery

Remove the voice-leading *pairing/translation* model entirely: the `voiceLeading.ts` util, the three-pass build in `useAnimatedFretboardView`, the `voiceLeadOffset` field, and the `--vl-dx/--vl-dy` style emission. (The CSS keyframe is removed in Task 5.)

**Files:**
- Delete: `src/components/FretboardSVG/utils/voiceLeading.ts`
- Delete: `src/components/FretboardSVG/utils/voiceLeading.test.ts`
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Test: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`, `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Delete the slide util and its test**

```bash
git rm src/components/FretboardSVG/utils/voiceLeading.ts src/components/FretboardSVG/utils/voiceLeading.test.ts
```

- [ ] **Step 2: Simplify `buildRenderedFretboardNotes` to a single positioning pass**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`:

Remove the import (~line 6): delete `import { computeVoiceLeadingMoves } from "../utils/voiceLeading";`

Remove the `voiceLeadOffset` field from `RenderedFretboardNote` (~lines 8–17) so it reads:

```ts
export interface RenderedFretboardNote extends NoteData {
  cx: number;
  cy: number;
}
```

In `renderedNoteSignature` (~line 130), delete the last array element line:

```ts
    note.voiceLeadOffset ? `${note.voiceLeadOffset.dx},${note.voiceLeadOffset.dy}` : "",
```

Replace the three-pass body of `buildRenderedFretboardNotes` (the `// Pass 1` / `// Pass 2` / `// Pass 3` blocks, ~lines 147–179) with a single pass:

```ts
  const result = noteData.map((note) => {
    const key = `${note.stringIndex}-${note.fretIndex}`;
    const cx = fretCenterX(note.fretIndex);
    const positioned: RenderedFretboardNote = { ...note, cx, cy: stringYAt(note.stringIndex, cx) };
    const sig = renderedNoteSignature(positioned);
    const prev = prevCache.get(key);

    if (prev && prev.sig === sig) {
      nextCache.set(key, prev);
      return prev.result;
    }
    nextCache.set(key, { sig, result: positioned });
    return positioned;
  });
```

- [ ] **Step 3: Remove `voiceLeadOffset` / `--vl-dx/--vl-dy` from `FretboardNote`**

In `src/components/FretboardSVG/FretboardNote.tsx`:

Remove `voiceLeadOffset,` from the destructure (~line 78).

Remove the `--vl-dx/--vl-dy` spread inside the `style` object (~lines 200–202):

```tsx
        ...(voiceLeadOffset
          ? { "--vl-dx": voiceLeadOffset.dx, "--vl-dy": voiceLeadOffset.dy }
          : undefined),
```

- [ ] **Step 4: Update tests that referenced the slide**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`, remove/adjust any test asserting `voiceLeadOffset` is produced. Search first:

Run: `grep -n "voiceLeadOffset\|computeVoiceLeadingMoves\|vl-dx\|vl-dy" src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts src/components/FretboardSVG/FretboardNote.test.tsx`

For each hit, delete the assertion or the whole `it(...)` if its sole purpose was the slide offset. (These were added on this branch for the slide; there is no non-slide behavior to preserve in them.)

- [ ] **Step 5: Run the affected suites + typecheck**

Run: `pnpm vitest run src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts src/components/FretboardSVG/FretboardNote.test.tsx && pnpm exec tsc -b`
Expected: PASS, and tsc reports no errors (confirms no dangling `voiceLeadOffset` / `voiceLeading` references anywhere).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(fretboard): remove voice-leading slide machinery"
```

---

## Task 4: Render the guide-target ring in `FretboardNote`

Draw a hollow ring on `guide-target` notes. The ring's animation (Task 5 CSS) contracts to land on the downbeat; here we just mount the element.

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx`
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/FretboardSVG/FretboardNote.test.tsx` (follow the file's existing render helper / `renderNote` pattern; if it renders a single `FretboardNote` into an `<svg>`, mirror that). The ring is identified by the CSS-module class — assert via the `note-guide-ring` class token that CSS Modules maps (tests typically assert on `data-*` or class substrings; use whichever the file already uses). Concretely, assert a ring circle is present when `transitionRole === "guide-target"` and absent otherwise:

```ts
  it("renders a guide-target ring when the note's transition role is guide-target", () => {
    const note = makeNote({ transitionRole: "guide-target" });
    const { container } = renderNote(note);
    expect(container.querySelector("[data-guide-ring]")).not.toBeNull();
  });

  it("renders no guide-target ring for a normal note", () => {
    const note = makeNote({ transitionRole: undefined });
    const { container } = renderNote(note);
    expect(container.querySelector("[data-guide-ring]")).toBeNull();
  });
```

> If `makeNote` / `renderNote` are named differently in the file, adapt to the existing helpers (read the top of the test file). `makeNote` must produce a valid `RenderedFretboardNote`; set `applyLensEmphasis` to a `guide-target` emphasis object `{ glowColor: "var(--note-incoming)", radiusBoost: 1.15, opacityBoost: 1, transitionRole: "guide-target" }` and `transitionRole: "guide-target"`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardNote.test.tsx -t "guide-target ring"`
Expected: FAIL — no element with `data-guide-ring`.

- [ ] **Step 3: Render the ring**

In `src/components/FretboardSVG/FretboardNote.tsx`, insert the ring immediately before `{shapeEl}` (~line 219), so it sits under the note shape:

```tsx
      {transitionRole === "guide-target" && (
        <circle
          className={styles["note-guide-ring"]}
          data-guide-ring="true"
          cx={cx}
          cy={cy}
          r={r + 4}
          aria-hidden="true"
        />
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNote.test.tsx
git commit -m "feat(fretboard): render guide-target ring element"
```

---

## Task 5: CSS — remove slide styles, add the ring + countdown keyframe

Swap the slide/incoming/departing/held CSS for the single `guide-target` ring animation. The dim-the-rest is already handled inline (the `opacityBoost`), so no CSS is needed for it. The ring animates `transform: scale` + `opacity` only (compositor-driven) over `--lead-in-duration`, contracting to land on the downbeat.

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

- [ ] **Step 1: Remove the un-hide rule for incoming ghosts**

Delete the rule at ~lines 35–39:

```css
/* During the lead-in, an in-region incoming ghost is shown (as a ring) even if
   it is otherwise a hidden out-of-scale position. */
.fretboard-board[data-transition-phase="lead-in"]
  .fretboard-note:global(.hidden)[data-transition-role="incoming"][data-in-region="true"] {
  display: initial;
}
```

> (v1 limitation per spec: a guide tone chromatic to the current scale isn't rendered. No un-hide.)

- [ ] **Step 2: Remove the incoming/slide/departing/held blocks and their keyframes**

Delete the entire run from the `Incoming preview` comment (~line 420) through the end of the `prefers-reduced-motion` block (~line 509) — i.e. these rules and keyframes:
- `.fretboard-note[data-transition-role="incoming"]...` (glow, stroke, slide)
- `@keyframes note-incoming-ramp`
- `@keyframes note-incoming-slide`
- `[data-motion="css"] .fretboard-note[data-transition-role="departing"]...` and the `departing` filter rule
- `.fretboard-note[data-transition-role="held"]...`
- the `@media (prefers-reduced-motion: reduce)` block's incoming/departing rules (but **keep** the generic `.fretboard-note circle.note-glow-underlay { transition: none; }` reduced-motion rule — move it into the new reduced-motion block in Step 3).

- [ ] **Step 3: Add the guide-target ring styles**

In the place where the deleted block was, add:

```css
/* Guide-target ring — a hollow ring on the next chord's guide tones during the
   lead-in window. It starts wide + faint and contracts/brightens to "land" on
   the target exactly at the downbeat: a visual countdown synced to the beat.
   transform/opacity only → compositor-driven (no per-frame JS, no perf hit).
   The ring reuses the incoming hue token, so no new colour is introduced. */
.note-guide-ring {
  fill: none;
  stroke: var(--note-incoming);
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
  animation: note-guide-target-ring var(--lead-in-duration, 0.6s) ease-out both;
}

@keyframes note-guide-target-ring {
  from { transform: scale(2.4); opacity: 0; }
  35%  { opacity: 0.9; }
  to   { transform: scale(1); opacity: 0.95; }
}

/* Reduced motion: no contraction/countdown — show a static ring so the
   information (which notes are the targets) is preserved without animation. */
@media (prefers-reduced-motion: reduce) {
  .note-guide-ring {
    animation: none;
    transform: none;
    opacity: 0.9;
  }
  .fretboard-note circle.note-glow-underlay {
    transition: none;
  }
}
```

- [ ] **Step 4: Verify the stylesheet lints and the build still compiles CSS Modules**

Run: `pnpm run lint && pnpm exec tsc -b`
Expected: stylelint passes (0 errors); tsc passes. (`styles["note-guide-ring"]` referenced in Task 4 now resolves to a real class.)

- [ ] **Step 5: Run the component tests once more**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): guide-target ring countdown CSS, drop slide styles"
```

---

## Task 6: Degree label on the target (separable)

Show the target's function in the *next* chord (`3` / `b3` / `5` / `7` / `b7`) next to its ring — pedagogically the differentiator, and an a11y aid (not colour-alone). Fully self-contained: if dropped, Tasks 1–5 still ship the core cue.

**Files:**
- Modify: `src/store/practiceLensAtoms.ts` (add `nextChordGuideToneLabelsAtom`)
- Test: `src/store/practiceLensAtoms.test.ts`
- Modify: `src/components/FretboardSVG/hooks/useEmphasisContext.ts` (`EmphasisContext` + read atom)
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` (pass label map into `LeadLensContext`)
- Modify: `src/components/FretboardSVG/utils/semantics.ts` (`LeadLensContext` + `LensEmphasis` + `getEmphasis`)
- Modify: `src/components/FretboardSVG/utils/semantics.test.ts` (`baseLeadContext` + a label test)
- Modify: `src/components/FretboardSVG/FretboardNote.tsx` (render label) + `FretboardNote.test.tsx`

- [ ] **Step 1: Write the failing atom test**

Add to `src/store/practiceLensAtoms.test.ts` inside the `nextChordGuideTonesAtom` describe (and import `nextChordGuideToneLabelsAtom` in the top import from `./practiceLensAtoms`):

```ts
  it("labels map gives each guide tone its function in the next chord (triad → 3, 5)", () => {
    const store = makeDefaultStore();
    expect(store.get(nextChordGuideToneLabelsAtom)).toEqual(
      new Map([["B", "3"], ["D", "5"]]),
    );
  });

  it("labels map for a seventh chord uses 3 and b7", () => {
    const store = makeDefaultStore();
    const steps = store.get(progressionStepsAtom);
    store.set(progressionStepsAtom, steps.map((s, i) =>
      i === 1 ? { ...s, qualityOverride: "7" } : s,
    ));
    expect(store.get(nextChordGuideToneLabelsAtom)).toEqual(
      new Map([["B", "3"], ["F", "b7"]]),
    );
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/store/practiceLensAtoms.test.ts -t "labels map"`
Expected: FAIL — `nextChordGuideToneLabelsAtom` is not exported.

- [ ] **Step 3: Add the labels atom**

In `src/store/practiceLensAtoms.ts`, add immediately after `nextChordGuideTonesAtom` (~line 518). It mirrors the guide-tone derivation but maps pitch class → member name (with the same 5th fallback):

```ts
/**
 * Map of next-chord guide-tone pitch class → its interval label in that chord
 * ("3", "b3", "5", "7", "b7"). Mirrors {@link nextChordGuideTonesAtom} (same
 * next-step selection, loop wrap, and 5th fallback for triads) so the rendered
 * label matches exactly which notes light up. Empty map when there are no
 * targets.
 */
export const nextChordGuideToneLabelsAtom = atom((get): Map<string, string> => {
  const steps = get(resolvedProgressionStepsAtom);
  if (steps.length === 0) return new Map();
  const active = get(displayedProgressionStepIndexAtom);
  if (active === steps.length - 1 && !get(progressionLoopEnabledAtom)) {
    return new Map();
  }
  const nextIndex = (active + 1) % steps.length;
  const step = steps[nextIndex];
  if (!step || step.unavailable || step.root === null || step.quality === null) {
    return new Map();
  }
  const def = CHORD_DEFINITIONS[step.quality];
  if (!def) return new Map();
  const rootIndex = NOTES.indexOf(step.root);
  if (rootIndex === -1) return new Map();

  const labels = new Map<string, string>();
  let hasThird = false;
  let hasSeventh = false;
  for (const member of def.members) {
    if (GUIDE_TONE_RAW.has(member.name)) {
      labels.set(NOTES[(rootIndex + member.semitone) % 12], member.name);
      if (member.name === "3" || member.name === "b3") hasThird = true;
      if (member.name === "7" || member.name === "b7") hasSeventh = true;
    }
  }
  if (hasThird && !hasSeventh) {
    const fifth = def.members.find(
      (m) => m.name === "5" || m.name === "b5" || m.name === "#5",
    );
    if (fifth) labels.set(NOTES[(rootIndex + fifth.semitone) % 12], fifth.name);
  }
  return labels;
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/store/practiceLensAtoms.test.ts -t "labels map"`
Expected: PASS.

- [ ] **Step 5: Thread the labels through the emphasis context**

In `src/components/FretboardSVG/hooks/useEmphasisContext.ts`:
- import `nextChordGuideToneLabelsAtom` from `../../../store/practiceLensAtoms`,
- add `nextGuideToneLabels: Map<string, string>;` to the `EmphasisContext` interface,
- read it: `const nextGuideToneLabels = useAtomValue(nextChordGuideToneLabelsAtom);`
- include `nextGuideToneLabels` in the returned object.

In `src/components/FretboardSVG/utils/semantics.ts`:
- add `nextGuideToneLabels: Map<string, string>;` to `LeadLensContext` (after `nextGuideTones`),
- add `guideTargetLabel?: string;` to `LensEmphasis`,
- in `getEmphasis`, change the `guide-target` return to include the label:

```ts
    if (nextGuideTones.has(notePc)) {
      return {
        glowColor: "var(--note-incoming)",
        radiusBoost: 1.15,
        opacityBoost: 1,
        transitionRole: "guide-target",
        guideTargetLabel: leadContext.nextGuideToneLabels.get(notePc),
      };
    }
```

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, add to the `leadContext` literal in `buildAnimatedFretboardNotes` (~line 51):

```ts
        nextGuideToneLabels: emphasisContext.nextGuideToneLabels,
```

In `renderedNoteSignature` (`useAnimatedFretboardView.ts`), add to the array so the label change invalidates the cache:

```ts
    emph.guideTargetLabel ?? "",
```

(insert near the other `emph.*` entries; `const emph = note.applyLensEmphasis;` is already in scope.)

- [ ] **Step 6: Fix the semantics test fixture + add a label assertion**

In `src/components/FretboardSVG/utils/semantics.test.ts`, add to `baseLeadContext` (~line 309):

```ts
    nextGuideToneLabels: new Map<string, string>(),
```

Add a test in the voice-leading describe:

```ts
  it("guide-target carries its interval label from the next chord", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B",
      nextGuideTones: new Set(["B", "D"]),
      nextGuideToneLabels: new Map([["B", "3"], ["D", "5"]]),
    };
    expect(getEmphasis("scale-only", false, ctx).guideTargetLabel).toBe("3");
  });
```

- [ ] **Step 7: Render the label, with a failing test first**

Add to `src/components/FretboardSVG/FretboardNote.test.tsx`:

```ts
  it("renders the guide-target interval label", () => {
    const note = makeNote({
      transitionRole: "guide-target",
      applyLensEmphasis: {
        glowColor: "var(--note-incoming)", radiusBoost: 1.15, opacityBoost: 1,
        transitionRole: "guide-target", guideTargetLabel: "3",
      },
    });
    const { container } = renderNote(note);
    expect(container.querySelector("[data-guide-label]")?.textContent).toBe("3");
  });
```

Run: `pnpm vitest run src/components/FretboardSVG/FretboardNote.test.tsx -t "guide-target interval label"`
Expected: FAIL.

Then in `src/components/FretboardSVG/FretboardNote.tsx`, render the label after the ring (inside the `<g>`, after the `{shapeEl}` / text). Place it above-right of the note so it doesn't sit under the note glyph:

```tsx
      {applyLensEmphasis.guideTargetLabel && (
        <text
          className={styles["note-guide-label"]}
          data-guide-label="true"
          x={cx + r + 2}
          y={cy - r - 2}
          aria-hidden="true"
        >
          {applyLensEmphasis.guideTargetLabel}
        </text>
      )}
```

Add a minimal style in `FretboardSVG.module.css`:

```css
.note-guide-label {
  fill: var(--note-incoming);
  font-size: 9px;
  font-weight: 600;
  text-anchor: start;
  dominant-baseline: middle;
  pointer-events: none;
}
```

Run: `pnpm vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS.

- [ ] **Step 8: Full typecheck + the touched suites**

Run: `pnpm exec tsc -b && pnpm vitest run src/store/practiceLensAtoms.test.ts src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS / no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(fretboard): degree label on guide-target notes"
```

---

## Task 7: Full verification + visual handoff

**Files:** none (verification only)

- [ ] **Step 1: Run the mandatory gates**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint 0 errors (one pre-existing `useFretboardTopologyModel.ts` exhaustive-deps warning is acceptable); all unit/component tests pass; build succeeds.

- [ ] **Step 2: Confirm no slide remnants remain**

Run: `grep -rn "voiceLeadOffset\|computeVoiceLeadingMoves\|note-incoming-slide\|vl-dx\|vl-dy" src/ ; test ! -f src/components/FretboardSVG/utils/voiceLeading.ts && echo "voiceLeading.ts deleted"`
Expected: no matches under `src/` (the `src/progressions/voiceLeading.test.ts` audio module is unrelated and must remain); "voiceLeading.ts deleted" prints.

- [ ] **Step 3: Manual visual verification (user)**

Hand off to the user to run `pnpm run dev` from the `voice-leading-motion` worktree and confirm, on a progression with a multi-bar chord:
- a beat before each change, the next chord's 3rd & 7th brighten with a ring that contracts to land on the downbeat;
- every other note dims during that window;
- it fires **once per chord** (final bar of a multi-bar chord), not every bar;
- single-bar chords behave the same way;
- the degree labels (`3`/`7`/etc.) read correctly;
- `prefers-reduced-motion` shows a static ring (no contraction).

---

## Self-Review

**Spec coverage:**
- Change 1 "light up next chord's guide tones" → Tasks 2 (emphasis) + 4 (ring) + 5 (CSS). ✓
- Change 1 derivation + triad 3rd+5th fallback → Task 1; atom already existed. ✓
- "all occurrences in active region" → emerges from `getEmphasis` matching every in-region note by pitch class (no pairing). ✓
- Change 2 three-layer cue: onset (ring appears) + expanding ring countdown (Task 5 keyframe) + dim-the-rest (Task 2 `LEAD_IN_DIM_OPACITY`). ✓
- Degree label + a11y → Task 6. ✓ `prefers-reduced-motion` → Task 5. ✓ No new hue (reuses `--note-incoming`) → Tasks 2/5. ✓
- Reuse pass-2 lead-in timing → untouched (`leadInActiveAtom`, `--lead-in-duration`). ✓
- Deletions (`voiceLeading.ts`, `voiceLeadOffset`, `--vl-*`, `note-incoming-slide`) → Tasks 3 + 5. ✓
- Perf ≤2 re-renders/step, compositor-only → unchanged emphasis cadence; ring is pure CSS. ✓
- Out-of-scope (chromatic guide tones, nearest-only, connectors, audio) → not implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. Test helper names (`makeNote`/`renderNote`) are flagged to adapt to the actual `FretboardNote.test.tsx` helpers — the worker reads the file's existing pattern.

**Type consistency:** `guide-target` added to `TransitionRole` (Task 2) before it's matched in `FretboardNote` (Task 4) and rendered in CSS (Task 5). `guideTargetLabel` added to `LensEmphasis` and `nextGuideToneLabels` to `LeadLensContext`/`EmphasisContext` all within Task 6, with `baseLeadContext` and `buildAnimatedFretboardNotes` updated in the same task → no dangling required field. `nextChordGuideToneLabelsAtom` defined (Task 6 Step 3) before it's imported (Step 5). `voiceLeadOffset` removed from the type, the builder, and `FretboardNote` together in Task 3 → tsc stays green.
