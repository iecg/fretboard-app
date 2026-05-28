# Light-Mode Polish — Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply five concrete fixes that close the gaps left after v2.0 + Lens Consolidation — rebalance the light-mode CAGED palette, restore lead-lens & guide-tone glow visibility, fix chord-tone highlighting inside 3NPS shapes, route the orphan `#ffffff` hover state through the warm-parchment palette, and refresh visual baselines.

**Architecture:** Diagnose-and-fix, not redesign. Three of five tasks are token / CSS edits in `src/styles/themes.css` and `src/components/FretboardSVG/FretboardSVG.module.css`. One task narrows a TypeScript type and tokenizes literals in `src/components/FretboardSVG/utils/semantics.ts`. One task investigates the 3NPS classifier gate and adjusts it. All changes ship in a single PR as ~5 small commits.

**Tech Stack:** CSS Custom Properties, TypeScript, Vitest (unit), Playwright (visual regression), pnpm workspace, React 19 + Jotai.

**Spec:** [docs/superpowers/specs/2026-05-27-light-mode-polish-round-2-design.md](../specs/2026-05-27-light-mode-polish-round-2-design.md)

---

## File Structure

```
src/styles/
├── themes.css                                # MODIFY: light-mode CAGED palette
│                                             #         (lines 194-199 + new --caged-d outline override)

src/components/FretboardSVG/
├── FretboardSVG.module.css                   # MODIFY: drop dead [data-practice-lens="lead"] gate
│                                             #         on lines 388 and 393
├── FretboardSVG.tsx                          # OPTIONAL: tune SVG glow filter defs if light-mode
│                                             #           glow reads too subtly (lines 200-204
│                                             #           + the <defs> block)
└── utils/
    ├── semantics.ts                          # MODIFY: tokenize applyTonesBase glowColor;
    │                                         #         narrow LensEmphasis type union;
    │                                         #         relax classifyNoteFromSemantics chord-tone gate
    └── semantics.test.ts                     # MODIFY: update existing "cyan" literal assertions;
                                              #         add 3NPS-shape chord-tone assertion

src/components/[discovered during Task 4]/
└── *.module.css                              # MODIFY: hover background → var(--chrome-hover-bg)

e2e/
└── (all visual suites)                       # REFRESH: pnpm run test:visual:update
```

---

### Task 1: CAGED palette rebalance (light mode)

**Files:**
- Modify: `src/styles/themes.css:194-199` (the light-mode `--caged-*-bg` block)
- Modify: `src/styles/themes.css` (add new light-mode `--caged-d` outline override inside the `[data-theme="modern-light"]` block, alongside the bg overrides)

- [ ] **Step 1: Confirm the current state of the light-mode CAGED tokens**

Run: `grep -nE '^\s*--caged-[a-z](-bg)?:' src/styles/themes.css`

Expected (light-mode block around lines 195-199):

```
194:  /* CAGED shapes — boost visibility for light mode (Okabe-Ito RGB, 0.35 alpha) */
195:  --caged-e-bg: rgba(27, 124, 194, 0.35);  /* E #1B7CC2 + 0.35 boost */
196:  --caged-d-bg: rgba(153, 153, 153, 0.35); /* D stays neutral gray in light mode too */
197:  --caged-c-bg: rgba(0, 158, 115, 0.35);   /* C #009E73 + 0.35 boost */
198:  --caged-a-bg: rgba(0, 114, 178, 0.35);   /* A #0072B2 + 0.35 boost */
199:  --caged-g-bg: rgba(204, 121, 167, 0.35); /* G #CC79A7 + 0.35 boost */
```

If the line numbers differ, locate the same block by its comment header `/* CAGED shapes — boost visibility for light mode */`.

- [ ] **Step 2: Re-tune E, A, D in the light-mode CAGED block**

In `src/styles/themes.css`, replace the block from Step 1 with:

```css
  /* CAGED shapes — light mode rebalance round 2.
     E lifts to its lighter sky-blue rgb so it visibly separates from A's deeper blue.
     A deepens via alpha (0.45) without changing hue.
     D moves to a warm taupe in the MUTE-family neighborhood so it doesn't desaturate
     against the cream PANEL surface. */
  --caged-d:    #6b5d4f;                    /* warm taupe outline (was inherited #999999) */
  --caged-e-bg: rgba(86, 180, 233, 0.35);   /* E #56B4E9 light-mode tint */
  --caged-d-bg: rgba(107, 93, 79, 0.40);    /* D warm taupe tint */
  --caged-c-bg: rgba(0, 158, 115, 0.35);    /* C #009E73 (unchanged) */
  --caged-a-bg: rgba(0, 114, 178, 0.45);    /* A #0072B2 deeper alpha for separation from E */
  --caged-g-bg: rgba(204, 121, 167, 0.35);  /* G #CC79A7 (unchanged) */
```

