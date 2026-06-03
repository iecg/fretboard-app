# Additive Target Emphasis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During a chord transition the board holds still — nothing dims, resizes, or flickers. The only motion is the guide-target ring contracting in (countdown) and dissolving out on the targets. Removes the global dim (#1), the hold-glow flicker (#2), the target bloom revert (#5), and the ring/label pop-out (#3/#4).

**Architecture:** `getEmphasis` becomes additive — only the next chord's guide tones deviate from their resting emphasis (full opacity + glow + ring + label, **no size change**); every other note returns its resting emphasis untouched (no dim). The ring/label exit is handled by reshaping their CSS keyframes to end at `opacity: 0` ("dissolve on land"), so the conditional unmount at the downbeat is imperceptible — no `AnimatePresence`, no `FretboardNote` change.

**Tech Stack:** React 19 + TS, Jotai, CSS Modules, Vitest. Continuous motion stays compositor-only (`transform`/`opacity`).

**Spec:** `docs/superpowers/specs/2026-06-03-additive-target-emphasis-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/components/FretboardSVG/utils/semantics.ts` | Task 1 — additive `getEmphasis`, delete `LEAD_IN_DIM_OPACITY` |
| `src/components/FretboardSVG/utils/semantics.test.ts` | Task 1 — rewrite lead-in suite |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Task 2 — ring/label dissolve-on-land keyframes; remove the lead-in dim-ramp rule |

`FretboardNote.tsx` is intentionally **not** modified — the ring/label stay conditionally rendered; the fade-out is purely a keyframe change.

---

## Task 1: Additive `getEmphasis` — no dim, no bloom

**Files:**
- Modify: `src/components/FretboardSVG/utils/semantics.ts`
- Test: `src/components/FretboardSVG/utils/semantics.test.ts`

The current lead-in branch blooms the target to `radiusBoost: 1.15` and dims every non-target to `opacityBoost: 0.4`. New behavior: the **only** note that deviates from its resting emphasis during the lead-in is a target, and it keeps its resting size (no bloom) — just full opacity + glow + ring + label. Non-targets return `resting` unchanged.

- [ ] **Step 1: Rewrite the lead-in test suite**

In `src/components/FretboardSVG/utils/semantics.test.ts`, inside `describe("getEmphasis - voice-leading emphasis")`, **keep** the `falls back to tones-base when leadContext is undefined` test, the `does NOT dim when there are no targets (empty guide set)` test, and the two `outside the lead-in window …` tests. **Replace** the `marks a next-chord guide tone …`, `guide-target fires regardless …`, and BOTH `dims a non-target …` tests with the following (read the file first to match the exact current titles, since prior rounds renamed them):

```ts
  it("marks a next-chord guide tone as 'guide-target' with full opacity and NO size bloom", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "B",
      nextGuideTones: new Set(["B"]),
      nextGuideToneLabels: new Map([["B", "3"]]),
    };
    // scale-only rests at radius 0.85; the target keeps that size (no bloom),
    // is brought to full opacity, and gets the ring hue + role + label.
    expect(getEmphasis("scale-only", false, ctx)).toEqual({
      glowColor: "var(--note-incoming)", radiusBoost: 0.85, opacityBoost: 1,
      transitionRole: "guide-target", guideTargetLabel: "3",
    });
  });

  it("guide-target fires regardless of the underlying noteClass", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "F", nextGuideTones: new Set(["F"]),
    };
    expect(getEmphasis("note-inactive", false, ctx).transitionRole).toBe("guide-target");
  });

  it("a non-target scale note is UNCHANGED during lead-in (no dim)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set(["B"]),
    };
    // Resting scale-only emphasis — NOT dimmed to 0.4.
    expect(getEmphasis("scale-only", false, ctx)).toEqual({ radiusBoost: 0.85, opacityBoost: 0.7 });
  });

  it("a non-target chord tone is UNCHANGED during lead-in (no dim)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "C", nextGuideTones: new Set(["B"]),
    };
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({ radiusBoost: 1, opacityBoost: 1 });
  });

  it("a held common tone keeps its hold glow DURING the lead-in (no flicker)", () => {
    const ctx: LeadLensContext = {
      ...baseLeadContext, notePc: "A",
      commonWithNext: new Set(["A"]), nextGuideTones: new Set(["B"]),
    };
    // Carried note is untouched by the lead-in → keeps its resting hold glow.
    expect(getEmphasis("chord-tone-in-scale", false, ctx)).toEqual({
      glowColor: "var(--note-glow-hold)", radiusBoost: 1.15, opacityBoost: 1,
    });
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts -t "voice-leading emphasis"`
Expected: FAIL — targets still bloom to 1.15; non-targets still dim to 0.4.

