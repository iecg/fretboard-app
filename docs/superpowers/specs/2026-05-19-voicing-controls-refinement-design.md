# Voicing Controls Refinement — Design

**Status:** Brainstorm spec. Produced 2026-05-19 as a follow-up to the Voicing Engine
Redesign (PR #417), after live use surfaced four defects in the shipped Chord-tab
voicing controls.

**Date:** 2026-05-19

**Scope:** Four targeted fixes to the Chord-tab voicing controls — the voicing engine's
Triad/Drop 2 distinction, the String Set picker's diagram, and a unified
disable + auto-heal coupling across the Type / Inversion / String Set controls. No new
voicing types, no app-shell changes.

**Builds on:** `docs/superpowers/specs/2026-05-18-voicing-engine-redesign-design.md`
and PR #417 (the engine that takes a `readonly number[]` string set, the dynamic
`buildStringSetOptions`, the id-based `voicingStringSetAtom`, and the caged-gating in
`ChordOverlayControls`).

---

## 1. Background — the four defects

1. **Drop 2 and Triad are identical for triad chords.** `generateVoicings` delegates
   `triad`/`drop2` to `searchVoicings`. The `drop2` branch only takes the
   spread-search path when the chord has ≥ 4 tones; a 3-note chord falls through to the
   exact same closed search as `triad`. So for every triad the two types produce byte-
   identical output.
2. **The String Set diagram is inverted.** Task 4 of PR #417 introduced
   `diagramMask(strings)`, which returns a six-element array indexed high-E-first
   (`mask[0]` = string index 0 = high E). The render code still does `[...mask].reverse()`
   — a transform written for the *old* low-E-first mask. The net result is the diagram
   is flipped on both axes: the highlighted strings render at the wrong end and the
   string thicknesses run backwards.
3. **The diagram's thickness barely scales.** The string bars use `height: 1 + i*0.4` px
   (1 → 3 px). At diagram size the difference between strings is nearly invisible, so the
   diagram does not read as "guitar strings."
4. **The controls are hard to use.** Many Type / Inversion / String Set combinations
   produce zero voicings. Nothing tells the user which combinations work, and nothing
   moves the other controls into a working state — so finding a usable voicing is
   trial-and-error.

---

## 2. Goals and Non-Goals

### Goals

- Triad and Drop 2 always produce visibly different voicings, for chords of any tone
  count.
- The String Set diagram matches the fretboard: high E (thinnest) at the top, low E
  (thickest) at the bottom; the highlighted strings land on the correct end.
- The diagram's thickness scaling is clearly legible.
- Every Type / Inversion / String Set control communicates which of its options are
  possible, and any selection leaves the controls in a state that produces a voicing.

### Non-Goals

