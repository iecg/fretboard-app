# Control-surface system + chord-editor restructure — design

**Date:** 2026-05-28
**Status:** Draft, awaiting user review

## Summary

Two related refactors that share an underlying goal of making the inspector and song editor easier to maintain, extend, and reason about:

1. **Control-surface system.** Extract two composable surface classes (`.surface--control` and `.surface--chrome`) so every control-like affordance — dropdowns, steppers, toggle bars, icon buttons, inspector toolbar buttons, modal close buttons — reaches for one source of truth. Retune the `--dc-*` token alphas so inactive states read against flat card surfaces. Unify the chrome icon-button size scale around a single `--sm` / `--md` / `--lg` set. Strip every bespoke local override.
2. **Chord editor restructure.** Replace the inline 12-cell DegreeGrid in `SongControls` with two grouped `LabeledSelect` dropdowns (root + quality), each with scale-aware groups. Apply a "root-driven default with opt-in quality lock" behavior model. Replace the bespoke pip-nav with a new ToggleBar `pip` variant. Tonal.js drives the diatonic/borrowed derivation, so the system works uniformly for every scale.

The two refactors are intentionally bundled because the chord-editor changes pull in many of the controls being unified (LabeledSelect, the new pip ToggleBar variant, the inspector toolbar buttons), and shipping the surface refactor first would force a second visual-snapshot refresh.

## Motivation

The control-surface system already has a coherent intent: two token families (`--dc-*` for inline form controls, `--surface-control-*` for chrome icon buttons), good naming, dark+light theme alignment. But every consumer pierces the contract:

- `.icon-button`'s default size (44px) is dead — every consumer overrides it. Modal close buttons override to 36px in their own modules ([HelpModal.module.css:56](../../../src/components/HelpModal/HelpModal.module.css), [SettingsOverlay.module.css:139](../../../src/components/SettingsOverlay/SettingsOverlay.module.css)). The AppHeader actions bypass `.icon-button` entirely with a `clamp(1.7rem, 2.5vw, 1.95rem)` selector ([AppHeader.module.css:181](../../../src/components/AppHeader/AppHeader.module.css)).
- The ToggleBar `chip` variant's inactive border is invisible because the `--dc-border` token (0.18 alpha cyan) was tuned assuming the surface sits over contrasting interior content. The chip variant moves the surface onto the button itself with no inner contrast, and the border vanishes against the inspector card.
- Inspector toolbar / grouped / delete buttons re-implement the `--dc-*` chain locally in [SongControls.module.css](../../../src/components/SongControls/SongControls.module.css).

The chord editor has its own problems:

- The DegreeGrid takes the full editor width for what is conceptually a single decision (the chord root), while the Key root above it uses a compact dropdown. Visual hierarchy is inverted from importance.
- The root-change handler in [SongControls.tsx:377](../../../src/components/SongControls/SongControls.tsx) inconsistently treats `qualityOverride`: in-key root changes preserve the override (sticky); borrowed root changes clear it. Users get different behavior depending on which group they pick from.
- The pip-nav in the editor header is a bespoke degree-step picker that duplicates ToggleBar's tablist semantics with custom styling.
- The Quality dropdown's groups are scale-agnostic, so the diatonic chord at the active root is buried in `Triads` or `Sevenths` instead of being one click away.

Both refactors share the same root cause: missing shared primitives. Fixing them together delivers a system whose patterns are reusable beyond this change.

## Out of scope (Phase 2)

Captured here so they aren't lost. A separate brainstorm follows Phase 1.

- **Extension chord groups** (`add9`, `9`, `m9`, `Maj9`, `11`, `m11`, `13`, `Maj13`, `m13`). Requires audio-engine support in [src/core/audio.ts](../../../src/core/audio.ts) and the Tone.js progression engine — non-trivial scope.
- **Altered chord groups** (`7♭9`, `7♯9`, `7♯11`, `7♭13`, `7alt`, `7♭5`, `7♯5`). Same engine-support consideration.
- **Mode-specific borrowed curation** beyond parallel-major-or-minor. Phase 1 derives borrowed chords from parallel minor (for major-flavored scales) or parallel major (for minor-flavored modes). Phase 2 can union with each mode's parallel modes for richer interchange.
- **Pentatonic in-pentatonic badge.** Phase 1 routes pentatonic/blues through a parent-scale map; Phase 2 can annotate which diatonic roots are also in the pentatonic note set.
- **Secondary-dominant curation.** Tonal exposes `Key.majorKey(tonic).secondaryDominants` ready to use. Phase 1 leaves them latent; Phase 2 can surface them as a curated group inside Borrowed.
- **Tritone substitution curation.** Same story — Tonal exposes `substituteDominants`; Phase 2 can surface them.
- **Combined chord picker.** Option C from brainstorming (single chord-name dropdown replacing both root and quality). Rejected for Phase 1 in favor of two-dropdown independence, but a candidate to revisit if the two-dropdown UX feels heavy in practice.