- [ ] **Step 3: Make `getEmphasis` additive**

In `src/components/FretboardSVG/utils/semantics.ts`:

Delete the `LEAD_IN_DIM_OPACITY` constant and its doc comment (just above `getEmphasis`).

Replace the lead-in block — from the `// Lead-in:` comment through the `return resting;` at the end — with:

```ts
  // Lead-in: ONLY the next chord's guide tones deviate from their resting
  // emphasis. A target keeps its resting SIZE (no bloom), is brought to full
  // opacity, and gets the ring hue + role + label. Every other note returns its
  // resting emphasis untouched — nothing dims, so the board holds still and the
  // ring's onset carries the attention by itself.
  if (leadInActive && nextGuideTones.has(notePc)) {
    return {
      glowColor: "var(--note-incoming)",
      radiusBoost: resting.radiusBoost,
      opacityBoost: 1,
      transitionRole: "guide-target",
      guideTargetLabel: nextGuideToneLabels.get(notePc),
    };
  }
  return resting;
```

(The `resting` computation just above this block is unchanged. `nextGuideTones.has(notePc)` is false for an empty set, so no separate `size > 0` guard is needed.)

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/components/FretboardSVG/utils/semantics.test.ts`
Expected: PASS (whole file).

- [ ] **Step 5: Check no other test asserted the removed behavior**

Run: `grep -rn "0.4\|opacityBoost: 0.4\|LEAD_IN_DIM_OPACITY\|radiusBoost: 1.15" src/components/FretboardSVG/utils/semantics.test.ts src/components/FretboardSVG/FretboardSVG.test.tsx src/components/FretboardSVG/FretboardNote.test.tsx`
For any hit that asserted the old dim (0.4) or the old target bloom (1.15 on a guide-target), confirm it's been updated or is unrelated. Then run those component suites:
Run: `pnpm vitest run src/components/FretboardSVG/FretboardSVG.test.tsx src/components/FretboardSVG/FretboardNote.test.tsx && pnpm exec tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/utils/semantics.ts src/components/FretboardSVG/utils/semantics.test.ts
git commit -m "feat(fretboard): additive lead-in emphasis — no dim, no target bloom"
```

---

## Task 2: Ring & label dissolve on land; drop the dim-ramp CSS

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css`

The ring currently ends its keyframe at `opacity: 0.95`, so its conditional unmount at the downbeat is a hard pop. Reshape it to **dissolve to `opacity: 0` as it lands**, so the unmount is imperceptible. Give the label a matching fade so it doesn't pop either. Remove the lead-in dim-ramp rule (it only existed to ease the now-removed global dim).

- [ ] **Step 1: Reshape the ring keyframe to dissolve on land**

Replace the `@keyframes note-guide-target-ring` block:

```css
@keyframes note-guide-target-ring {
  0%   { opacity: 0;   transform: scale(2.4); }
  20%  { opacity: 0.9; }
  75%  { opacity: 0.9; transform: scale(1.08); }
  100% { opacity: 0;   transform: scale(1); }
}
```

The ring fades in fast, stays bright while it contracts (the countdown), then dissolves onto the note as it lands on the downbeat — so when React unmounts it (role clears at the downbeat) it is already invisible. No pop, pure compositor (`opacity`/`transform`).