The new `--caged-d` outline override must sit inside the `[data-theme="modern-light"]` block (around the same area). If lint complains about ordering, place `--caged-d:` just above the `--caged-d-bg:` line so visually-related tokens stay grouped.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: clean — no stylelint errors. If a stylelint rule complains about `rgba()` (declared-color-function), spot-check it but no rule in this codebase currently bans `rgba`.

- [ ] **Step 4: Verify the file still parses by running unit tests**

Run: `pnpm test --run -t "FretboardSVG"`
Expected: PASS — no test should regress on a CSS-only change (FretboardSVG unit tests don't render against `themes.css` directly, but a parse error would break the broader import graph at test runtime).

- [ ] **Step 5: Commit**

```bash
git add src/styles/themes.css
git commit -m "$(cat <<'EOF'
fix(theme): rebalance light-mode CAGED palette (E/A/D)

E lifts to its lighter sky-blue rgb so it visibly separates from A in
light mode (both polygons were reading as the same blue family before).
A deepens via alpha 0.45 to gain the contrast back from the other side.
D moves to a warm taupe outline + fill so the polygon stops desaturating
against the warm cream PANEL surface.

C and G are unchanged. Dark mode is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rewire lens-emphasis glow tokens

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:13-17` (narrow `LensEmphasis.glowColor` union)
- Modify: `src/components/FretboardSVG/utils/semantics.ts:58` (tokenize `applyTonesBase` guide-tone glowColor)
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:388,393` (drop dead `[data-practice-lens="lead"]` gate)
- Modify: `src/components/FretboardSVG/utils/semantics.test.ts` (update existing `"cyan"` literal assertions to the tokenized value)

- [ ] **Step 1: Update the failing test assertions first (TDD)**

In `src/components/FretboardSVG/utils/semantics.test.ts`, replace every `glowColor: "cyan"` literal expectation with the tokenized form. The current file (lines 14-38) has four such assertions inside the `getEmphasis — tones-base fallback` describe block. Edit them in place:

Find:
```ts
    it("boosts guide tones with cyan glow", () => {
      const res = getEmphasis("chord-tone", true);
      expect(res.glowColor).toBe("cyan");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });
```

Replace with:
```ts
    it("boosts guide tones with hold-glow token", () => {
      const res = getEmphasis("chord-tone", true);
      expect(res.glowColor).toBe("var(--note-glow-hold)");
      expect(res.radiusBoost).toBeGreaterThan(1);
    });
```

Find:
```ts
    it("emphasizes guide tones with cyan glow and larger radius", () => {
      expect(getEmphasis("chord-tone-in-scale", true)).toEqual({
        glowColor: "cyan",
        radiusBoost: 1.15,
        opacityBoost: 1,
      });
    });
```

Replace with:
```ts
    it("emphasizes guide tones with the hold-glow token and larger radius", () => {
      expect(getEmphasis("chord-tone-in-scale", true)).toEqual({
        glowColor: "var(--note-glow-hold)",
        radiusBoost: 1.15,
        opacityBoost: 1,
      });
    });
```

Find:
```ts
    it("emphasizes guide tones regardless of underlying noteClass", () => {
      expect(getEmphasis("chord-tone-outside-scale", true)).toMatchObject({
        glowColor: "cyan",
      });
    });
```

Replace with:
```ts
    it("emphasizes guide tones regardless of underlying noteClass", () => {
      expect(getEmphasis("chord-tone-outside-scale", true)).toMatchObject({
        glowColor: "var(--note-glow-hold)",
      });
    });
```

Also scan the rest of the file for any other `"cyan"` or `"orange"` literal expectations on `glowColor` (the lead-lens describe block around lines 193+ already uses `var(--note-glow-*)` form per the prior theming pass — verify with `grep -n 'glowColor.*"cyan"\|glowColor.*"orange"' src/components/FretboardSVG/utils/semantics.test.ts` after edits — output should be empty).

- [ ] **Step 2: Run the updated tests to verify they fail**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts`

Expected: FAIL on the three edited assertions (each expects `"var(--note-glow-hold)"`, current implementation returns `"cyan"`).

- [ ] **Step 3: Tokenize `applyTonesBase` in `semantics.ts`**

In `src/components/FretboardSVG/utils/semantics.ts`, find:

```ts
function applyTonesBase(
  noteClass: string,
  isGuideTone: boolean,
): LensEmphasis {
  if (isGuideTone) {
    return { glowColor: "cyan", radiusBoost: 1.15, opacityBoost: 1 };
  }
```

Replace with:

```ts
function applyTonesBase(
  noteClass: string,
  isGuideTone: boolean,
): LensEmphasis {
  if (isGuideTone) {
    return { glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1 };
  }
```

- [ ] **Step 4: Narrow the `LensEmphasis.glowColor` type union**

In the same file, find:

```ts
export type LensEmphasis = {
  glowColor?: "cyan" | "orange" | "violet" | `var(--${string})`;
  radiusBoost: number;
  opacityBoost: number;
};
```

Replace with:

```ts
export type LensEmphasis = {
  glowColor?: `var(--${string})`;
  radiusBoost: number;
  opacityBoost: number;
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS — all assertions, including the three edited in Step 1, now resolve.

- [ ] **Step 6: Typecheck the whole app to catch any other producer of the literal forms**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: zero errors. If a different file produces `glowColor: "cyan"` / `"orange"` / `"violet"` (it shouldn't — only `semantics.ts` was the producer), TS will surface it here. Fix any such site by switching to `var(--note-glow-hold)` (cyan), `var(--note-glow-anticipation)` (orange), or — if a third role exists — adding the appropriate token. Likely zero hits.

- [ ] **Step 7: Drop the dead `[data-practice-lens="lead"]` gate in the CSS module**

In `src/components/FretboardSVG/FretboardSVG.module.css` (lines around 388 and 393), find:

```css
/* Hold: common tone carried into next chord — hold-glow token (stable/sustained). */
[data-practice-lens="lead"] .fretboard-note[data-lens-emphasis="var(--note-glow-hold)"] {
  filter: var(--fretboard-svg-glow-cyan-url);
}

/* Anticipation: next chord's guide tone in the last-beat window — anticipation-glow token (incoming). */
[data-practice-lens="lead"] .fretboard-note[data-lens-emphasis="var(--note-glow-anticipation)"] {
  filter: var(--fretboard-svg-glow-orange-url);
}
```

Replace with:

```css
/* Hold: common tone carried into next chord — hold-glow token (stable/sustained).
   Applied unconditionally after Lens Consolidation made always-Lead the default. */
.fretboard-note[data-lens-emphasis="var(--note-glow-hold)"] {
  filter: var(--fretboard-svg-glow-cyan-url);
}

/* Anticipation: next chord's guide tone in the last-beat window — anticipation-glow token (incoming). */
.fretboard-note[data-lens-emphasis="var(--note-glow-anticipation)"] {
  filter: var(--fretboard-svg-glow-orange-url);
}
```

- [ ] **Step 8: Confirm no other CSS rule needs the same gate-removal**

Run: `grep -nE '\[data-practice-lens="lead"\]' src/components/FretboardSVG/FretboardSVG.module.css`

Expected: empty (no remaining `lead` references after Step 7). If matches remain, they're unrelated rules — leave them, but eyeball each to be sure none is another dead gate.

The selectors `[data-practice-lens="guide-tones"]` and `[data-practice-lens="tension"]` ARE expected to remain — those are still-active practice modes triggered by different UI controls. Don't touch them.

- [ ] **Step 9: Re-run unit tests and typecheck**

Run: `pnpm test --run` then `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add \
  src/components/FretboardSVG/utils/semantics.ts \
  src/components/FretboardSVG/utils/semantics.test.ts \
  src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "$(cat <<'EOF'
fix(fretboard): wire lens-emphasis glow to tokens; drop dead lens gate

Two compounding bugs left the lead-lens hold/anticipation glow invisible
in both modes after Lens Consolidation:

1. applyTonesBase returned the literal "cyan" glowColor instead of
   "var(--note-glow-hold)", so the CSS attribute selector
   [data-lens-emphasis="var(--note-glow-hold)"] never matched the
   fallback path.
2. The matching CSS rules were gated on an ancestor
   [data-practice-lens="lead"] attribute that is no longer set on the
   DOM after the lens picker was consolidated.

Tokenize the literal and narrow the LensEmphasis.glowColor type union to
the var(--*) form only. Drop the dead practice-lens ancestor gate from
the two lens-emphasis glow rules. Update the unit test assertions to
match.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Diagnose and fix 3NPS chord-tone gating

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts:148-169` (`classifyNoteFromSemantics` — relax the chord-tone gate based on diagnosis)
- Modify: `src/components/FretboardSVG/utils/semantics.test.ts` (add the 3NPS in-shape chord-tone case)

- [ ] **Step 1: Reproduce the bug in dev**

Run: `pnpm dev`

In the running app:
1. Switch to light mode.
2. Select **3NPS** fingering (Fingering control on the inspector or wherever the user-visible toggle lives in v2.0).
3. Set key to C major.
4. Open the chord overlay, set chord to **C** with a 4-note voicing covering strings 1-4.
5. Observe the fretboard. Identify at least one C, E, or G position that sits inside the visible 3NPS shape window but does NOT have chord-tone styling (no ring, no chord-tone fill). It will look like a `note-inactive` (subdued/scale-only or plain) position.

Note the specific fret coordinates of an unhighlighted in-shape chord-tone position — they're the fixture for the test in Step 4.

- [ ] **Step 2: Trace which gate excludes it**

In `src/components/FretboardSVG/utils/semantics.ts` add a temporary log near line 162 inside `classifyNoteFromSemantics` to inspect the unhighlighted position. Replace the function entry with:

```ts
export function classifyNoteFromSemantics(
  sem: NoteSemantics,
  isChordInRange: boolean,
  isInActiveShape: boolean,
  hasChordOverlay: boolean,
  isHighlighted: boolean,
): string {
  // TEMP DEBUG — remove in Step 6
  if (sem.isChordTone && hasChordOverlay) {
    // eslint-disable-next-line no-console
    console.log("[3nps-debug]", { sem, isChordInRange, isInActiveShape, isHighlighted });
  }

  if (!hasChordOverlay) {
    // ... unchanged
```

Refresh the dev page, reproduce the same setup as Step 1, and inspect the browser console. Find the log line(s) for the unhighlighted position. Note which of `isChordInRange` or `isInActiveShape` is `false`.

**Diagnosis branch A — `isChordInRange === false` for the unhighlighted in-shape position:**

The chord-overlay engine's range constraint is narrower than the 3NPS shape. The chord-tone branches in `classifyNoteFromSemantics` over-gate. **Fix shape:** drop `isChordInRange` from the chord-tone-in-scale, chord-root, and note-diatonic-chord branches (keep it on `chord-tone-outside-scale` if that branch's role is specifically the "outside scale" outlier). Proceed with branch A in Step 4.

**Diagnosis branch B — `isInActiveShape === false` for an in-shape position:**

The active-shape membership boolean is incorrectly computed for 3NPS. **Fix shape:** trace `isInActiveShape` upstream (it's computed in `useFretboardTopologyModel` or one of its dependents — `grep -rn "isInActiveShape" src/ packages/ | grep -v test`). The upstream computation likely isn't including 3NPS positions for the shape it should. Proceed with branch B in Step 4 — the fix will be in the upstream computer, not in `classifyNoteFromSemantics`.

Record which branch applies before moving to Step 3.

- [ ] **Step 3: Remove the temporary debug log**

Revert the `console.log` addition from Step 2. Run: `grep -n "3nps-debug" src/components/FretboardSVG/utils/semantics.ts` — expected empty.

- [ ] **Step 4: Write the failing test (TDD)**

In `src/components/FretboardSVG/utils/semantics.test.ts`, append to the existing `describe("classifyNoteFromSemantics", () => {` block (after the last existing `it` at the time of writing):

```ts
    it("classifies in-shape chord tones outside the voicing range as chord-tone (3NPS bug fix)", () => {
      // Repros the 3NPS bug: a fret position sits inside the active 3NPS shape
      // (isInActiveShape: true), its pitch class is a chord tone (sem.isChordTone),
      // it's in the active scale (sem.isInScale), the user has a chord overlay
      // active (hasChordOverlay: true), but the chord-voicing engine's range
      // constraint excludes it (isChordInRange: false). The expected behavior
      // is to still classify it as a chord-tone-in-scale, not note-inactive.
      const sem: NoteSemantics = {
        isScaleRoot: false,
        isChordRoot: false,
        isChordTone: true,
        isInScale: true,
        isColorTone: false,
        isGuideTone: false,
        isTension: false,
        isDiatonicChord: false,
      };
      const res = classifyNoteFromSemantics(
        sem,
        /* isChordInRange */ false,
        /* isInActiveShape */ true,
        /* hasChordOverlay */ true,
        /* isHighlighted */ true,
      );
      expect(res).toBe("chord-tone-in-scale");
    });
```

The `NoteSemantics` shape is declared at `packages/core/src/theory.ts:115-129`. The fixture above includes every required field (the seven booleans). Optional fields (`memberName`, `scaleDegree`, `isDiatonicChord`, `isFullChordMode`) are omitted or set as needed. If the type evolves and TS reports a `TS2741: Property X is missing` error, add the missing field with a neutral falsy default.

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "3NPS bug"`
Expected: FAIL — current `classifyNoteFromSemantics` requires `isChordInRange: true` for the `chord-tone-in-scale` branch, so it falls through to `note-inactive`.

- [ ] **Step 6: Apply the diagnosis fix**

**If diagnosis branch A (chord-in-range over-gates):**

In `src/components/FretboardSVG/utils/semantics.ts` find:

```ts
  if (sem.isChordRoot && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  if (sem.isDiatonicChord && sem.isChordTone && isChordInRange && isInActiveShape) return "note-diatonic-chord";
  if (sem.isInScale && sem.isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
```

Replace with:

```ts
  if (sem.isChordRoot && sem.isChordTone && isInActiveShape) return "chord-root";
  if (sem.isDiatonicChord && sem.isChordTone && isInActiveShape) return "note-diatonic-chord";
  if (sem.isInScale && sem.isChordTone && isInActiveShape) return "chord-tone-in-scale";
```

The `chord-tone-outside-scale` branch at line 167 keeps `isChordInRange` — that branch's role is the explicit "outside the scale" annotation; keeping the range gate there preserves the narrower meaning. If during impl review this also reads wrong, drop the gate there too with a comment explaining why.

Also adjust `classifyNote` (the no-semantics variant at lines 122-146) in the same way for consistency:

Find:
```ts
  if (isChordRootNote && isChordTone && isChordInRange && isInActiveShape) return "chord-root";
  if (isHighlighted && isChordTone && isChordInRange && isInActiveShape) return "chord-tone-in-scale";
```

Replace with:
```ts
  if (isChordRootNote && isChordTone && isInActiveShape) return "chord-root";
  if (isHighlighted && isChordTone && isInActiveShape) return "chord-tone-in-scale";
```

**If diagnosis branch B (active-shape membership wrong):**

Don't edit `classifyNoteFromSemantics`. Instead, locate the producer of `isInActiveShape` (likely in `src/hooks/useFretboardTopologyModel.ts` or `src/components/FretboardSVG/hooks/useNoteData.ts`) and fix the membership computation for 3NPS positions. The fix shape varies by where the wrong value originates. Update this step in the plan inline with the exact file + line, run the failing test from Step 5, and verify it now passes. Skip the `classifyNote` consistency edit since the classifier is not the source of the bug.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "3NPS bug"`
Expected: PASS.

- [ ] **Step 8: Run the full test file to confirm no regression in adjacent assertions**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: every existing test still passes. If any existing assertion broke because it relied on `isChordInRange: false` excluding a chord-tone, evaluate whether that test encoded the bug — likely it did; update it to reflect the corrected behavior. If unsure, halt and ask before changing test intent.

- [ ] **Step 9: Manual smoke verification in the running dev app**

Run: `pnpm dev` (if not already running). Repeat the Step 1 setup. Confirm: every C, E, and G position inside the 3NPS shape now displays chord-tone styling (ring, fill, etc.). Positions outside the shape stay subdued.

- [ ] **Step 10: Commit**

```bash
git add \
  src/components/FretboardSVG/utils/semantics.ts \
  src/components/FretboardSVG/utils/semantics.test.ts
# If diagnosis branch B, the file paths above differ — git add the actual edited file.
git commit -m "$(cat <<'EOF'
fix(fretboard): highlight in-shape chord tones in 3NPS

In 3NPS mode, chord-tone positions sitting inside the active shape but
outside the chord-voicing engine's narrower fret-range constraint were
falling through to note-inactive. Drop the isChordInRange gate from the
chord-root, chord-tone-in-scale, and note-diatonic-chord branches of
classifyNoteFromSemantics (and the parallel classifyNote variant) so the
shape window is the authoritative gate.

isChordInRange remains on chord-tone-outside-scale where its narrower
"outside the scale" meaning is still load-bearing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(If diagnosis branch B applied, adjust the commit message: replace the bullet list with a description of the upstream `isInActiveShape` computation fix.)

---

### Task 4: Route degree-button hover through `--chrome-hover-bg`

**Files:**
- Modify: one or more `*.module.css` files in `src/components/` (exact file list discovered in Step 1)

- [ ] **Step 1: Discover the offending hover rule(s)**

Run:

```bash
grep -rnE 'background.*#fff|background-color:\s*#fff|background:\s*white|background-color:\s*white' \
  src/components/Progression* src/components/ChordOverlay* \
  src/components/ChordPicker* src/components/ChordNavigator* \
  src/components/StepperControl* src/components/ToggleBar* \
  src/components/shared 2>/dev/null
```

If the grep returns no matches in those directories, widen:

```bash
grep -rnE 'background.*#fff|background-color:\s*#fff|background:\s*white|background-color:\s*white' \
  src/components/ 2>/dev/null
```

Inspect each match. Filter to matches that fire on `:hover`, `:focus-visible`, or in a hover-related class. List the offending files + line numbers.

If no `#fff` match is the producer, the hover might be using a different white-equivalent token (e.g. `var(--color-white)`, `var(--surface-on-light)`, an inherited UA default). Widen the search:

```bash
grep -rnE ':hover\s*\{[^}]*background' src/components/Progression* src/components/ChordOverlay* src/components/ChordPicker* src/components/ChordNavigator* 2>/dev/null
```

Inspect those `:hover` blocks for any opaque-light background that would render as cream-or-whiter on the light parchment surface.

- [ ] **Step 2: Spot-check in dev to confirm the offender**

Run: `pnpm dev` (if not running). Switch to light mode. Hover over a progression degree button and a chord-navigator button. Open browser DevTools, inspect the hovered element, find the rule producing the white background. Cross-reference with the Step 1 grep output.

If the rule is in a `*.module.css` file you found via grep — proceed to Step 3 with that file.

If the rule comes from a shared primitive (e.g. a `Button.module.css`, `StepperControl.module.css`, `Card.module.css`) that's used in multiple places — note that change here will affect every consumer of that primitive. Confirm the rule's intent: if the hover-white is deliberate for a different consumer (e.g. on a dark accent button), the fix is narrower-scoped via a modifier class. Most likely the rule is unintentionally hardcoded and the simple fix is to replace `#ffffff` with `var(--chrome-hover-bg)`.

- [ ] **Step 3: Apply the fix**

For each offending rule, replace the literal white with the token:

Find pattern (example):
```css
.degreeButton:hover,
.degreeButton:focus-visible {
  background: #ffffff;
  /* … */
}
```

Replace with:
```css
.degreeButton:hover,
.degreeButton:focus-visible {
  background: var(--chrome-hover-bg);
  /* … */
}
```

Preserve every other declaration in the rule. Repeat for every offending file located in Step 1.

If a hover declaration is intentionally inverting against an active state (e.g. on a CYAN-filled active button, hover-white provides legibility), wrap the override with a modifier or `:not(.active)` selector so the active path stays white but the resting hover uses the warm token.

- [ ] **Step 4: Verify lint**

Run: `pnpm lint`
Expected: clean. If stylelint complains about declared-value-allow-list or similar, the token is allowed — confirm the offending replacement doesn't trip a new rule.

- [ ] **Step 5: Manual smoke**

Run: `pnpm dev` (if not running). Hover over:
- Each progression degree button (the I/V/vi/IV chips in the chords row).
- Each chord-navigator button (the per-pitch-class buttons next to the chord row).
- (Bonus) Any other button that previously read as white on hover.

Expected: hover background is `--chrome-hover-bg` (warm taupe `#ddd8cf` in light, the dark-mode equivalent in dark). No flash of pure white.

- [ ] **Step 6: Dark-mode regression check**

Switch to dark mode. Hover the same buttons. Expected: no visible regression — the token resolves to the dark-mode value already defined in `themes.css` `[data-theme="modern-dark"]` block (or `:root` defaults). If the dark mode hover changed unexpectedly, the offending rule was inverting deliberately — re-scope the change per Step 3's note.

- [ ] **Step 7: Commit**

```bash
git add src/components/<discovered-files>
git commit -m "$(cat <<'EOF'
fix(theme): route degree-button hover through --chrome-hover-bg

The progression degree buttons and chord-navigator buttons hovered into a
hardcoded white background, breaking the warm-parchment palette in light
mode. Rebind those hover/focus backgrounds to the existing
--chrome-hover-bg token so they pick up the warm taupe in light mode and
the dark-mode equivalent in dark mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Optional — tune glow filter visibility if light mode reads too subtly

This task is optional. Run it only if, after Task 2 lands, manual visual review reveals the lead-lens hold/anticipation glow is still too subtle against the cream PANEL surface.

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx` (the SVG `<filter>` `<defs>` block near where `glowFilterUrls` is built)

- [ ] **Step 1: Visual verification in light mode**

Run: `pnpm dev`. Switch to light mode. Load a progression at 120 BPM, press Play. In the last beat of each step, the anticipation glow (orange rust) should be visible on the next chord's guide-tone positions. Throughout each step, the hold glow (cyan teal) should be visible on common-tone positions.

If the glow is visible and reads well → skip the rest of Task 5.

If the glow is invisible or barely perceptible against the cream → continue to Step 2.

- [ ] **Step 2: Locate the SVG `<filter>` defs**

Run: `grep -nE '<filter|<feGaussianBlur|<feFlood|glow-cyan|glow-orange' src/components/FretboardSVG/FretboardSVG.tsx`

Identify the `<filter id={svgDefId("glow-cyan")}>` and `<filter id={svgDefId("glow-orange")}>` blocks. They control how the glow renders.

- [ ] **Step 3: Tune the filter for light-mode visibility**

The two common levers:
- `<feGaussianBlur stdDeviation="N" />` — larger N = wider, softer glow.
- `<feFlood flood-color="..." flood-opacity="N" />` — higher N = stronger color saturation in the glow.

For light mode, a bigger `stdDeviation` (e.g. 2 → 3) plus a higher `flood-opacity` (e.g. 0.6 → 0.85) typically lifts visibility. If the filter currently uses a single set of values for both modes and lifting them globally would over-glow dark mode, consider either:
- Splitting the filter defs by theme (theme-aware filter generation).
- Driving the values from a CSS variable that themes can override (`--fretboard-glow-stddev`, `--fretboard-glow-opacity`).

Apply the chosen approach. Re-verify in both modes.

- [ ] **Step 4: Manual verify in both modes**

Light mode: glow visible. Dark mode: not over-saturated, still looks tasteful.

- [ ] **Step 5: Commit if changed**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "$(cat <<'EOF'
fix(fretboard): lift lens-emphasis glow visibility in light mode

The hold/anticipation glow read as too subtle against the warm cream
PANEL after the dead lens-gate was removed. Tune the SVG <filter> defs
(stdDeviation + flood-opacity) so the glow is clearly visible in light
mode without over-saturating dark mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Task 5 is skipped, do not produce an empty commit.

---

### Task 6: Visual regression baseline refresh

**Files:**
- Refresh: all `e2e/**/*.png` snapshots impacted by Tasks 1–5

- [ ] **Step 1: Build and refresh darwin baselines**

Run: `pnpm run test:visual:update`

Expected: a large diff — light-mode snapshots across `e2e/app-components/`, `e2e/app-overlays/`, `e2e/fretboard-svg/`, `e2e/app-layout/`, `e2e/app-mobile/` all update.

Watch the run for any unexpected failure (a test that fails for reasons other than visual drift — e.g. a runtime error introduced by Tasks 2 or 3). If that happens, halt and diagnose before refreshing.

- [ ] **Step 2: Inspect the diff**

Run: `git diff --stat e2e/ | tail -40`
Expected: many `.png` files changed. Spot-check 5-7 light-mode snapshots:
- A CAGED-active fretboard snapshot: CAGED-E reads lighter blue, CAGED-A reads deeper blue, CAGED-D reads warm taupe instead of gray.
- A chord-overlay-with-progression snapshot: hold glow visible on common tones.
- A 3NPS-with-chord snapshot: every in-shape chord-tone position shows the chord-tone styling.
- A progression-row snapshot with a hovered button (if the visual suite has hover-state coverage): hover background reads warm taupe.

If a snapshot reveals an unintended regression (e.g. a control becoming invisible, a layout jump), halt and address before committing.

- [ ] **Step 3: Commit the snapshot updates**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(visual): refresh darwin baselines for light-mode polish round 2

CAGED palette rebalance, lens-glow visibility, 3NPS chord-tone fix, and
warm-taupe hover state all combine to update light-mode snapshots
across the visual regression suite. Linux baselines auto-rebuild on
the next CI run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run the full verification gate locally**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 2: Run the production e2e suite (catches issues the dev-server suite misses)**

Run: `pnpm run test:e2e:production`
Expected: green. If a visual baseline diverges from the refreshed darwin set, re-run `pnpm run test:visual:update` to capture the production-build delta, then commit + re-run.

- [ ] **Step 3: Verify the branch is ready**

Run: `git log --oneline main..HEAD`

Expected: ~5-6 commits at the top of the branch:
1. (Task 1) `fix(theme): rebalance light-mode CAGED palette (E/A/D)`
2. (Task 2) `fix(fretboard): wire lens-emphasis glow to tokens; drop dead lens gate`
3. (Task 3) `fix(fretboard): highlight in-shape chord tones in 3NPS`
4. (Task 4) `fix(theme): route degree-button hover through --chrome-hover-bg`
5. (Task 5, optional) `fix(fretboard): lift lens-emphasis glow visibility in light mode`
6. (Task 6) `test(visual): refresh darwin baselines for light-mode polish round 2`

Plus the two pre-existing commits from the brainstorm session (`docs(spec)` + `chore(docs)`).

- [ ] **Step 4: Manual smoke checklist (final)**

Run: `pnpm dev`. Walk through the spec's §5 manual smoke list:
1. Light mode, CAGED, C major: confirm E/A/D polygon contrast.
2. Light mode, progression playing at 120 BPM: confirm hold + anticipation glows visible.
3. Light mode, no progression, chord with guide tones: confirm guide-tone glow visible.
4. Light mode, 3NPS + chord C: confirm every in-shape chord tone is highlighted.
5. Light mode, hover degree button + chord-navigator button: confirm warm taupe hover.
6. Dark mode: switch and re-verify the same scenarios. Expected: 3NPS fix applies; everything else looks unchanged.

If any check fails, file a follow-up commit; do not mark Task 7 complete on a partial pass.

---

## Verification summary

```bash
pnpm lint && pnpm test && pnpm build && pnpm run test:e2e:production
```
Expected: all green.

```bash
git log --oneline main..HEAD | wc -l
```
Expected: 5-7 commits (Task 5 optional; pre-existing brainstorm commits already on branch).

---

## Self-review notes

- **Spec coverage:**
  - §3 Issue 1 (CAGED rebalance): Task 1.
  - §3 Issue 2 (lens emphasis re-wire): Task 2.
  - §3 Issue 3 (3NPS chord-tone gating): Task 3.
  - §3 Issue 4 (hover white): Task 4.
  - §3 Issue 5 (visual regression refresh): Task 6.
  - §7 deferred-decision "glow visibility tuning": Task 5 (optional, gated on Task 2 result).
  - §7 deferred-decision "CAGED-D fallback to olive": flagged inline in Task 1 Step 2's commentary; impl verifier picks the fallback if visual review shows the taupe collides with `--text-muted`.
  - §5 manual smoke: Task 7 Step 4 walks the spec's six-point list.
- **Placeholder scan:** Task 3 contains branched diagnosis (A vs B) because the spec deliberately defers the diagnosis to impl. The plan provides exact code for branch A (the more likely case) and procedural guidance for branch B. Task 4 names the discovery grep and the fix shape; the specific file list crystallizes inside Step 1's output (not a placeholder, an investigation step). Task 5 is fully optional and explicitly skippable.
- **Type consistency:** `LensEmphasis.glowColor` narrowing in Task 2 Step 4 matches the type as defined in `semantics.ts:13-17`. The `NoteSemantics` shape used in Task 3 Step 4 is filled with the minimum-known field set; Task 3 Step 4 directs the engineer to grep the full declaration in `packages/core/src/` if more required fields exist, avoiding a `TS2741` failure at test compile time.
- **Frequent commits:** six commits across five mandatory tasks plus one optional task — each one self-contained, with the message body explaining the why. No squashing needed at PR time.
