# Expose Voicing Knobs as Controls — Design (DRAFT)

**Date:** 2026-06-03
**Status:** Draft — not approved. Open questions in §5 must be resolved first.
**Depends on:** [Strum Inversion Voicing](2026-06-03-strum-inversion-voicing-design.md) (must ship and have its defaults tuned by ear first — this exposes the constants that work establishes).

## Motivation

The strum voicing engine has a handful of constants that strongly shape how a progression *sounds* — arguably as much as the chord choices themselves — but they are hardcoded module-level values in `src/progressions/voicingEngine.ts`:

- `REGISTER_CENTER` — the register the whole comp gravitates toward (low/dark ↔ high/bright).
- `STRUM_VOICING_SCORE_WEIGHTS`:
  - `lead` vs `center` — the **voice-leading-smoothness ↔ register-stability** trade. High `lead` = chords glide with minimal motion (can drift register); high `center` = chords stay in a register band (can leap more).
  - `span` — compact ↔ open/spread grips.
  - `bassFifth` — how strongly 2nd-inversion (5th-in-bass) grips are avoided.

Once the inversion-voicing work lands and these have good defaults, exposing the impactful ones lets a user shape the comp character (e.g. "darker and smoother" vs "brighter, more open") without code changes.

## Goal

Surface the high-impact knobs as user controls, mapped to **intuitive musical language**, not raw weights — while keeping the tuned defaults as the out-of-the-box sound.

## Proposed exposure (tiered)

**Tier 1 — simple, ship first:**

- **Voicing register** (maps to `REGISTER_CENTER`): a small set of labelled choices — e.g. *Low / Mid / High* — rather than a raw semitone slider. The single most audible knob.
- **Voice leading** (maps to the `lead`÷`center` ratio): *Smooth ↔ Anchored* — a 2–3 stop control trading glide for register stability.

**Tier 2 — advanced / optional, behind a disclosure:**

- **Voicing spread** (`span`): *Compact ↔ Open*.
- **Inversion preference** (`bassFifth`): whether to allow 5th-in-bass grips.

Presets ("Mellow comp", "Bright open", "Tight & smooth") that set several knobs at once are likely a better primary UX than individual sliders — confirm in §5.

## Architecture sketch

The knobs are module constants today. To expose them:

1. **Move them into config, not constants.** Extend `VoicingPreset` (or add a sibling `VoicingConfig`) to carry `registerCenter` and the weights, with the tuned values as defaults. `buildVoicing` already takes a `preset` argument — thread the config through it instead of reading module constants.
2. **Add a `voicingConfig` to `BuildAllLayersInput`.** Currently the progression audio path is config-light; `buildAllLayersAsync` would receive the config and pass it into `buildVoicing`. (Same insertion point as the engine call at `buildAllLayers.ts:231`.)
3. **Atoms + persistence.** A `voicingConfigAtom` (Jotai, `atomWithStorage` via `src/utils/storage.ts`) holds the user's choices; `useProgressionAudioPlayback` reads it into `BuildAllLayersInput`. Maps the Tier-1 labels → concrete values in one place.
4. **UI.** A "Voicing" subsection in the progression/sound controls (near tempo/genre), using existing primitives (`ToggleBar`/`LabeledSelect`/`StepperControl`). Tier-2 behind a disclosure.

Funk and Bossa color builders ignore these knobs (their own hand-tuned grips), so the controls apply to the default strum path only — the UI copy should reflect that, or the controls should disable/annotate when a funk/bossa genre is active.

## Scope

- **In scope:** plumbing the existing tuned constants into configurable state + Tier-1 controls.
- **Out of scope (for the first cut):** the close-voicing-fallback **visual** scorer weights (`CLOSE_VOICING_SCORE_WEIGHTS`) — a separate, overlay-only domain; expose later if desired. Per-chord voicing overrides. Funk/Bossa knobs.

## §5 Open questions (resolve before approving)

1. **Scope of state — global, per-progression, or per-genre?** "Important to how a progression sounds" suggests it should travel *with* a saved progression (per-progression). But a user may also want a global default. Likely: global default + optional per-progression override. Decide before designing atoms/persistence.
2. **Sliders vs presets.** Are labelled presets ("Mellow / Bright / Smooth") the primary control, with raw knobs hidden? Presets are friendlier and avoid exposing 4 interacting weights; raw sliders are powerful but easy to make things sound bad. Recommendation: presets primary, raw knobs in an "advanced" disclosure.
3. **Which knobs are worth exposing at all?** `REGISTER_CENTER` and the lead/center trade are clearly audible. `span` and `bassFifth` are subtler — maybe fold them into presets only.
4. **Defaults must come from the tuning pass.** This spec can't pick the Tier-1 label→value mappings until the inversion-voicing work is implemented and tuned by ear. Sequence accordingly.
5. **Funk/Bossa interaction.** Disable the controls, annotate them as "default-strum genres only," or leave them inert? Avoid implying they affect funk/bossa when they don't.

## Risks

- **Knob overload.** Four interacting weights are easy to misuse; presets mitigate. Lead with presets.
- **Premature exposure.** Exposing raw weights before defaults are tuned bakes in a moving target — hence the hard dependency on the inversion-voicing work landing first.
- **Persisted config drift.** If weight semantics change later, stored `voicingConfig` values could mismatch; version the stored shape or store semantic labels (Low/Mid/High) rather than raw numbers.
