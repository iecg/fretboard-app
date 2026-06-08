# Guide-Tone Countdown Ring — Design

**Date:** 2026-06-07
**Status:** Approved (design); pending implementation plan
**Supersedes:** the two-phase breathe→drain model in
[2026-06-05-guide-tone-planning-preview-design.md](2026-06-05-guide-tone-planning-preview-design.md)

## Problem

The guide-tone hint marks the next chord's guide tones (3rd, 7th) with a ring
on the fretboard. Today it runs two phases on primary (in-region) targets:

1. **Planning ("preview"):** a green ring that *breathes* on opacity over the
   runway before the change.
2. **Landing ("lead-in"):** the green core *drains* clockwise (like a clock
   hand) to empty exactly on the beat, with an on-beat flash.

The breathing phase does not convey *when* the change lands — it only signals
"a change is coming." Only the drain conveys timing, and it covers just the
final ~50% of the step (floored at 600 ms). Players get no readable countdown
for the early part of the chord, so they cannot plan a phrase against the clock.

## Goal

Convey timing clearly across the whole chord, so a player can read how much
time remains and plan a phrase — without a meaningful performance regression.

## Approach (chosen: Hybrid "C")

Replace breathe→drain on primary targets with **one continuous clockwise drain**
over a single countdown window, plus **static beat-tick notches** on the dark
halo track. The arc sweeping past each notch gives a countable "segment done"
read with zero extra animation. The existing on-beat flash remains as the
climax. Secondary (out-of-region) targets are unchanged: quiet static rings.

### Alternatives considered