- No new voicing types — the set stays `caged` / `drop2` / `triad`.
- No change to the voice-count rule (`triad` voices up to 3 tones; `drop2` voices all of
  the chord's tones — same as today).
- No change to the CAGED path, the search algorithm's candidate enumeration, or the
  chord/scale domain split.
- No app-shell or other-tab changes.

---

## 3. Triad vs Drop 2 — compact vs spread

`searchVoicings(params, voiceCount, requireOctaveSpread)` already distinguishes closed
from spread voicings:

- `requireOctaveSpread === false` keeps voicings whose total pitch span is ≤ 12
  semitones (closed position).
- `requireOctaveSpread === true` keeps voicings whose pitch span is `> 12 && <= 24`
  semitones (one voice displaced by roughly an octave — the drop-2 effect).

The defect is only in *which* path each type takes. The fix makes the path follow the
**type**, never the tone count:

- **`triad`** → `searchVoicings(params, voiceCount, false)` — always the closed search.
  `voiceCount` is `Math.min(3, def.members.length)` (unchanged).
- **`drop2`** → `searchVoicings(params, voiceCount, true)` — always the spread search,
  for any tone count. `voiceCount` is `def.members.length` for a 4-note (or larger)
  chord, and `Math.min(3, def.members.length)` for a smaller chord (unchanged — the
  only change is that the `true` flag is now always passed).
- **`caged`** → unchanged.

Result: for a triad, `drop2` searches spread (string-skip / open) triad voicings —
distinct from `triad`'s tight grip. For a 7th chord, `drop2` is the existing
octave-spread search. When the spread search yields nothing for a given chord +
inversion + string set, the engine returns `[]` (handled by §5's coupling, and by the
no-scatter behavior already shipped in PR #417).

`generateVoicings` is the only function that changes. `searchVoicings` itself is
untouched.

---

## 4. String Set diagram

The diagram lives in `src/components/Inspector/StringSetPicker.tsx`. Each card shows six
horizontal bars representing the six strings, with the active string set's strings
highlighted.

### 4a. Orientation

The diagram must read top-to-bottom as **high E → low E**, matching the fretboard:

- Top bar = string index 0 = high E = thinnest.
- Bottom bar = string index 5 = low E = thickest.

So the highlighted strings for `"Bass"` (`4·5·6`, string indices `[3,4,5]`) are the
**bottom three** bars; for `"Treble"` (`1·2·3`, indices `[0,1,2]`) the **top three**.

Implementation: render the six bars directly in string-index order `0 → 5` (high E
first). Remove the `[...mask].reverse()` call — the reverse was the bug. The bar at
render position `i` represents string index `i`.

### 4b. Thickness scale — boosted taper

Each bar's thickness is a fixed function of its string index. The values are the
fretboard's `--string-taper-*` proportional curve, scaled up so the difference is
legible in a small diagram:

| String index | String | Thickness |
|---|---|---|
| 0 | high E | 1.5 px |
| 1 | B | 2.1 px |
| 2 | G | 2.7 px |
| 3 | D | 3.6 px |
| 4 | A | 4.5 px |
| 5 | low E | 5.4 px |

These are a module-level constant array (`STRING_BAR_THICKNESS_PX`, index 0 → 5). The
old `1 + i*0.4` inline expression is removed.

### 4c. Highlight

A bar is highlighted (active accent color) when its string index is in the option's
`strings` array; otherwise it renders in the muted/inactive color. Highlight color and
muted color use the existing CSS-module classes (`styles.stringOn` and the base
`styles.string`) — no new color tokens. Only the per-bar `height` and the index→bar
mapping change.

### 4d. No other picker changes

`buildStringSetOptions`, the option ids, the `value`/`onChange` contract, the
`subText`/`aria-label`, and the radio-group a11y are all unchanged from PR #417.

---

## 5. Disable + auto-heal coupling

### 5a. Validity

A `(type, inversion, stringSet)` triple is **valid** for the active chord when
`generateVoicings` returns at least one voicing for it. `caged` is a self-contained type
— it ignores inversion and string set — so for the purpose of this section the
coupling only ranges over `type ∈ {triad, drop2}` and the inversion / string-set
controls. `caged` is treated as always valid (it has its own engine path, which yields
shapes for any real chord) and always enabled.

A new derived atom — working name `validVoicingCombosAtom` — computes, for the active
chord, the set of valid `(type, inversion, stringSet)` triples. It enumerates the
controls' option spaces (`type ∈ {triad, drop2}`, the inversions from
`availableInversionsAtom`, the string-set ids from `stringSetOptionsAtom`) and calls the
engine for each. The result is a structure that answers two questions cheaply:

- Is option `v` of control `X` present in any valid triple? (drives §5b)
- Given pinned control(s), what is the nearest valid assignment of the rest? (drives §5c)

The atom is memoized per chord (it only recomputes when the chord root/type, tuning, or
the available-inversion / string-set option lists change).

### 5b. Disable rule

Each of the three controls greys out (disables, not hides) an option **only when that
option appears in zero valid triples for the active chord** — i.e. it is genuinely
impossible. Concretely:

- **Type:** `caged` is always enabled. `triad` / `drop2` is disabled only if no
  inversion + string-set pairing makes it valid (rare — effectively never for a real
  chord, but the rule is uniform).
- **Inversion:** an inversion is enabled if some `(type, _, stringSet)` valid triple
  uses it. (This composes with the existing `availableInversionsAtom`, which already
  drops inversions the chord has no tone for — those stay disabled as before.)
- **String Set:** a string-set id is enabled if some `(type, inversion, _)` valid triple
  uses it.

Enabled-but-locally-incompatible options stay clickable. Picking one is allowed and
triggers an auto-heal (§5c). Only truly impossible options are unclickable.

### 5c. Auto-heal

Whenever the active `(type, inversion, stringSet)` is **not** a valid triple, the
controls heal:

1. **A control was just changed by the user** → that control is *pinned*. The other two
   snap to the nearest valid assignment. "Nearest" keeps a sibling's current value when
   a valid triple allows it; when both siblings must move, it keeps the sibling that
   was touched more recently and moves the other. When neither current sibling value
   can be kept, it picks the valid triple closest in option-list index distance.
2. **The chord changed** (no control was "just changed") → `type` is pinned (it is the
   most significant choice and the one least tied to a specific chord), and inversion +
   string set heal by the same nearest-assignment rule.
3. **The type toggled between `caged` and a non-caged type** → on `caged → triad/drop2`,
   the persisted inversion + string-set values are restored (per PR #417's behavior)
   and then healed if the restored pair is invalid. On `triad/drop2 → caged`, nothing
   to heal (caged ignores both).

Healing writes the corrected values to `voicingInversionAtom` / `voicingStringSetAtom`
(and never to a control the user just pinned). Because healing always lands on a valid
triple, the engine never silently returns `[]` for a coupling reason — only `caged`
edge cases or a genuinely voicing-less chord can do that, and those degrade gracefully
via the no-scatter behavior from PR #417.

### 5d. Control recency

Auto-heal's "more-recently-touched" tie-break needs a per-session record of the order
in which the three controls were last changed. This is lightweight UI state — a small
atom holding the three control ids in most-recent-first order, updated by each
control's `onChange`. It is **not** persisted (it resets each session; a fresh session
has no recency and falls back to a fixed precedence: pinned control, then string set,
then inversion).

### 5e. Replaces the existing normalizer

PR #417 added a single-purpose `useEffect` in `ChordOverlayControls` that resets a
stale `voicingStringSetAtom` to `"all"`. The unified heal (§5c) supersedes it — the heal
covers string-set staleness as one case of "the active triple is invalid." The old
normalizer effect is removed so there is exactly one healing mechanism.

---

## 6. File-level impact

- `packages/core/src/shapes/voicings.ts` — `generateVoicings`: the `drop2` branch
  always passes `requireOctaveSpread: true`; the `triad` branch always passes `false`.
  `searchVoicings` is untouched.
- `src/components/Inspector/StringSetPicker.tsx` — render bars in string-index order
  `0 → 5` (drop the `.reverse()`); replace the `1 + i*0.4` height with the
  `STRING_BAR_THICKNESS_PX` constant; highlight by string-index membership.
- `src/components/Inspector/StringSetPicker.module.css` — only if the bar layout needs
  adjusting for the new thickness range (e.g. the diagram container height / gap). No
  new color tokens.
- `src/store/chordOverlayAtoms.ts` (or a new `src/store/voicingCoupling.ts` section) —
  `validVoicingCombosAtom`; per-control enabled-option selectors; the control-recency
  atom; the nearest-valid-assignment helper.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — apply the disabled
  state to the Type / Inversion / String Set controls; replace the old string-set
  normalizer `useEffect` with the unified heal effect; record control recency on each
  `onChange`.
- `src/store/atoms.ts` — re-export any new atoms as needed.

---

## 7. Cross-Cutting Notes

- No new user-facing strings — the controls' labels are unchanged. Disabled options use
  the existing disabled styling (`ToggleBar` already supports a `disabled` option flag;
  the string-set picker cards gain a disabled state mirroring it).
- The `validVoicingCombosAtom` enumeration is up to ~60 engine searches per chord change
  (3 types × ≤ 4 inversions × ≤ 5 string sets; in practice fewer). Each search is
  bounded and fast, and the atom is memoized per chord. Acceptable; flagged for a
  follow-up only if profiling shows it.
- Mandatory before the PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`,
  `npx tsc -b`.
- Visual-regression baselines refresh for `chord-overlay-controls` (the String Set
  diagram and any disabled-state styling), darwin + linux.

---

## 8. Testing (TDD — failing test first per task)

- `voicings.test.ts` (core) — for a triad chord, `generateVoicings` with `drop2`
  returns voicings whose pitch span exceeds an octave, and is **not** equal to the
  `triad` result; for a triad, `triad` voicings stay within an octave; a 7th-chord
  `drop2` is unchanged from current behavior.
- `StringSetPicker.test.tsx` — the diagram renders six bars in high-E-to-low-E order;
  the `"Bass"` card highlights the bottom three bars and `"Treble"` the top three; each
  bar's height matches `STRING_BAR_THICKNESS_PX`.
- `voicingCoupling` tests (new) — `validVoicingCombosAtom` reports the correct valid
  triples for a sample chord; the per-control enabled-option selectors disable only
  options absent from every valid triple; the nearest-valid-assignment helper keeps a
  pinned control and prefers keeping the more-recently-touched sibling.
- `ChordOverlayControls.test.tsx` — impossible options render disabled; picking an
  enabled-but-incompatible option heals the other two to a valid triple; changing the
  chord heals inversion + string set with type pinned; toggling `caged → triad`
  restores and then heals the persisted inversion/string-set values.
- Visual regression — refresh the `chord-overlay-controls` suite (darwin + linux).

---

## 9. Acceptance Criteria

- For a triad chord, switching between Triad and Drop 2 visibly changes the fretboard;
  the two never produce identical voicings.
- The String Set diagram shows high E (thin) at the top and low E (thick) at the bottom;
  "Bass" highlights the low strings, "Treble" the high strings; the thickness scaling is
  clearly visible.
- Each voicing control greys out only the options that are genuinely impossible for the
  active chord; every other option stays clickable.
- Selecting any Type / Inversion / String Set option always leaves the controls in a
  state that produces at least one voicing (except genuine caged-only edge cases).
- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass.
