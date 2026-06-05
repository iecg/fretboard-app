# Two-Phase Guide-Tone Preview — Design

**Date:** 2026-06-05
**Status:** Approved for planning
**Area:** Fretboard voice-leading emphasis (`practiceLensAtoms`, `FretboardSVG/utils/semantics`, `FretboardNote`)

## Problem

The guide-tone hint is a countdown ring drawn on the **next** chord's guide tones (3rd/7th). It only appears during the **lead-in window** — the final 50% of the current step, floored at 600ms (`computeLeadInWindowMs`, `src/store/practiceLensAtoms.ts:120`). The ring blooms, contracts toward the beat, lands bright, then fades (`FretboardNote.tsx:145`, `FretboardSVG.module.css:249`).

At higher BPM the step is short, so even with the 600ms floor the hint shows up late. The player ends up **reacting** to land on the tone rather than **pre-knowing** the upcoming target and planning a phrase toward it. There is no planning runway.

This matches the canonical improvisation pedagogy (Hal Galper's *Forward Motion*, Aebersold, Levine): a soloist is taught to "start thinking about the next chord while playing the current one" and to hear a downbeat **target note** ahead of time, then build the phrase backward into it. The tool currently only supports the reactive moment, not the planning horizon.

## Goal

Give the player a **calm advance preview** of the next chord's guide tones for as much of the current chord as is useful, while preserving the existing urgent "land on the beat" payoff. One signal must clearly read as *plan* and the other as *land now*.

## Non-Goals

- No user-facing setting / configurable lead time (the pedagogy supports a leveled horizon, but that is out of scope here — fixed behavior with sensible constants).
- No change to the **current** chord's static teal guide-tone identity fill (`FretboardSVG.module.css:100`). Scale/chord color domains stay independent.
- No new fill colors and no new marker shapes. The marker shape vocabulary stays circle/diamond.

## Approach

Split the existing single preview into **two phases of the same ring element**, distinguished on the **stroke / motion** channel — an unspent, *separable* channel that composes cleanly on top of any existing fill (a teal third or amber root just gains a ring *around* it; the ring never touches the interior).

| Phase | When | Ring appearance | Meaning |
|-------|------|-----------------|---------|
| **Planning** (new) | From chord onset until the landing window begins, capped at `PLANNING_RUNWAY_BARS` (2) before the change | **Static dashed ring**, calm, no contraction animation. `"3"`/`"b7"` label shown. | "This is your next target — plan a phrase toward it." |
| **Landing** (existing) | The final lead-in window (`computeLeadInWindowMs`) | **Solid contracting ring** (existing behavior), counts down to the beat, lands bright, fades. Label persists. | "Land on this now." |

The same note's ring lifecycle across one chord: **dashed-static → solid-contracting**. The phase transition is the moment attention is (re)captured — a static form generates no sensory transient, while the contracting/looming ring does, giving a principled low→high urgency ramp.

**Pivot vs. move comes for free.** The dashed ring is placed on *all* next guide tones. What the note looks like *now* already encodes which kind it is:
- Dashed ring on a **lit chord note** → "you're already passing through this; it's the no-cost landing" (common/pivot tone, re-functions across the change).
- Dashed ring on a **dim scale note** → "travel here" (resolving guide tone, half-step move).

The existing fill does the pivot/move work; the ring just means "next target." No new vocabulary.

**Reduced motion:** the planning ring is inherently static, and the landing ring already snaps under `prefers-reduced-motion`. The dashed-vs-solid distinction survives with motion off — a redundant encoding bonus.

### Glow removal

Delete the glow underlay channel entirely (`.note-glow-underlay` element in `FretboardNote.tsx`, the `glowColor` field on `LensEmphasis`, the `--note-glow-hold` / incoming glow usage, and the associated CSS in `FretboardSVG.module.css`). It is invisible behind filled chord notes and too subtle on scale notes — fully superseded by the ring. The held-common-tone "hold" emphasis keeps its gentle `radiusBoost` size bump; only the glow paint is removed.

## Architecture / Data Flow

### 1. Timing (`src/store/practiceLensAtoms.ts`)

Add a pure window helper alongside `computeLeadInWindowMs` / `isInLeadInWindow`:

```ts
const PLANNING_RUNWAY_BARS = 2;

/**
 * True when the playhead is in the PLANNING runway — before the landing
 * window, within PLANNING_RUNWAY_BARS bars of the change. Mutually exclusive
 * with isInLeadInWindow by construction. Pure for unit testing.
 */
export function isInPlanningWindow(
  stepFraction: number,
  stepDurationMs: number,
  barDurationMs = Infinity,
): boolean {
  if (stepDurationMs <= 0) return false;
  const landingMs = computeLeadInWindowMs(stepDurationMs, barDurationMs);
  const planningSpanMs = Math.min(
    stepDurationMs,
    PLANNING_RUNWAY_BARS * barDurationMs,
  );
  if (planningSpanMs <= landingMs) return false; // no room before landing
  const startFraction = 1 - planningSpanMs / stepDurationMs;
  const endFraction = 1 - landingMs / stepDurationMs;
  return stepFraction >= startFraction && stepFraction < endFraction;
}
```

Add `planningWindowActiveAtom`, mirroring `leadInActiveAtom`'s guards (playing, frame present/not paused, `displayed === active` step alignment, deadline present) but:
- It does **not** take the boundary-gap "hold" branch (`frame.stepIndex !== displayed → true`); during that deferred-render gap the **landing** ring holds, not planning, so planning returns `false` there.
- It evaluates `isInPlanningWindow(stepFraction, stepMs, barDurationMs)`.

Planning and landing are mutually exclusive: if `leadInActiveAtom` is true, `planningWindowActiveAtom` is false, and vice versa.

### 2. Emphasis (`src/components/FretboardSVG/utils/semantics.ts`)

- Extend `TransitionRole` to `"guide-target" | "guide-preview"`.
- Add `planningActive: boolean` to `LeadLensContext` (alongside `leadInActive`).
- Remove the `glowColor` field from `LensEmphasis` and all glow assignment.
- In `getEmphasis`:
  - `leadInActive && nextGuideTones.has(notePc)` → `transitionRole: "guide-target"`, `guideTargetLabel` set, resting radius, full opacity (existing landing behavior, minus glow).
  - else `planningActive && nextGuideTones.has(notePc)` → `transitionRole: "guide-preview"`, `guideTargetLabel` set, resting radius, full opacity.
  - else → resting emphasis (held common tones keep their `radiusBoost` size bump; no glow).

`useEmphasisContext` / `useAnimatedFretboardView` thread `planningActive` from `planningWindowActiveAtom` into `LeadLensContext`.

### 3. Rendering (`src/components/FretboardSVG/FretboardNote.tsx`)

- Render the ring when `transitionRole` is `"guide-target"` **or** `"guide-preview"`. Keep `key="guide-ring"` stable across the phase change so the element morphs rather than remounting.
- Emit `data-guide-phase="preview" | "landing"` for CSS to branch on.
- Planning (`preview`): motion fades opacity to a calmer rest (≈0.7); no CSS contraction.
- Landing (`landing`): existing solid contracting behavior. The contraction keyframe must start near the preview's resting size, **not** re-bloom from `scale(2.4)`, so the phase transition reads as "the calm ring tightens and lands" rather than a jarring re-entry. (Tune keyframe in implementation; e.g. a slight pulse to `~1.15` then contract to `1`.)
- Show the `"3"`/`"b7"` label in both phases (label already keyed off `guideTargetLabel`).
- Remove the `.note-glow-underlay` `<circle>`.

### 4. CSS (`src/components/FretboardSVG/FretboardSVG.module.css`)

- `.note-guide-ring[data-guide-phase="preview"]`: `stroke-dasharray` (calm dashed, e.g. `3 3`), `animation: none`, static. Reuses the existing `--note-incoming` hue (no new color).
- `.note-guide-ring[data-guide-phase="landing"]`: existing solid contracting animation, keyframe adjusted per above.
- Remove `.note-glow-underlay` rules and the `prefers-reduced-motion` glow-transition rule.
- `prefers-reduced-motion`: landing ring already snaps; preview is static — no extra rule needed beyond removing the glow rule.

## Constants

- `LEAD_IN_PROPORTION = 0.5` (unchanged)
- `LEAD_IN_FLOOR_MS = 600` (unchanged)
- `PLANNING_RUNWAY_BARS = 2` (new)

## Edge Cases

- **Very fast tempo (step ≤ landing floor):** the landing window covers the whole step, `isInPlanningWindow` returns false (no room) — the entire step is the countdown. The previous chord's planning ring already showed this target. Acceptable.
- **Long/slow chord (> 2 bars):** planning runway is capped at 2 bars before the change, so the dashed ring does not sit for the chord's full duration (avoids a premature target). At high BPM the cap never bites — the player gets the whole short chord as runway, which is the win.
- **Last step, loop disabled:** `nextChordTones` / guide-tone atoms already return empty — no preview, no planning ring.
- **Power chords / no 3rd in next chord:** `nextChordGuideToneLabels` already returns empty — no targets.
- **Boundary-gap deferred render:** planning yields to landing during the `frame.stepIndex !== displayed` hold (landing already covers it).

## Testing

- **Unit (pure):** `isInPlanningWindow` — room/no-room, mutual exclusivity with `isInLeadInWindow`, 2-bar cap, fast-tempo (no room), boundary fractions.
- **Atom:** `planningWindowActiveAtom` — playing/paused, displayed≠active guard, deadline-null guard, in-window vs. out-of-window, mutual exclusivity with `leadInActiveAtom`.
- **Emphasis:** `getEmphasis` returns `guide-preview` in planning, `guide-target` in landing, resting otherwise; both set the label; no `glowColor` field remains; held-common-tone radius bump preserved. Update `semantics.test.ts`.
- **Component:** `FretboardNote` renders dashed `preview` ring + label in planning, solid `landing` ring in landing; glow underlay element gone.
- **Visual regression:** refresh `fretboard-svg` / `app-overlays` darwin (and linux) snapshots for the dashed planning ring and glow removal.
- `vitest-axe`: rings/labels remain `aria-hidden` (decorative); no a11y regression.

## Rollout / Verification

Run `pnpm run lint`, `pnpm run test`, `pnpm run build` locally before PR (mandatory). Manually verify at a high BPM that the dashed target ring appears at chord onset, then tightens into the solid contracting ring at the change. Update visual snapshots via `pnpm run test:visual:update`.

## Files Touched

- `src/store/practiceLensAtoms.ts` — `isInPlanningWindow`, `planningWindowActiveAtom`, `PLANNING_RUNWAY_BARS`.
- `src/components/FretboardSVG/utils/semantics.ts` — `TransitionRole`, `LeadLensContext.planningActive`, `getEmphasis`, remove `glowColor`.
- `src/components/FretboardSVG/hooks/useEmphasisContext.ts` + `useAnimatedFretboardView.ts` — thread `planningActive`.
- `src/components/FretboardSVG/FretboardNote.tsx` — two-phase ring render, `data-guide-phase`, remove glow underlay.
- `src/components/FretboardSVG/FretboardSVG.module.css` — dashed preview ring, landing keyframe, remove glow rules.
- Co-located tests + `e2e/` snapshots.