- **A — single continuous drain only (idea #2 pure).** Cleanest, lowest node
  count, but at slow tempo a long arc creeps almost imperceptibly early on —
  weak "how much time left" read in the first half. Rejected: ticks fix the
  slow-creep read for negligible cost.
- **B — segmented / multi-bar drains (idea #1 pure).** Most countable, but most
  nodes + sequencing logic, and the research shows discrete timers *lower*
  perceived urgency near the beat — the opposite of what's wanted at landing.
  Rejected.

## Research basis

**Performance.** SVG `stroke-dashoffset` (the drain) is a CPU repaint every
frame — not GPU-composited — though repaint-only (no layout), so cheap per
ring. `opacity`/`transform` are composited and near-free. The drain cost scales
with how long it runs × how many rings animate at once. Static ticks never
repaint, so segmentation's countability can be had without segmentation's
animation cost.
- [High CPU when animating stroke-dashoffset (Chromium)](https://bugs.chromium.org/p/chromium/issues/detail?id=167569)
- [Hardware-accelerated animations (Chrome for Developers)](https://developer.chrome.com/blog/hardware-accelerated-animations)

**Continuous vs. segmented timers.** Continuous timers read as *more urgent*;
discrete/segmented timers read as *more countable* but less urgent. A heavily
animated interval feels *longer* (filled-duration illusion). A continuous
countdown needs a sharp coincidence event at the target — handled by the
existing on-beat flash.
- [Discrete vs. continuous timer bars (JOV)](https://jov.arvojournals.org/article.aspx?articleid=2809850)
- [Countdown timer speed trade-off (ACM TOCHI)](https://dl.acm.org/doi/10.1145/3380961)
- [Malleability of time through progress bars (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9213475/)

**Tick density.** Counting "at a glance" without scanning (subitizing) holds
only to ~3–4 items; beyond that the eye scans/counts. Matches the ~4
simultaneous-clock limit (Gu et al. 2014) already cited in the code. → cap
ticks at 4.
- [Subitizing (Wikipedia)](https://en.wikipedia.org/wiki/Subitizing)
- [Subitizing vs. counting attention (Springer)](https://link.springer.com/article/10.3758/BF03205493)

**Intensity ramp.** Looming / increasing-intensity cues capture attention and
raise perceived urgency more than static or dimming cues, and the late benefit
comes specifically from the rising intensity profile. Caveat: maxing salience
too early *hurts* reaction time (a "sweet spot" trade-off). → ramp modestly
early, reserve peak for the final lead-in + flash.
- [Looming cue urgency (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2405844023102611)
- [Auditory looming late benefit (Scientific Reports)](https://www.nature.com/articles/s41598-018-36033-8)
- [High salience can slow RT (Scientific Reports)](https://www.nature.com/articles/s41598-024-58953-4)

**Tick style.** No direct study; grounded in the codebase's own constraints +
alert-contrast research: the dark halo exists specifically for legibility over
any wood, and the ring must stay distinct from note markers. Radial notches
cut across the high-contrast halo → read as a gauge the arc sweeps. Dots on the
core path risk reading as note markers; gaps in the halo erase its contrast job
exactly at the boundaries.

## Detailed design

### 1. Behavior

Primary (in-region) guide targets show one continuous clockwise drain over a
single countdown window, with static beat-tick notches on the halo track and
the existing on-beat flash as the climax. Secondary (out-of-region) targets are
unchanged — quiet static rings at reduced opacity, no drain, no ticks.

### 2. Countdown window

The drain spans a single window ending exactly on the beat, of length
`min(step, PLANNING_RUNWAY_BARS × bar)` — reusing today's planning + lead-in
window math. Normal chords (≤ 2 bars) get a "whole chord" countdown; very long
chords stay capped so the drain never starts absurdly early.

New atoms collapse today's `planningWindowActiveAtom` / `leadInActiveAtom` into
a single window for primary targets:

- `guideCountdownWindowMsAtom` — window length in ms (the `min(...)` above).
- `guideCountdownActiveAtom` — true while the playhead is inside that window.

`leadInActiveAtom` / `planningWindowActiveAtom` and their durations may be
retired for primary-target rendering once the single window replaces them;
confirm no other consumer depends on the split before removing.

### 3. Beat-tick notches

Notch positions = beat boundaries inside the window, expressed as a time
fraction → angle on the ring (clockwise from top, matching the drain origin).

- **Adaptive cap at 4:** one notch per beat when the window spans ≤ 4 beats;
  beyond that, collapse to bar lines, or ≤ 4 evenly spaced if bar lines still
  exceed 4.
- **Suppressed when the window spans < 2 beats** (a lone notch is noise).
- Rendered as short **static radial lines across the dark halo** — drawn once,
  no per-frame repaint.
- Positions derived in `practiceLensAtoms` (pure, testable) and passed to
  `FretboardNote`.

### 4. Intensity ramp

The core stroke-width and brightness interpolate from thin/dim at window start
to thick/bright at the beat, via a single CSS animation keyed to the same
`--guide-duration`. Early intensity stays modest (sweet-spot); peak weight is
reserved for the final lead-in, with the on-beat flash as the climax.

### 5. Edge cases

- **Reduced motion:** static full ring + static ticks, no drain, no flash
  (extends today's `prefers-reduced-motion` rule). The ticks remain as a static
  gauge.
- **Short step (1 beat):** drain only, no interior ticks.
- **Meter:** ticks honor `beatsPerBar`; the cap collapses to bar lines when
  beats > 4.
- **Secondary (out-of-region) targets:** unchanged.

### 6. Performance

Per-frame cost ≈ one drain — the same arc as today, now spanning the full
window instead of the final ~50%. That longer active window is the one real
increase, bounded by the ~2–4 primary rings on screen. Ticks (static) and the
intensity ramp (same already-repainting arc) add no per-frame repaint beyond
that arc. Net: modestly above today, far below the segmented alternative (B).

### 7. Files touched

- `src/store/practiceLensAtoms.ts` — countdown-window atoms + tick-position
  derivation; collapse phase flags for primary targets.
- `src/components/FretboardSVG/utils/semantics.ts` (`getEmphasis`) — single
  countdown transition role for primary; keep quiet-static for secondary.
- `src/components/FretboardSVG/FretboardNote.tsx` — render notches; single
  drain; intensity ramp; pass window/beats.
- `src/components/FretboardSVG/FretboardSVG.module.css` — drop breathe; single
  drain over `--guide-duration`; ramp keyframes; tick styles; reduced-motion.
- `src/components/FretboardSVG/FretboardSVG.tsx` — set `--guide-duration`.

### 8. Testing

- Unit tests for the countdown-window and tick-position math in
  `practiceLensAtoms.test.ts` (window length, adaptive cap at 4, < 2-beat
  suppression, meter handling, angle mapping).
- Visual-regression snapshot refresh for the `fretboard-svg` e2e suite.
- Reduced-motion path: static ring + ticks, no drain/flash.

## Out of scope

- Changing audio/playback timing or the underlying step/bar duration model.
- Re-coloring or re-shaping note markers.
- Secondary-target behavior.
- Any progression-track / playhead UI changes.