## Design — control surface system

### Two surface composables

In [src/components/shared/shared.module.css](../../../src/components/shared/shared.module.css):

```css
.surface--control {
  background-color: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  transition: var(--dc-transition);
}
.surface--control:hover {
  background-color: var(--dc-bg-hover);
  border-color: var(--dc-border-hover);
}
.surface--control:focus-within {
  border-color: var(--dc-border-active);
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.surface--chrome {
  background-color: var(--surface-control);
  background-image: var(--surface-control-bg-image);
  border: 1px solid var(--surface-control-border);
  box-shadow: var(--elevation-card);
  color: var(--surface-control-fg-muted);
  transition: var(--transition-surface), transform var(--transition-fast);
}
.surface--chrome:hover {
  background-color: var(--surface-control-hover-bg);
  background-image: var(--surface-control-hover-bg-image);
  color: var(--surface-control-hover-fg);
  border-color: var(--surface-control-hover-border);
  transform: translateY(-1px);
}
.surface--chrome:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

### Tone modifiers

Composed on top of either surface:

```css
.tone--destructive { /* swaps bg/border/fg to var(--destructive-control-*) */ }
.tone--accent      { /* accent-emphasis tone, e.g. for confirm CTAs */ }
```

`--destructive-control-*` tokens already exist (used by the reset CTA in SettingsOverlay). The destructive trash icon in SongControls becomes `.surface--control.tone--destructive` instead of carrying its own bespoke red.

### Token re-tune

In [src/styles/semantic.css](../../../src/styles/semantic.css), bump alphas so the dc-surface reads against flat card surfaces:

| Token | Before | After |
|---|---|---|
| `--dc-bg` (dark) | `rgb(77 228 255 / 0.03)` | `rgb(77 228 255 / 0.05)` |
| `--dc-border` (dark) | `rgb(77 228 255 / 0.18)` | `rgb(77 228 255 / 0.28)` |
| `--dc-bg` (light) | `rgb(20 112 136 / 0.04)` | `rgb(20 112 136 / 0.06)` |
| `--dc-border` (light) | `rgb(20 112 136 / 0.22)` | `rgb(20 112 136 / 0.32)` |

The hover/active alphas stay as they are — the issue is only with the resting state. Theme contract test updated to assert the new values.

### Icon-button size scale

In `shared.module.css`:

```css
.icon-button--sm { width: 2rem;    height: 2rem;    }   /* 32×32 — modal close, AppHeader actions */
.icon-button--md { width: 2.75rem; height: 2.75rem; }   /* 44×44 — existing default */
.icon-button--lg { width: 2.95rem; height: 2.95rem; }   /* 47×47 — existing */
```

- HelpModal close: `clsx(icon-button, icon-button--sm)`. Drop the local `2.25rem` override.
- SettingsOverlay close: same. Drop the local `2.25rem` override.
- AppHeader actions: composed via `.icon-button.icon-button--sm`, dropping the bespoke `clamp(1.7rem, 2.5vw, 1.95rem)` selector. Hover/focus/disabled now match the modal buttons exactly.

The AppHeader's slim-row aesthetic survives at 32px — the surrounding spacing already keeps it visually compact, and matching the modal close gives the chrome a single consistent affordance vocabulary.

### Consumer migration

| File | Change |
|---|---|
| [StepperShell.module.css](../../../src/components/StepperShell/StepperShell.module.css) | `.shell` composes `.surface--control`. Local bg/border/transition properties removed. |
| [LabeledSelect.module.css](../../../src/components/LabeledSelect/LabeledSelect.module.css) | `.trigger` composes `.surface--control`. |
| [shared.module.css](../../../src/components/shared/shared.module.css) | `.toggle-group--default` and `.toggle-btn--chip` compose `.surface--control`. |
| [SongControls.module.css](../../../src/components/SongControls/SongControls.module.css) | `.toolbar-button`, `.grouped-button` compose `.surface--control`. `.delete-button` composes `.surface--control.tone--destructive`. |
| [AppHeader.module.css](../../../src/components/AppHeader/AppHeader.module.css) | `.app-header-actions button` selector replaced with `.icon-button.icon-button--sm` composition at the TSX layer. CSS rule deleted. |
| [HelpModal.module.css](../../../src/components/HelpModal/HelpModal.module.css), [SettingsOverlay.module.css](../../../src/components/SettingsOverlay/SettingsOverlay.module.css) | Local `2.25rem` close-button overrides removed. |

## Design — ToggleBar variants

### Variant matrix after Phase 1

| Variant | Shape | Use |
|---|---|---|
| `default` | rectangular, sans, segmented inside a single shell | Standard form toggle (e.g. Beat/Bar) |
| `tabs` | rectangular, sans, tablist (full width) | Mobile tab bar |
| `chip` | rectangular, sans, standalone buttons | CAGED-style chip rows (e.g. ChordStringSetToggleBar) |
| `pip` | **square, mono, dense, accent-glow active** | **Step-by-step degree pickers (replaces bespoke pip-nav)** |

### `pip` variant spec

```css
.toggle-group--pip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: 0;
  padding: 0;
}
.toggle-btn--pip {
  composes: surface--control from "shared.module.css";
  min-width: 2.2rem;
  height: 1.8rem;
  padding: 0 0.4rem;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
.toggle-btn--pip.active {
  background-color: color-mix(in srgb, var(--faceplate-accent) 10%, transparent);
  border-color: var(--faceplate-accent);
  color: var(--faceplate-accent);
  font-weight: 700;
  box-shadow: 0 0 8px color-mix(in srgb, var(--faceplate-accent) 18%, transparent);
}
```

Accessibility: ToggleBar already routes role=tab/tablist + aria-selected through the `tabs` variant. The same code path serves `pip`, since the pip-nav is semantically a tablist.

### Consumer migration

[SongControls.tsx:352](../../../src/components/SongControls/SongControls.tsx) — the bespoke `.pip-row` / `.pip` / `.active-pip` markup becomes:

```tsx
<ToggleBar
  variant="pip"
  label="Progression navigation"
  options={resolvedProgressionSteps.map((step, idx) => ({
    value: idx,
    label: step.degree,
  }))}
  value={activeProgressionStepIndex}
  onChange={setActiveProgressionStepIndex}
/>
```

The `.pip-row`, `.pip`, `.active-pip`, `.chords-label`, and `.pip-nav-container` CSS classes in SongControls.module.css are deleted.

## Design — chord editor restructure

### Root dropdown

Replaces DegreeGrid. Grouped `LabeledSelect` driven by Tonal.

**Groups (scale-aware):**

1. **Diatonic** — chord roots from the active scale (size depends on scale family).
2. **Borrowed** — non-diatonic chord roots from the parallel mode, annotated with the harmonic move each suggests.
3. **Chromatic** — remaining non-diatonic notes, plain labels.

**Label format** (decided in brainstorm): `numeral · note · diatonic-quality-hint`. Examples:

- Diatonic group, Cmaj, IV degree: `IV · F · maj`
- Borrowed group, Cmaj, ♭VII: `♭VII · B♭ · maj — Modal cadence`
- Chromatic group, Cmaj, ♯iv: `♯iv · F♯`

### Quality dropdown

**Groups (Phase 1):**

1. **Diatonic** — 1–2 dynamic options computed from the active root + active scale.
   - Triad: e.g. `Major (IV)` for F-root in C-major.
   - Seventh: e.g. `Maj7 (IV)` for F-root in C-major.
   - **When the active root is in the Borrowed or Chromatic group** — there's no diatonic chord at that root. The group then shows the *parallel-mode default* — i.e. whatever `guessQualityForBorrowedRoot` returns today — labelled the same way (e.g. `Major (♭VII)` for B♭-root in C-major). Group label stays "Diatonic" since it remains the "snap to key default" affordance; the entry reflects what the borrowed chord conventionally takes. If `guessQualityForBorrowedRoot` returns null for a given chromatic root, the Diatonic group is omitted entirely.
2. **Triads** — existing (Maj, min, dim, aug).
3. **Sus** — existing (sus2, sus4, 5).
4. **Sixths** — existing (6, m6).
5. **Sevenths** — existing (Maj7, m7, 7, dim7, m7♭5, mMaj7).

Selecting the Diatonic option clears `qualityOverride` (snaps quality back to the key default).

### Behavior model

**Root-driven default + opt-in quality lock:**

- **Root change** (any group) always clears `qualityOverride`. The previous bug where in-key root changes preserved the override while borrowed root changes cleared it is fixed.
- **Quality lock toggle** sits next to the Quality field label. Small pin/lock icon button. When locked, root changes preserve the `qualityOverride`. **Session-only** — not persisted. Resets to off on page reload.
- Selecting the Diatonic option from Quality clears `qualityOverride` regardless of lock state. This is the explicit "snap to key default" affordance.

### Tonal-driven derivation

#### Diatonic-chord lookup

A new module `packages/core/src/keyHarmony.ts`:

```ts
import * as Key from "@tonaljs/key";
import * as Mode from "@tonaljs/mode";

const HARMONIC_PARENT: Record<string, "major" | "minor"> = {
  "major pentatonic": "major",
  "minor pentatonic": "minor",
  "major blues":      "major",
  "minor blues":      "minor",
};

interface ScaleHarmony {
  diatonicTriads: readonly string[];   // 7 entries for 7-note scales
  diatonicSevenths: readonly string[];
  parallelMinorTriads?: readonly string[];   // present for major-flavored
  parallelMajorTriads?: readonly string[];   // present for minor-flavored
  parallelHarmonicMinorTriads?: readonly string[];
}

export function getScaleHarmony(scaleName: string, tonicNote: string): ScaleHarmony;
```

**Resolution order:**

- If `scaleName` is in `HARMONIC_PARENT`, recurse with the parent scale + tonic.
- If `scaleName === "major"` or `"ionian"`: `Key.majorKey(tonicNote)` — triads, chords, plus `Key.minorKey(tonicNote).natural.triads` for parallel-minor pool.
- If `scaleName === "minor"` or `"aeolian"`: `Key.minorKey(tonicNote).natural` — plus `Key.majorKey(tonicNote).triads` for parallel-major pool.
- If `scaleName === "harmonic minor"`: `Key.minorKey(tonicNote).harmonic` — plus parallel-major pool.
- If `scaleName === "melodic minor"`: `Key.minorKey(tonicNote).melodic` — plus parallel-major pool.
- Otherwise (church modes): `Mode.triads(scaleName, tonicNote)` + `Mode.seventhChords(scaleName, tonicNote)`. Parallel pool selected by mode's `Mode.get(scaleName).triad` — `"M"` → parallel minor; `"m"` → parallel major; `"d"` → both.

#### Borrowed derivation

```ts
function deriveBorrowedTriads(diatonic: readonly string[], parallel: readonly string[]): string[] {
  const diatonicSet = new Set(diatonic);
  return parallel.filter(chord => !diatonicSet.has(chord));
}
```

Validated against `Key.majorKey("C").triads` vs `Key.minorKey("C").natural.triads`: yields `[Cm, Ddim, Eb, Fm, Gm, Ab, Bb]`, which the editor renders as the Borrowed group (filtered further to the 4–6 most common moves — see annotations).

#### Harmonic-move annotations

A small lookup in the same module:

```ts
const HARMONIC_MOVES: Record<string, string> = {
  "bVII": "Modal cadence",
  "iv":   "Tragic plagal",
  "bVI":  "Aeolian cadence",
  "bIII": "Mediant lift",
  "bII":  "Neapolitan",
  "v":    "Modal v",
  "ii°":  "Borrowed supertonic",
  // ...
};

export function annotateBorrowedRoot(numeral: string): string | null;
```

Used to decorate Borrowed-group labels (`♭VII · B♭ · maj — Modal cadence`). Scale-agnostic; covers the most idiomatic moves. Missing entries render the label without an annotation.

### Data-flow changes

[src/progressions/progressionDomain.ts](../../../src/progressions/progressionDomain.ts):

- `updateProgressionStepRoot` and `updateProgressionStepDegree` handlers normalize to a single behavior: setting either always clears `qualityOverride` *unless* the new `qualityLock` atom is true.

[src/store/progressionAtoms.ts](../../../src/store/progressionAtoms.ts):

- New `qualityLockAtom` — session-only Jotai atom (no `atomWithStorage`).
- `updateProgressionStepRootAtom` reads `qualityLockAtom` and conditionally preserves the override.

[src/components/SongControls/SongControls.tsx](../../../src/components/SongControls/SongControls.tsx):

- DegreeGrid replaced with grouped LabeledSelect (root).
- Quality dropdown gains the dynamic Diatonic group as the first `LabeledSelectGroup`.
- Quality field label gains a sibling `.icon-button.icon-button--sm` pin/lock toggle. Lock icon swaps between `Pin` / `PinOff` lucide icons.
- Pip-nav replaced with ToggleBar `pip` variant.
- Toolbar/grouped/delete buttons updated to use `.surface--control` (+ `.tone--destructive` for delete).

### Component removal

[src/components/shared/DegreeGrid.tsx](../../../src/components/shared/DegreeGrid.tsx) and [src/components/shared/DegreeGrid.module.css](../../../src/components/shared/DegreeGrid.module.css), plus the co-located test file, are deleted. Confirmed no other consumers via grep.

### Terminology (user-facing strings)

- Root groups: `Diatonic`, `Borrowed`, `Chromatic`.
- Quality groups: `Diatonic`, `Triads`, `Sus`, `Sixths`, `Sevenths`.
- Quality lock toggle label: `Lock quality` (tooltip: "Keep this quality when changing the chord root").

Internal code may use `inScale` / `borrowed` / `chromatic` identifiers; user-facing strings live in [src/i18n/en.ts](../../../src/i18n/en.ts) and [src/i18n/es.ts](../../../src/i18n/es.ts) keyed under existing `controls.*` / `inspector.*` namespaces.

## File-level impact

### Created

- `packages/core/src/keyHarmony.ts` — Tonal-driven diatonic/borrowed/parent-scale derivation + harmonic-move annotations.
- `packages/core/src/keyHarmony.test.ts` — unit tests across major / minor / modes / pentatonic / blues / harmonic-minor / melodic-minor.

### Modified

- `src/components/shared/shared.module.css` — surface composables, tone modifiers, icon-button size scale.
- `src/styles/semantic.css` — token alpha bump in both dark + light blocks.
- `src/styles/themes.css` — verify no override clashes with the new alphas.
- Theme contract test — assert new alpha values.
- `src/components/ToggleBar/ToggleBar.tsx` and `ToggleBar.module.css` — add `pip` variant via `cva`.
- `src/components/StepperShell/StepperShell.module.css` — compose `.surface--control`.
- `src/components/LabeledSelect/LabeledSelect.module.css` — `.trigger` composes `.surface--control`.
- `src/components/AppHeader/AppHeader.module.css` and `AppHeader.tsx` — switch buttons to `.icon-button.icon-button--sm`.
- `src/components/HelpModal/HelpModal.module.css` and `HelpModal.tsx` — `icon-button--sm`; drop overrides.
- `src/components/SettingsOverlay/SettingsOverlay.module.css` and `SettingsOverlay.tsx` — same.
- `src/components/SongControls/SongControls.tsx` — Root LabeledSelect, Quality with Diatonic group, lock toggle, pip variant, button refactor.
- `src/components/SongControls/SongControls.module.css` — delete `.pip-*` and `.chord-identity` (unless retained elsewhere), refactor buttons.
- `src/components/SongControls/qualityGroups.ts` — add Diatonic-group builder taking `(scaleName, tonicNote, rootNote)`.
- `src/progressions/progressionDomain.ts` — root-change unifies qualityOverride clearing behavior.
- `src/store/progressionAtoms.ts` — add `qualityLockAtom` (session-only).
- `src/i18n/en.ts`, `src/i18n/es.ts` — strings for the new "Diatonic" group, lock toggle label.

### Deleted

- `src/components/shared/DegreeGrid.tsx`, `DegreeGrid.module.css`, `DegreeGrid.test.tsx`.

### Visual regression snapshots refreshed

- `e2e/app-components` — toggle bar variants, dropdown, stepper, modal close buttons.
- `e2e/app-layout` — inspector layout shifts from DegreeGrid removal.
- `e2e/app-overlays` — modal close-button size change.
- `e2e/app-mobile` — same.
- darwin + linux baselines per CLAUDE.md workflow.

## Testing

### Unit tests

- `keyHarmony.test.ts` — for major (C, G, F), minor (A, E), modes (Dorian on D, Mixolydian on G, Phrygian on E, Locrian on B), harmonic minor (A), melodic minor (C), major pentatonic (C), minor pentatonic (A), major blues, minor blues:
  - Diatonic triads + sevenths match expected.
  - Borrowed set-diff returns expected pool.
  - Parent-scale resolution for pentatonic/blues (pentatonic on C major → major-key chord pool).
  - Mode-flavored parallel-pool selection (Dorian on D → parallel major; Lydian on F → parallel minor; Locrian on B → both).
  - Harmonic-move annotations return null for unknown numerals.

### Component tests

- ToggleBar `pip` variant — accessibility (role=tab, aria-selected), active visual state via `data-active`, keyboard activation.
- New chord-root LabeledSelect — groups render in order Diatonic / Borrowed / Chromatic; borrowed entries carry annotation suffixes; selecting any option clears `qualityOverride` (unless lock is on).
- Quality dropdown — Diatonic group present with triad + seventh entries when root is in-key; reflects `guessQualityForBorrowedRoot` when root is borrowed; group omitted when no diatonic/guess is available. Picking the Diatonic option clears `qualityOverride` regardless of lock state.
- Quality lock toggle — clicking flips icon between Pin / PinOff; root change with lock-off clears override; with lock-on preserves override.
- Modal close buttons — render at 32×32; tab order unchanged.
- AppHeader actions — render at 32×32; hover/focus visuals match modal close.

### Theme contract

- Assert new `--dc-bg` and `--dc-border` alpha values for both `modern-light` and `modern-dark`.
- Assert `.icon-button--sm` resolved size is `2rem` × `2rem`.
- Assert `.surface--control` resolves to the expected token chain.

### Visual regression

- Refresh darwin baselines: `pnpm run test:visual:update`.
- Refresh linux baselines: `pnpm run test:visual:update:linux`.
- Diff review: every snapshot is expected to change at least somewhere (token bump touches almost every surface). The reviewer's job is to confirm changes are limited to the intended surfaces.

## Migration / behavior changes for users

- **The DegreeGrid disappears.** Chord root is now a dropdown matching the Key root style.
- **Changing chord root resets the quality** by default. Users who relied on the (inconsistent) sticky-in-key behavior will see different results — but the new behavior is what they probably expected. A new lock toggle restores sticky behavior for the rest of the session.
- **Quality dropdown gains a "Diatonic" group at the top.** Picking from it restores the key default for the active root.
- **Modal close buttons shrink** from 36×36 to 32×32.
- **AppHeader action buttons align** to the same 32×32 scale, gaining the chrome icon button's hover/focus visuals (uplift, shadow).
- **Pip-nav looks identical** to the user — the structural change is internal.

## Open questions for review

None at this point — every clarifying question raised during brainstorming has a resolution above. Specific points worth re-confirming during review:

1. **AppHeader button at 32×32** — the original `clamp(1.7rem, 2.5vw, 1.95rem)` shrinks below 32px at the smallest viewport. Locking to 32px makes the header marginally taller on the tightest desktop widths. Verify acceptable in design review.
2. **Quality lock as session-only** — confirmed in brainstorming. If a future user complaint surfaces ("I always want my qualities to stick"), the atom can be promoted to `atomWithStorage` without API change.
3. **Borrowed group cap.** Phase 1 derives the full parallel-mode borrowed set (typically 5–7 entries). If that feels heavy in the UI, a follow-up can trim to the top 3–4 most common with the rest moved to Chromatic.

## Phase 2 follow-up

A separate brainstorm will cover:

- Extensions / Altered quality groups + audio-engine support.
- Mode-specific borrowed curation beyond parallel-major/minor.
- Pentatonic in-pentatonic badge in the Diatonic group.
- Secondary-dominant and tritone-sub surfacing.

Recommended sequence: ship Phase 1, gather feedback, then enter Phase 2 with concrete usage data on which Phase 1 patterns held up.
