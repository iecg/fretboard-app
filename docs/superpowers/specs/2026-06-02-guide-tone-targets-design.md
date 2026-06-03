# Guide-Tone Targets — Replacing the Slide with a Beat-Synced Target Cue

**Date:** 2026-06-02
**Status:** Approved (pending spec review)
**Supersedes:** the slide/translation model from `2026-06-01-voice-leading-motion-design.md` and `2026-06-02-voice-leading-motion-pass2-design.md`. Same branch (`claude/voice-leading-motion`, PR #512). **Keeps** the step-relative lead-in timing built in pass 2; replaces what the lead-in renders.

## Why a third pass

After two passes the slide still read as inconsistent — "sometimes notes slide, sometimes they just appear" — and the user questioned whether sliding conveys the information at all. We did dedicated research on guitar-improvisation pedagogy and on the visual-perception / data-viz literature. Both converged, and the perception side *explains the complaint* rather than just disagreeing with it.

### What the research found

**Perception — why translation feels inconsistent.** Animated *translation* ("this note slides to that note") aids comprehension only under tight conditions: few, non-crossing paths, ~0.5–1s duration, staged one at a time (Heer & Robertson, object constancy; Tversky et al., the apprehension principle). ≤6 dots sliding along *crossing* paths over a dense field, every ~2s, at beat speed (~0.5s at 120bpm — the *floor* of the legible window) violates all of those. The reliable involuntary "look here" cue is the **abrupt appearance of a new mark (onset capture)** — not motion, not color change. The slide was fighting perception; the reported failure mode is the predicted one.

- Heer & Robertson, *Animated Transitions in Statistical Data Graphics* (IEEE InfoVis 2007) — https://idl.uw.edu/papers/animated-transitions
- Tversky, Morrison & Bétrancourt, *Animation: Can It Facilitate?* (IJHCS 2002) — https://hci.stanford.edu/courses/cs448b/papers/Tversky_AnimationFacilitate_IJHCS02.pdf
- *Attention capture by abrupt onsets* (Frontiers in Psychology, 2013) — https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00958/full
- Healey & Enns, *Attention and Visual Memory in Visualization* — https://www.csc2.ncsu.edu/faculty/healey/PP/

**Pedagogy — what's worth showing.** Improvisation teaching is unanimous: the notes that matter at a chord change are the **guide tones — the 3rd and 7th**. They define chord quality (root and 5th are harmonically inert); the deterministic voice-leading rule is the 7th resolving by half-step into the next chord's 3rd. Restricting the cue to guide tones is simultaneously the pedagogically correct content *and* the natural anti-clutter constraint (two pitch classes, not six). No existing tool previews the next chord's target notes on the fretboard a beat ahead — Soundslice/Guitar Pro light the *current* note; iReal Pro shows the next chord *name* only. Real gap.

- Guide tones / 3rds & 7ths — https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/use-guide-tones-navigate-chord-changes/
- Targeting chord tones on strong beats — https://www.jazzetudes.net/post/mastering-jazz-improvisation-the-art-of-targeting-chord-tones-for-intermediate-players
- Hal Galper, *Forward Motion* ("feeling them coming up") — https://halgalper.com/articles/forward-motion-fingerings/

## Goal

During a progression, a beat before each chord change, **bloom the next chord's guide tones (3rd & 7th) into focus** wherever they sit in the active region, and dim everything else — a clear, predictable "aim here next" for the soloist. No slide. No per-frame React; continuous motion is compositor-driven (`transform`/`opacity`). No performance regression.

## Decisions (settled in brainstorming)

- **Intent:** improvisation — "where to solo next." (Not comping / full-shape preview.)
- **Target scope:** **all occurrences** of the next chord's 3rd & 7th within the active region. Deterministic and self-limiting (only ever two pitch classes), so it cannot sprawl the way the pairing-based slide did. The dim-the-rest layer keeps it readable. Narrowing to "nearest" is a trivial future dial.

## Approach

Replace the per-note translation model with a three-layer, beat-synced **target cue** riding the existing emphasis layer.

### Change 1 — Content: light up the next chord's guide tones

During the lead-in window, derive the **next** chord's 3rd and 7th pitch classes and emphasize **every in-region rendered note** whose pitch class matches. Everything else dims. Deterministic — no pairing heuristic.

- **Pure helper** `getGuideTonePitchClasses(chordSymbol)` in `@fretflow/core` → `{ third, seventh }` as sharps-internal pitch classes, backed by the existing Tonal chord layer. Triads (no 7th) fall back to **3rd + 5th** so there are always two targets. (Tunable; documented.)
- **Atom** `nextChordGuideTonesAtom` reads the *next* progression step (`activeProgressionStepIndex + 1`, wrapping when loop is enabled; empty set when not playing, no progression, or the last step of a non-looping progression) and returns the guide-tone pitch classes.
- **Scope:** emphasize guide tones **already rendered** in the active region (the common scale-view case). A guide tone chromatic to the current scale (e.g. a secondary dominant's 3rd) is not on the board — **out of scope for v1** (future dial: optionally surface it as an added ghost note).

### Change 2 — The visual cue (three compositor-only layers)

1. **Onset (look here).** Targets fade in (`opacity`) at the start of the lead-in window. Onset capture is the strongest involuntary attention cue.
2. **Expanding ring = countdown (get ready… now).** Each target gets a thin SVG ring (`<circle>`, no fill) animating `transform: scale` + `opacity` over the lead-in window — starts wide/faint, **contracts and brightens to land on the target exactly at the downbeat**. A literal visual countdown synced to the beat. One gesture per chord, so it reads as rhythm, not nagging. Enclosure is pre-attentive and orthogonal to the hue channel the note-roles already use.
3. **Dim-the-rest spotlight.** Non-target notes drop opacity (one layer-level `opacity`). Luminance suppression is the most primal pop-out channel and the cheapest operation; it makes two pitch classes dominate ~20 dots without spending a new color.

On the downbeat: ring lands and fades, dim lifts, targets become the now-active chord.

- **Degree label** (`3` / `b3` / `7` / `b7`) on the target — pairs the cue with meaning and satisfies a11y (not color-alone).
- **No new hue** — targets reuse the existing guide-tone / `note-blue` emphasis color; ring + label + dim do the work. Scale/chord color domains stay independent.
- **`prefers-reduced-motion`:** drop the ring animation and fades; static highlight + dim that toggles on at the window.

### Change 3 — Integration & deletions

- **Reuse pass-2 timing as-is:** `leadInActiveAtom`, `isInLeadInWindow`, `stepRelativeFraction`, and the deadline refresh in `setProgressionActiveStepIndexAtom`. The timing was correct; only the payload changes.
- **`getEmphasis` (`src/components/FretboardSVG/utils/semantics.ts`)** gains the next-chord guide tones via context; during lead-in, an in-region rendered note whose pitch class is a guide tone gets a new role `guide-target`; other in-region notes get the dim treatment. Outside lead-in, unchanged.
- **`FretboardNote`** renders the ring + degree label + onset when role is `guide-target`. The dim is a layer-level `opacity` on non-targets.
- **This replaces #511's full-chord ghost preview** — instead of fading in the entire next chord, the lead-in blooms only the two guide tones and dims the rest. The transition-role infrastructure (incoming/departing/held) stays for internal use but no longer drives a slide.
- **Delete:** `src/components/FretboardSVG/utils/voiceLeading.ts` (pairing + span/cap constants); `voiceLeadOffset` on `RenderedFretboardNote` and its 3-pass stamping in `buildRenderedFretboardNotes` (`useAnimatedFretboardView.ts`); the `--vl-dx/--vl-dy` emission in `FretboardNote`; the `note-incoming-slide` keyframe in `FretboardSVG.module.css`; and all tests pinned to the slide model.

## Performance (the standing constraint)

- Lead-in toggles emphasis → **≤2 React re-renders per step** (window open, downbeat). No per-frame React.
- The ring is a pure CSS keyframe with `animation-duration` set from the lead-in window length (a CSS var), so it **lands on the downbeat with no per-frame JS**.
- Dim is a single `opacity` change. Everything is `transform`/`opacity` — compositor-driven, no layout/paint, no regression.

## Testing

- **`getGuideTonePitchClasses` (pure):** correct 3rd & 7th for maj7, min7, dom7, m7b5; triad → 3rd + 5th fallback; diminished; handles enharmonics (sharps-internal).
- **`nextChordGuideTonesAtom`:** selects the next step; wraps on the last step when looping; empty when not playing / no progression / last step non-looping.
- **`getEmphasis`:** in-region note matching a guide-tone pitch class → `guide-target` only during lead-in; non-matching in-region notes → dim; nothing outside lead-in.
- **Reduced-motion:** the static-fallback class/attribute is applied (the media-query behavior itself is visual).
- **Update/remove** all tests pinned to the slide model.
- **Visual:** verified manually in `pnpm run dev` (the animation is not unit-assertable).

## Out of scope

- Comping / full next-voicing shape preview (the rejected fork).
- Surfacing guide tones that are chromatic to the current scale (future dial).
- "Nearest target only" narrowing (future dial).
- Connector/arrow between current and next guide tone (research ranked it lower for clutter; possible later supplement).
- Any change to the audio scheduler / playhead / `timeline.ts`.
