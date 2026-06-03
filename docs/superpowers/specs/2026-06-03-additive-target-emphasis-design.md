# Additive Target Emphasis — Remove the Lead-In Dim & Reverting Motion

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Builds on:** `2026-06-02-guide-tone-targets-design.md` (same branch `claude/voice-leading-motion`, PR #512). Refines the lead-in cue established there.

## Why

Visual testing of the guide-tone cue surfaced that the lead-in does too much transient work on every chord change, and most of it lands on notes that aren't the message. A review of the emphasis pipeline and note render found **five** "change-then-revert" effects firing on each transition:

| # | Effect | What happens each transition | On which notes |
|---|---|---|---|
| 1 | **Global dim** | every non-target fades to 0.4 opacity, then back | the whole board |
| 2 | **Hold-glow flicker** | held common tones lose their steady "hold" glow during the lead-in, then regain it | the *carried* notes (most stable notes blink) |
| 3 | **Ring pop-out** | the ring animates *in* but vanishes instantly at the downbeat | the targets |
| 4 | **Label pop** | the degree label appears/disappears with no fade | the targets |
| 5 | **Target bloom revert** | targets grow to 1.15× and shrink back | the targets |

#1 and #2 are pure distraction — irrelevant notes pulsing and carried notes flickering, neither conveying information. The fix for #1 also removes #2 for free (stop touching non-targets → held notes keep their glow).

## Goal

The board holds still during a transition. The **only** motion is the ring contracting in on the next chord's guide tones and fading out on the downbeat (glow + label riding along). Nothing dims, nothing resizes, nothing flickers. Information stays focused on the targets; distraction is minimized. No performance regression (continuous motion stays compositor-only).

## Research basis (why additive, ring-only)

- **Onset capture** (the abrupt appearance of a new mark) is the strongest involuntary attention cue — stronger than motion, color change, or luminance suppression. The ring *appearing* IS that cue, so it carries the attention by itself; the global dim was a secondary amplifier that cost a full-board luminance swing.
- The **size bloom is redundant** with the ring (two signals for "here") and is a reverting size change — exactly the "movement without added information" to cut (Tversky's congruence/apprehension principles).
- A **sudden offset is an unnecessary transient** — an abrupt pop at the downbeat is a second, meaningless attention-grab right as the chord arrives. A short fade-out avoids it; the meaningful fade-*in* (the countdown contraction) stays.

## Design

### Change 1 — `getEmphasis`: target-only, additive (`src/components/FretboardSVG/utils/semantics.ts`)

During the lead-in (`leadInActive && nextGuideTones.size > 0`):
- **Target** (`nextGuideTones.has(notePc)`): `glowColor: "var(--note-incoming)"`, `opacityBoost: 1` (full visibility — a target that was a dim scale note becomes clearly visible), `radiusBoost: <resting radius>` (**no bloom — size unchanged**), `transitionRole: "guide-target"`, `guideTargetLabel`.
- **Non-target:** return the note's **resting** emphasis, unchanged. No dim.

Delete the `LEAD_IN_DIM_OPACITY` constant and the dim branch. Outside the lead-in, behavior is unchanged (`resting`).

This single change removes #1 (no dim) and #2 (held common tones keep their resting hold glow — never touched) and #5 (targets no longer resize). The target's `radiusBoost` is set to the value it would have at rest, so a target never changes size when the window opens or closes.

> Note: the target's opacity does rise to full (e.g. a scale-only target at resting 0.7 → 1.0). This is a single, meaningful change on the target itself (it must be clearly visible), not board-wide noise — and it eases in (see Change 3).

### Change 2 — Ring & label fade out instead of popping (`FretboardNote.tsx` + CSS)

The ring's contraction-in (the countdown) is unchanged. At the downbeat, when a note stops being a target, the ring and label **fade out (~150ms)** rather than unmounting instantly.

Mechanism (decided in the plan, lowest-machinery option preferred):
- **Preferred:** keep the ring/label elements present during the lead-in and drive their visibility via a state/attribute so CSS `transition` handles the exit fade — avoiding per-note `AnimatePresence`.
- **Fallback:** if a clean CSS-state approach proves awkward (the enter is a keyframe `animation`, the exit a `transition` on the same element), use `AnimatePresence` (motion/react), for which the connector layer is existing precedent.

The plan will pick the mechanism after a short spike; the *behavior* (fade-out, no pop) is the spec.

### Change 3 — CSS cleanup (`FretboardSVG.module.css`)

The lead-in transition rule added last round (`[data-transition-phase="lead-in"] … transition: opacity var(--lead-in-duration) …, transform 0.3s`) was there to ease the global dim. With no dim, the only opacity change during the lead-in is the target's fade to full visibility. Simplify the rule so it eases the **target's** fade-in cleanly and no longer implies a board-wide ramp. Reduced motion: static ring, no fades (unchanged principle).

## Testing

- **`getEmphasis` unit (`semantics.test.ts`):** rewrite the lead-in suite.
  - Non-target notes during the lead-in return their **resting** emphasis unchanged — explicit regression guards against re-introducing a dim, for: a scale-only note (`{radiusBoost: 0.85, opacityBoost: 0.7}`), a plain chord tone (`{radiusBoost: 1, opacityBoost: 1}`), and a held common tone (keeps `var(--note-glow-hold)`, `1.15`, `1`).
  - A target returns full opacity + `var(--note-incoming)` glow + `guide-target` role + label, with **`radiusBoost` equal to its resting value** (no bloom): assert a scale-only target stays `radiusBoost: 0.85` (not 1.15) and `opacityBoost: 1`.
  - Empty guide set → all notes resting (no change).
- **Ring/label fade-out:** a render/DOM test appropriate to the chosen mechanism (e.g. the ring/label remain in the DOM with a fading state at the boundary, or an `AnimatePresence` exit is scheduled). Visual smoothness is verified manually.
- **Visual:** verified in `pnpm run dev` (the animation is not unit-assertable).

## Out of scope

- Guide-tone selection (3rd/7th, triad → 3rd only) — unchanged.
- The ring's contraction-in animation and `--lead-in-duration` timing — unchanged.
- Audio / playhead / lead-in window timing — unchanged.
- Re-introducing any departing/dim cue (the rejected alternative).