- [ ] **Step 2: Give the label a matching fade (so it doesn't pop in or out)**

Add a keyframe and apply it to `.note-guide-label`. Change the `.note-guide-label` rule to add the animation line, and add the keyframe after it:

```css
.note-guide-label {
  dominant-baseline: middle;
  fill: var(--note-incoming);
  font-size: 9px;
  font-weight: 600;
  pointer-events: none;
  text-anchor: start;
  animation: note-guide-label-fade var(--lead-in-duration, 0.6s) ease-out both;
}

@keyframes note-guide-label-fade {
  0%   { opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
```

The label is readable through the middle of the window and fades out as the chord lands.

- [ ] **Step 3: Reduced-motion — keep ring & label static (no fade-out pop is acceptable without motion)**

In the existing `@media (prefers-reduced-motion: reduce)` block, the `.note-guide-ring` already overrides `animation: none; opacity: 0.9; transform: none;`. Add the label to that block so it stays statically visible:

```css
  .note-guide-label {
    animation: none;
    opacity: 1;
  }
```

(Place it alongside the existing `.note-guide-ring` reduced-motion override.)

- [ ] **Step 4: Remove the lead-in dim-ramp transition rule**

Delete the rule added last round (it eased the global dim, which no longer exists):

```css
.fretboard-board[data-transition-phase="lead-in"] [data-motion="css"] .fretboard-note {
  transition: opacity var(--lead-in-duration, 0.6s) ease, transform 0.3s ease;
}
```

(plus its leading comment). The target's fade to full opacity now eases via the base `[data-motion="css"] .fretboard-note { transition: opacity 0.15s …}` rule — a quick, clean brighten.

- [ ] **Step 5: Verify lint + build + the existing render tests still pass**

Run: `pnpm run lint && pnpm exec tsc -b && pnpm vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: stylelint 0 errors (fix any property-order complaints on the new rules, preserving intent); tsc clean; the ring/label render tests still pass (the elements still render; only their keyframes changed).

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): ring & label dissolve on land; drop dim-ramp"
```

---

## Task 3: Full verification + visual handoff

**Files:** none (verification only)

- [ ] **Step 1: Gates**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint 0 errors (the one pre-existing `useFretboardTopologyModel` exhaustive-deps warning is acceptable); all tests pass; build OK.

- [ ] **Step 2: Confirm the dim is gone end-to-end**

Run: `grep -rn "LEAD_IN_DIM_OPACITY\|opacityBoost: 0.4\|data-transition-phase=.lead-in.. \[data-motion" src/`
Expected: no matches for `LEAD_IN_DIM_OPACITY` or the `0.4` dim; the `data-transition-phase="lead-in"` board attribute may still be set in `FretboardSVG.tsx` (harmless — no CSS consumes it now).

- [ ] **Step 3: Manual visual verification (user)**

Hand off: run `pnpm run dev` from the `voice-leading-motion` worktree, play a progression, and confirm during each transition:
- nothing on the board dims or resizes; carried (held) notes no longer flicker;
- only the guide-target ring animates — contracting in (countdown) and dissolving out on the downbeat (no pop);
- the degree label fades rather than popping;
- targets are clearly visible (full opacity) even when they were dim scale notes — flag if a scale-only target reads too small (its size is intentionally unchanged; easy to bump if needed).

---

## Self-Review

**Spec coverage:**
- Change 1 (additive `getEmphasis`: target full-opacity + resting size, non-targets untouched, delete dim) → Task 1. ✓
- #2 hold-glow flicker fixed for free (held common tones return resting) → asserted by the "held common tone keeps its hold glow DURING the lead-in" test. ✓
- Change 2 (ring/label fade out, not pop) → Task 2 dissolve-on-land keyframes (the chosen lowest-machinery mechanism). ✓
- Change 3 (CSS cleanup — remove dim ramp) → Task 2 Step 4. ✓
- Reduced motion preserved → Task 2 Step 3. ✓
- Testing (non-targets resting; target full-opacity + no bloom; empty set resting) → Task 1 Step 1. ✓
- Out of scope (guide-tone selection, ring contraction timing, audio) → untouched. ✓

**Placeholder scan:** none. Mechanism for the exit is concretely the dissolve-on-land keyframe (decided at plan time per the spec).

**Type/behavior consistency:** target returns `resting.radiusBoost` (no new field); `LEAD_IN_DIM_OPACITY` removed and grep-checked; non-target path is the single `return resting`. `FretboardNote` untouched, so the ring/label still render conditionally and the keyframes drive their dissolve.
