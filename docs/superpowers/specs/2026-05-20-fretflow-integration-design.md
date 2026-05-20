# FretFlow Integration — Design

**Status:** Brainstorm spec. Produced 2026-05-20 from a deep cross-tab audit of the chord / progression / scale / view domains. Consolidates and supersedes the chord-overlay mode model.

**Date:** 2026-05-20

**Scope:** Integrate the four Inspector tabs (View / Scale / Chord / Progression) into a coherent DAW-first user experience. Eliminate cross-tab couplings that silently override each other. Reduce control density to a level a new user can navigate. Adopt Tonal.js for music theory and Tone.js for audio.

**Non-goals:** No visual restyle (deferred). No new voicing engines. No new fingering patterns. No notation rendering, MIDI export, or AI generation features.

---

## 1. Background — why integration is needed

FretFlow Studio grew feature-by-feature: View, Scale, Chord, then Progression. The four domains were each designed locally; their boundaries leak. Live use surfaces several structural problems the existing controls-overhaul spec did not address:

### 1a. The progression silently owns the chord overlay

`progressionIsActiveChordSource(get)` returns true whenever a resolvable active step exists (`chordOverlayAtoms.ts:201`). Since the default progression has resolvable steps and `activeProgressionStepIndexAtom` always points at one, the progression is *always* the chord source — even when playback is stopped. `effectiveChordOverlayModeAtom` (line 214) consequently always returns `"degree"`, regardless of the user's setting on the Chord-tab Mode toggle.

Consequence: the Source > Mode toggle (`Off / Degree / Manual`) at `ChordOverlayControls.tsx:191` is dead UI. Clicking "Off" or "Manual" appears to do nothing.

### 1b. No way to turn off the chord overlay

The chord overlay can be hidden via `chordOverlayHiddenAtom` from `ChordPracticeBar`, but this state lives in the top-band legend and the Inspector is oblivious to it. The Chord tab's Mode toggle includes an "Off" value that does not actually hide the overlay.

### 1c. Standalone chord vs progression step

Today the chord exists in two places: as a standalone chord (Chord tab in `manual` mode, via `chordRootOverrideAtom` + `chordQualityOverrideAtom`) and as a step in a progression. Two ways to set the chord, with `effective*` atoms patching over the conflict at read time. The Chord-tab `manual` mode is unreachable in practice (§1a).

### 1d. Cross-tab coupling without visible cross-references

- `scope-to-position` (Chord tab) consumes the fingering position from Scale tab. The dependency is invisible.
- Writing to `chordRootAtom` / `chordTypeAtom` silently flips `chordOverlayModeAtom` to `"manual"` (`chordOverlayAtoms.ts:270`, `:331`). Side-effect not signaled.
- Setting `chordDegreeAtom` clears `chordQualityOverrideAtom`. Side-effect not signaled.
- `effectiveColorNotesAtom` combines scale + chord color preferences across tabs.

### 1e. Control overload

The Chord tab today exposes (in `ChordOverlayControls.tsx`): mode toggle, degree select, root select, chord-type grid, lens toggle, voicing type, voicing inversion, string set, connectors switch, chord spread stepper, scope-to-position switch. The Progression tab adds meter, preset, step list, per-step degree, per-step duration, per-step quality, tempo, plus the backing-track style/lead/comp/bass/drums/swing controls. The user reports this is overwhelming even for the app's author.

### 1f. Duplicated controls and stale features

- The top-band summary (`TopBandSummary.tsx`) was added before connectors made chord tones visually obvious. Its information is now duplicated by what's already drawn on the fretboard plus the StatusBar.
- The Scale-tab "Theory facts" panel restates information visible in the Circle of Fifths wheel.
- The "Scale relationship" toggle adds a complexity dimension users rarely engage.
- String-set selection uses one UX in the Chord tab (graphical 6-string picker) and a different UX in the Scale tab string-study modes.

### 1g. Half-baked lens system

Three lenses (`targets`, `guide-tones`, `tension`) exist but their visual differentiation is too subtle to actually help improvise over a progression. They do not consider the upcoming chord — no anticipation, no common-tone preview, no voice-leading cues.

### 1h. Visual: disabled ToggleBar options

`.toggle-btn` in `shared.module.css` lacks any `:disabled` rule. Unavailable voicing options (drop2/triad/inversions/string sets) are rendered with the HTML `disabled` attribute but look identical to enabled options. The user cannot tell which options are unavailable.

---

## 2. Core insight

**The progression is the universal container for "the current chord."**

There is no standalone chord. The Chord tab is the detail view of the active progression step. A "single-chord exploration" is a 1-step progression. A "free-form chord" is a manually-input step.

This collapses the §1a–§1c tension. One source of truth: the active step of the progression. One editor: the Chord tab, which writes back to the active step.

The fretboard is conceptually three independently-visible layers:

```
┌──────────────────────────────────────┐
│  Tuning    (instrument — always on)  │
│  Scale     (key + pattern — toggle)  │
│  Chord     (active step — toggle)    │
└──────────────────────────────────────┘
```

Visibility is orthogonal to source. The chord overlay can be hidden (scale-only view) regardless of whether the progression is playing.

---

## 3. Architecture

### 3a. Inspector reduced to 3 tabs

The Inspector goes from four tabs to three:

| Tab | Job |
|---|---|
| **Scale** | Key, scale type, fingering pattern + sub-controls. |
| **Chord** | The active progression step's chord quality, voicing, lens, region. Writes back to the step. |
| **Song** | The progression — arrangement, steps, tempo, meter, backing track. Renamed from Progression to reflect its expanded scope. |

The **View tab is removed.** Its current contents migrate as follows:

| Was in View | New home |
|---|---|
| Note labels (degree / note / none) | Settings overlay → Display |
| Accidental display (sharps / flats) | Settings overlay → Display |
| Fret range | Settings overlay → Display |
| Theme | Settings overlay → Display (already there) |
| Degree colors on/off | Settings overlay → Display |
| Fingering pattern controls | Already moved to Scale tab (per the controls-overhaul spec) |

Settings overlay grows by 4–5 fields; the Inspector shrinks by one tab.

### 3b. Top-band legend (TopBandSummary) removed

The fretboard renders without the inline legend strip. `FretboardLensOverlay.tsx` and `TopBandSummary.tsx` are deleted (together with `DegreeChipStrip.tsx` and `ChordPracticeBar.tsx`, unless they have other consumers — audit before removal). The scale/chord/lens labels that the legend duplicated remain available in the StatusBar.

Per-note "hide this scale chip" toggling — the only feature unique to the legend — is dropped. Hiding individual scale notes is a low-frequency power-user feature; its disappearance is acceptable. If revived later, it lives in Scale tab → More.

### 3c. Layer visibility — one toggle per layer, in its tab

The top-band eye-toggles are removed (§3b). Replacement: one visibility switch at the top of each layer's Inspector tab.

- **Scale tab → top row:** `Scale layer  [ Switch ]`
- **Chord tab → top row:** `Chord layer  [ Switch ]`

Each writes to its existing atom (`scaleVisibleAtom`, `chordOverlayHiddenAtom`). No other surfaces. The fretboard itself is the readout — if the layer is hidden, you see it's hidden by looking at the fretboard.

Keyboard shortcuts (existing pattern in app): `S` toggles scale visibility, `C` toggles chord visibility. Discoverable via `HelpModal`.

### 3d. Per-tab sub-structure: Music above, Display below

Each layer tab is internally split into two sub-sections (visually labeled, not as separate tabs):

- **Music** — what the layer *is* (theory): scale key/type, chord quality/voicing, progression steps.
- **Display** — how the layer is *drawn* within itself: lens, region, scope-to-position, connectors, chord spread.

This places per-layer rendering preferences with their layer (not in a generic View tab) while distinguishing music decisions from rendering preferences.

### 3e. Cross-tab dependencies made visible

Wherever a tab consumes another tab's state, an explicit reference is rendered:

- Chord tab → region row: hint reads *"Position comes from Scale → Fingering. Currently: CAGED Shape A."* The "Scale → Fingering" segment is a click-target that routes to Scale tab.
- Chord tab → top: context header reads *"Editing bar 1 · Am (i) — writes to your progression"*.
- Song tab → step row: per-step "Edit on Chord ↗" link (currently in screenshot but unbuilt) routes to Chord tab with that step active.

---

## 4. Chord domain redesign

### 4a. Unified chord state

The chord state has three fields, written by either input UI:

```ts
interface Chord {
  root: string;                    // canonical note name, e.g., "A"
  quality: string;                 // e.g., "Minor Triad"
  cachedDegree: DegreeId | null;   // last-known scale-degree relationship
}
```

This replaces the trio (`chordDegreeAtom`, `chordRootOverrideAtom`, `chordQualityOverrideAtom`) and the mode discriminator (`chordOverlayModeAtom`). The chord state lives on the active progression step (`ProgressionStep` gains `cachedDegree`). Editing the Chord tab writes back to the active step.

### 4b. Two input affordances — same state

The Chord-tab Music section exposes two equally-prominent inputs, side by side:

- **Degree input** — Roman-numeral picker constrained to the active scale. Sets `root` from `getDiatonicChord(degree, scale, scaleRoot)` and `cachedDegree`.
- **Manual input** — Root note picker + quality picker, unconstrained. Sets `root` and `quality` directly; recomputes `cachedDegree` (null if the chord is not in-key).

The user picks the input style per-action. There is no "mode" — both inputs always work, always write the same state.

### 4c. Out-of-scale transpose rule

On scale change (key or scale type), each progression step's chord is updated as follows:

- **`cachedDegree` is non-null** (in-key chord): re-derive `root` via `getDiatonicChord(cachedDegree, newScale, newScaleRoot)`. Quality is preserved unless the new scale's diatonic-default quality differs *and* the user has not set a quality override.
- **`cachedDegree` is null** (out-of-scale chord): compute the interval from old `scaleRoot` to new `scaleRoot` and transpose `root` by that interval. The chord stays at the same relative pitch.

Implementation uses Tonal.js: `Note.transpose(root, Interval.distance(oldScaleRoot, newScaleRoot))`.

### 4d. Visibility decoupled from input

The Chord-tab visibility switch (§3c) controls `chordOverlayHiddenAtom` and is independent of all input state. Hidden does not mean "no chord" — the active step is still semantically the current chord; it's just not drawn.

### 4e. Mode toggle removed

`ChordOverlayControls.tsx:191` — the `Off / Degree / Manual` ToggleBar — is deleted. Along with:

- `chordOverlayModeAtom`
- `effectiveChordOverlayModeAtom`
- `chordOverlayModeStorage`
- `i18n` strings `controls.mode`, `controls.modeHint`, `controls.off`, `controls.manual` (the `controls.degree` key remains, repurposed for the Degree input label)

### 4f. Silent side-effects removed

- The auto-flip-to-manual on `chordRootAtom`/`chordTypeAtom` write (today `chordOverlayAtoms.ts:270`, `:331`) is unnecessary in the new model — there is no mode — and is removed.
- The clear-quality-override on `chordDegreeAtom` change becomes explicit: when the user changes a step's degree via the Degree input, the Chord-tab header announces "Quality reset to diatonic default for new degree" briefly.

---

## 5. Lens redesign — Tones and Lead

The current three lenses (`targets`, `guide-tones`, `tension`) are replaced with two:

### 5a. `tones` lens (default; replaces `targets`)

Static visual treatment for the active chord:

- **Base:** Full-CAGED-style coloring — chord notes share the connector color, reading as a single visual unit on the fretboard. This is the treatment the user identified as "what I like about Full CAGED — all notes on that chord are the same color as the connector."
- **Guide tones (3rd and 7th)** get a stronger emphasis within the chord: brighter fill, slight scale-up, or inner glow ring (visual treatment to be finalized in a follow-up frontend-design pass).
- Scale notes dim to ambient brightness (`note-scale-only` role).

### 5b. `lead` lens (new; replaces `guide-tones` + `tension`)

Dynamic visual treatment for improvisation. Builds on Tones as the base, then adds progression-aware cues:

- **Common tones with next chord** glow steady — a "hold this" cue. Computed as `Chord.notes(currentChord).intersect(Chord.notes(nextChord))` via Tonal.
- **Notes that will depart** (in current chord, not in next) get a subtle directional cue — fade or arrow toward their resolution target.
- **Anticipation window (last beat of current bar):** the next chord's guide tones ghost-in at low opacity, so the user has been looking at where they'll land before they land there.
- **Beat-strength sub-toggle (optional, default on):** chord tones saturate on beats 1 and 3, dim on 2 and 4 — the "downbeat = target, upbeat = passing" pedagogical pattern.

### 5c. Architecture

New derived atoms in `practiceLensAtoms.ts`:

```ts
nextChordTonesAtom        // chord tones of the step after activeProgressionStepIndex
commonTonesWithNextAtom   // intersection of current + next chord notes
beatPositionAtom          // current beat within the active step (0..duration in beats)
```

`beatPositionAtom` derives from `progressionStepDeadlineAtom` + `progressionTempoBpmAtom` + the step's duration. It exists regardless of playback state — when paused, it returns the current frozen position.

### 5d. What disappears

- `practiceLens` enum values `guide-tones` and `tension` are removed. (`targets` is renamed to `tones`.)
- `lensAvailabilityAtom`'s three-entry registry shrinks to two.
- Lens-related i18n keys for `guide-tones` and `tension` are dropped.

### 5e. What's deferred

The research identified additional candidates (approach-note lens, avoid-note lens, beat-strength as its own lens). These are not in v1. They can be added later as sub-toggles within Lead or as a third lens if usage data justifies it.

---

## 6. Voicing redesign

### 6a. Region — single 4-state control

`chordScopeToPositionAtom` (boolean) and `chordFretSpreadAtom` (0–4) collapse into one user-facing control: a 4-state ToggleBar.

```
REGION  ⓘ How broadly the chord overlay extends across the fretboard.

[ Position ] [ +2 ] [ +4 ] [ All ]
```

| Value | Effect | Backing atoms |
|---|---|---|
| `Position` | Constrained to the active fingering position; no buffer. | `chordScopeToPositionAtom = true`, `chordFretSpreadAtom = 0` |
| `+2` | Position plus 2 frets each side. | `chordScopeToPositionAtom = true`, `chordFretSpreadAtom = 2` |
| `+4` | Position plus 4 frets each side. | `chordScopeToPositionAtom = true`, `chordFretSpreadAtom = 4` |
| `All` | Whole fretboard, no constraint. | `chordScopeToPositionAtom = false` |

Per-option `title` attributes:

- Position: "Chord shown only within the active fingering position."
- +2: "Chord shown within the position, plus 2 frets each side."
- +4: "Chord shown within the position, plus 4 frets each side."
- All: "Chord shown across the whole fretboard."

When no active position exists (fingering = None or multi-shape CAGED), the three position-relative values disable; the control collapses to `All` automatically and a hint clarifies why: "No active position — region defaults to All." This reuses the existing `activePositionAtom` from the controls-overhaul spec.

Buffer values 1 and 3 are dropped from the UI. The atoms still support them; a Settings-overlay power-user slider may expose finer control in a future spec.

### 6b. String set — simpler and contextual

The graphical 6-string `StringSetPicker` is replaced with a `LabeledSelect` of named options:

```
STRING SET  ⓘ Which strings to use for this voicing.

[ Top 3 strings (1-2-3)              ▾ ]
```

Options are computed by `stringSetOptionsAtom` (already exists). Display labels favor named groupings ("Top 3 strings", "Middle 3 strings", "Bottom 3 strings", "Strings 2-3-4", etc.) over numeric IDs. Same UX is used by the Scale-tab string-study modes — one picker pattern across the app.

`StringSetPicker.tsx` is removed; `LabeledSelect` is used in both call sites.

### 6c. Visual base — Full-CAGED style as default

Chord-note coloring matches the voicing connector color by default (the user-preferred treatment). For triads, when multiple voicings overlap on the same notes, the string-set filter (§6b) is the disambiguation tool — picking a string set narrows the displayed voicings to just that set.

This is partially in place for Full-CAGED voicings; the change is to apply the same treatment to all voicing types.

### 6d. ToggleBar disabled styling

`shared.module.css` gains a `.toggle-btn:disabled` rule:

```css
.toggle-btn:disabled {
  opacity: var(--disabled-opacity);
  cursor: not-allowed;
  color: var(--dc-fg-muted);
}
.toggle-btn:disabled:hover {
  background-color: transparent;
  border-color: transparent;
  color: var(--dc-fg-muted);
}
```

`opacity: var(--disabled-opacity)` reuses the token defined for `.control-button:disabled` (line 98). Tooltips via the existing `title` prop on `ToggleBarOption` are unchanged.

This applies wherever ToggleBar disables an option: voicing type (caged/drop2/triad), voicing inversion, region (when no active position), lens (if a lens is unavailable).

---

## 7. Scale tab redesign

### 7a. Scale picker — one grouped select

`scaleFamilyAtom` + `scaleNameAtom` are replaced with a single grouped `LabeledSelect`:

```
SCALE  [ A Minor Pentatonic                  ▾ ]
       ┌─ Major modes ───────────┐
       │  Ionian (Major)         │
       │  Dorian                 │
       │  ... (7 modes)          │
       ├─ Pentatonics ───────────┤
       │  Major Pentatonic       │
       │  Minor Pentatonic       │
       ├─ Blues ─────────────────┤
       │  Blues Scale            │
       └─ Harmonic / Melodic ────┘
```

The component already supports `LabeledSelectGroup` (used in Progression presets). The atom `scaleNameAtom` becomes the single source; family is derived for display purposes only.

### 7b. Theory facts panel removed

`ScaleTheoryFacts.tsx` and its CSS are deleted. The Circle of Fifths wheel remains. Anything irreplaceable from Theory facts becomes a tooltip annotation on the wheel; in practice the wheel already covers relative-minor/relative-major relationships and the modal positions.

### 7c. Scale relationship toggle removed

The relationship toggle (parent / relative / parallel) is deleted. The wheel always renders the relative key annotation; modal positions are implied by the scale name itself.

### 7d. String-study modes unified UX

1-String and 2-Strings sub-controls use the same `LabeledSelect` for string-set selection as Chord tab voicing (§6b). Same naming conventions ("Top 3 strings" etc.); the underlying atoms differ per mode but the picker is shared.

### 7e. Fingering pattern controls

Fingering pattern controls (None / CAGED / 3NPS / 1-String / 2-Strings) remain in the Scale tab as established by the existing controls-overhaul spec ([`2026-05-19-controls-overhaul-design.md`](2026-05-19-controls-overhaul-design.md)). This spec does not modify their position, presentation, or per-mode sub-controls.

---

## 8. Song tab (renamed from Progression)

### 8a. Renaming

`Progression` tab → `Song`. The atom names, file names, and store-level identifiers keep their existing `progression*` prefixes for storage compatibility; only user-facing label and the tab `id` change.

### 8b. Structure

```
┌── Song ────────────────────────┐
│  Preset · Tempo · Meter        │  always visible — primary controls
│  Step list                     │  primary editor
│                                │
│  ▸ Backing track               │  collapsed by default
└────────────────────────────────┘
```

Backing track (style/lead/comp/bass/drums/swing) is wrapped in a collapsible section, default collapsed. The user picks a preset and the backing track adopts that preset's defaults; advanced tweaking is one disclosure click away.

### 8c. Step-list "Edit on Chord ↗"

The screenshot's "Edit on Chord ↗" link (currently unbuilt) is implemented. Per step:

```
│ 1 │ i  │ A Minor Triad │ 1 bar │ ↗ Edit │
```

Clicking ↗:
- Sets `activeProgressionStepIndexAtom` to that step's index.
- Switches Inspector active tab to `chord`.
- Optionally scrolls the Chord tab to the Music section.

### 8d. Progression playback blocked-reason surfacing

`progressionPlaybackBlockedReasonAtom` (currently shown only as a `statusNote` in `ProgressionTrack`) is also surfaced in the TransportBar Play button's `title` tooltip. The Play button already disables; the tooltip now explains why.

---

## 9. Library adoption

### 9a. Tonal.js (cherry-picked modules)

Adopted modules:

- `@tonaljs/chord` — chord parsing, voicings, intervals
- `@tonaljs/scale` — scale construction, modes
- `@tonaljs/note` — note manipulation, transposition, enharmonics
- `@tonaljs/interval` — interval distance, transposition

Replaces:

| Today | Replaced by |
|---|---|
| `core/theory.ts` chord/scale logic | `@tonaljs/chord`, `@tonaljs/scale` |
| `core/degrees.ts` | `@tonaljs/chord` (Roman-numeral / degree resolution) |
| `core/circleOfFifthsUtils.ts` (parts) | `@tonaljs/key` |
| `getNoteDisplay` + `FLAT_KEYS` enharmonic logic | `@tonaljs/note` (`Note.enharmonic`, `Note.simplify`) |
| `getDiatonicChord` | `@tonaljs/chord.getChord(quality, root)` + degree resolution |

Files removed or shrunk substantially: `core/theory.ts`, `core/theoryCatalog.ts`, `core/degrees.ts`, `core/circleOfFifthsUtils.ts`.

Constants for chord definitions, scale names, etc. in `core/constants.ts` may stay as a thin app-specific layer mapping Tonal types to FretFlow's display labels.

### 9b. Tone.js

Adopted for audio playback. Replaces:

| Today | Replaced by |
|---|---|
| Bespoke step-deadline timer in `progressionAtoms.ts:343-347` | `Tone.Transport` |
| Manual step advance via `setTimeout` / event loop | `Tone.Sequence` |
| `core/audio.ts` `GuitarSynth` singleton | `Tone.PolySynth` + `Tone.Sampler` |
| Backing-track audio scheduling in `src/progressions/audio/*` | `Tone.Pattern` + `Tone.Loop` |
| Metronome via custom oscillator | `Tone.Transport.scheduleRepeat` |

Significant code reduction in `src/progressions/audio/`. Latency and timing precision improve (Tone uses Web Audio's scheduling clock).

### 9c. What is *not* adopted now

`@tonejs/midi`, `VexFlow`, `abcjs`, `scribbletune`, `@dnd-kit`, `idb-keyval` — deferred until specific features pull them.

### 9d. Bundle impact

- `@tonaljs/*` cherry-picked: ~15–20KB gzipped (vs ~50KB for the full package).
- `Tone.js`: ~150KB gzipped.
- Net offset: removing `core/theory.ts`, `core/degrees.ts`, parts of `core/circleOfFifthsUtils.ts`, and chunks of `src/progressions/audio/*` saves on the order of 30–60KB of source (less compressed). Approximate net add: ~120KB gzipped.

---

## 10. File-level impact

### Removed

- `src/components/FretboardLensOverlay/FretboardLensOverlay.tsx`
- `src/components/FretboardLensOverlay/FretboardLensOverlay.module.css`
- `src/components/TopBandSummary/TopBandSummary.tsx`
- `src/components/TopBandSummary/TopBandSummary.module.css`
- `src/components/DegreeChipStrip/DegreeChipStrip.tsx` (audit other consumers first)
- `src/components/ChordPracticeBar/ChordPracticeBar.tsx` (audit other consumers first)
- `src/components/Inspector/ScaleTheoryFacts.tsx`
- `src/components/Inspector/ViewTab.tsx`
- `src/components/Inspector/scaleTheoryDerivations.ts`
- `src/components/Inspector/StringSetPicker.tsx`
- `src/components/Inspector/StringSetPicker.module.css`
- `src/core/theory.ts` (replaced by Tonal)
- `src/core/theoryCatalog.ts` (replaced by Tonal)
- `src/core/degrees.ts` (replaced by Tonal)
- `src/core/circleOfFifthsUtils.ts` (most logic moves to `@tonaljs/key`)
- `src/store/chordOverlayAtoms.ts` — `chordOverlayModeAtom`, `effectiveChordOverlayModeAtom`, `chordOverlayModeStorage`, `chordRootOverrideAtom`, `chordQualityOverrideAtom`, `chordDegreeAtom` (consolidated into the active step)

### Substantially changed

- `src/App.tsx` — remove Top-band rendering, remove View tab from layout.
- `src/components/Inspector/Inspector.tsx` — three tabs instead of four.
- `src/components/Inspector/tabs.tsx` — remove `view`; rename `progression` → `song`.
- `src/components/Inspector/ScaleTab.tsx` — add layer-visibility switch at top; replace family+mode with grouped select; remove theory facts; remove relationship toggle.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — remove Mode toggle; add layer-visibility switch at top; add context header; unify degree+manual inputs; replace scope/spread with Region ToggleBar; replace StringSetPicker with LabeledSelect.
- `src/components/ProgressionControls/ProgressionControls.tsx` — rename to SongControls (file rename + import updates); collapse backing track; add Edit-on-Chord links to step rows.
- `src/components/TransportBar/TransportBar.tsx` — surface `progressionPlaybackBlockedReasonAtom` in the Play button `title`.
- `src/components/SettingsOverlay/` — add Display section with note labels, accidentals, fret range, degree colors.
- `src/store/practiceLensAtoms.ts` — collapse three lenses to two (`tones`, `lead`); add `nextChordTonesAtom`, `commonTonesWithNextAtom`, `beatPositionAtom`.
- `src/store/scaleAtoms.ts` — `scaleFamilyAtom` derived from `scaleNameAtom`, not stored.
- `src/store/progressionAtoms.ts` — `ProgressionStep` gains `cachedDegree`; on-write hook updates it.
- `src/progressions/audio/*` — rewritten on Tone.js.
- `src/core/audio.ts` — replaced with Tone.js synths/samplers.
- `src/components/shared/shared.module.css` — `.toggle-btn:disabled` rule added.

### New

- `src/store/songStateAtoms.ts` (or similar) — unified atom selectors for the active chord (delegating to the active step).
- `src/lib/tonalAdapters.ts` — thin app-specific wrappers around Tonal modules for display-label mapping.

### i18n

- Remove keys: `controls.mode`, `controls.modeHint`, `controls.off`, `controls.manual`, `inspector.viewTab`, lens keys for `guide-tones` and `tension`.
- Add keys: chord-tab visibility-switch label, scale-tab visibility-switch label, Region ToggleBar label + per-option titles + hint, lens labels for `tones` and `lead`, Edit-on-Chord link label, scope-via-Settings labels for migrated View prefs.

---

## 11. State migration

`atomWithStorage` persists state in localStorage with the `k()` prefix. Migration concerns:

### 11a. Chord-mode collapse

Existing values of `chordOverlayMode`:

- `"off"` → set `chordOverlayHiddenAtom = true`. The progression remains the chord source (as it always has been under the hood); only the visual overlay is hidden, matching what `"off"` users were trying to achieve.
- `"manual"` → discard the persisted `chordRootOverride` and `chordQualityOverride`. The user's manual chord is *not* preserved as a step's quality override, because the progression's existing steps already define the chord sequence. Adding a "scratch" step from the migrated manual chord would alter the user's progression arrangement, which is more surprising than losing the manual chord. A first-load `HelpModal` notice explains: "Manual chord mode has been removed — edit the active progression step directly to customize the chord."
- `"degree"` → no change; the progression was already the effective source.

The migration is one-shot, run on first load after upgrade, via a `migrate` hook in `chordOverlayModeStorage` (and then the storage entry is removed). The orphaned `chordRootOverride` and `chordQualityOverride` storage entries are deleted in the same pass.

### 11b. Lens collapse

Existing values of `practiceLens`:

- `"targets"` → `"tones"` (renamed; semantics preserved + guide-tone emphasis now built in).
- `"guide-tones"` → `"tones"` (guide-tone emphasis is now part of Tones, not a separate lens).
- `"tension"` → `"lead"` (tension/color is folded into Lead's color treatment alongside voice-leading cues).

Note: `"tension"` users will see a different visual treatment under Lead — it adds anticipation and common-tone cues their old lens did not have. A one-time `HelpModal` notice on first load after upgrade explains the lens redesign.

### 11c. Scale family + mode collapse

`scaleFamily` storage entry is removed; `scaleName` is the single source. Existing `scaleName` values continue to deserialize unchanged.

### 11d. Region collapse

`chordScopeToPosition` + `chordFretSpread` continue to back the new control. No storage migration needed; the UI maps existing values to the nearest 4-state value (spread 0→Position, 1-2→+2, 3-4→+4, scope-off→All).

### 11e. View tab → Settings overlay

Existing atoms (`noteLabelStyleAtom`, `useFlatsAtom`, `fretRangeAtom`, `themeAtom`, `degreeColorsEnabledAtom`) are unchanged. Only the rendering location moves.

---

## 12. Testing strategy (TDD — failing test first per task)

### Unit / component tests

- **`chordOverlayAtoms.test.ts`** — remove tests for `chordOverlayMode`, `effective*`, `chordRootOverride`, `chordQualityOverride`. Add tests for unified chord state on the active step; out-of-scale transpose by interval; degree input transposes diatonically; manual input clears `cachedDegree` when chord is out of key.
- **`practiceLensAtoms.test.ts`** — `lensAvailabilityAtom` returns 2 entries (`tones`, `lead`). Migrations from `targets`/`guide-tones`/`tension` map correctly. `commonTonesWithNextAtom` computes intersection. `beatPositionAtom` derives from step deadline.
- **`progressionAtoms.test.ts`** — `ProgressionStep` carries `cachedDegree`. Scale change updates step roots diatonically for in-key cached degrees; transposes by interval for null cached degrees.
- **`ChordOverlayControls.test.tsx`** — no Mode toggle. Visibility switch at top toggles `chordOverlayHiddenAtom`. Degree input writes to active step. Manual input writes to active step + clears cachedDegree if out of key. Region ToggleBar has 4 states. String set is a select.
- **`ScaleTab.test.tsx`** — scale picker is a grouped select. Theory facts not rendered. Relationship toggle not rendered. Visibility switch at top.
- **`SongTab.test.tsx`** (renamed) — backing track collapsed by default. Each step has an Edit-on-Chord link routing to Chord tab + activating that step.
- **`ToggleBar.test.tsx`** — disabled options render with the disabled class and applied opacity; hover does not change appearance.
- **`Inspector.test.tsx`** — three tabs: Scale, Chord, Song. No View tab.
- **`useFretboardState.test.tsx`** — visibility atoms gate rendering; Region affects fullChordMatches filter; lens roles include `lead` outputs (common-tone, anticipation).

### Visual regression

- `e2e/app-components.visual.spec.ts` — refresh snapshots for the Chord tab, Scale tab, Song tab (all changed).
- `e2e/app-layout.visual.spec.ts` — refresh for Inspector tab list (3 tabs), top-band removal.
- `e2e/app-overlays.visual.spec.ts` — refresh chord-overlay rendering with Full-CAGED-style coloring as default.
- `e2e/fretboard-svg.visual.spec.ts` — refresh lens variants (Tones / Lead).
- Refresh both darwin and linux snapshots.

### E2E

- `e2e/chord-overlay.spec.ts` — visibility switch in Chord tab hides overlay; visibility switch in Scale tab hides scale notes; both independent.
- `e2e/song-edit-flow.spec.ts` — click Edit-on-Chord link in Song tab → Inspector switches to Chord tab → active step matches.
- `e2e/lens-anticipation.spec.ts` — during last beat of a step, next chord's guide tones render at low opacity.

---

## 13. Phasing

This spec describes a large coordinated change. Implementing it as one PR is impractical. Phased rollout:

| Phase | Contents | Depends on |
|---|---|---|
| **1. Foundation** | Tonal.js adoption. Replace `core/theory.ts`, `core/degrees.ts`, `core/circleOfFifthsUtils.ts`. Tests adapted. No UI change. | — |
| **2. Chord unification** | Active-step-as-source-of-truth. Remove mode toggle, `chordOverlayModeAtom`, override atoms. Add `cachedDegree` to steps. Migration. | Phase 1 |
| **3. Inspector reshape** | Remove View tab. Move View contents to Settings overlay. Rename Progression → Song. Add per-tab visibility switches. Remove top-band. | Phase 2 |
| **4. Lens redesign** | Collapse three lenses to Tones + Lead. Add `nextChordTonesAtom`, `commonTonesWithNextAtom`, `beatPositionAtom`. Full-CAGED-style base treatment. | Phase 2 |
| **5. Voicing simplification** | Region ToggleBar replacing scope+spread. StringSet → LabeledSelect. Disabled ToggleBar styling. | Phase 2 |
| **6. Scale simplification** | Family+mode grouped select. Remove Theory facts. Remove relationship toggle. | Phase 1 |
| **7. Audio (Tone.js)** | Replace bespoke audio engine. Beat-aware lens timing precision improves. | Phase 1 |
| **8. Polish** | Edit-on-Chord links. Playback-blocked tooltip. Cross-tab dependency hints. | Phases 2–7 |

Phases 4 and 7 are independent of each other and can run in parallel. Phases 6 and 1 can begin together.

---

## 14. Cross-cutting notes

- All new user-facing strings go through `useTranslation` (en + es).
- Persisted atoms use `atomWithStorage` + `k()` key prefix. Defaults set conservatively (visibility on, region `+2`, lens `tones`).
- Mandatory before each PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b`.
- Visual regression baselines refresh per phase, darwin + linux.
- `HelpModal` updated each phase with the relevant new keyboard shortcuts (`S`, `C` for visibility) and conceptual notes (the active chord is always a progression step; lens variants; region).
- `CLAUDE.md` updated to reflect the new architecture (three tabs, layer model, Tonal/Tone adoption).

---

## 15. Acceptance criteria

### Chord domain

- The Chord tab has no Mode toggle.
- The chord overlay can be hidden by a visibility switch at the top of the Chord tab.
- Editing the Chord tab's quality or root writes back to the active progression step.
- Changing the scale transposes in-scale chords diatonically and out-of-scale chords by the new-scale-root interval.
- Both Degree and Manual inputs are simultaneously available on the Chord tab; both write to the same state.

### Inspector

- The Inspector has three tabs: Scale, Chord, Song.
- The View tab is absent.
- Note labels, accidentals, fret range, theme, and degree-colors controls are in the Settings overlay.
- Each layer tab has a visibility switch at the top.

### Top band

- The top-band legend strip is not rendered.
- The fretboard renders without the inline legend; the StatusBar carries the scale/chord/lens text labels.

### Lens

- Two lenses are available: Tones and Lead.
- Lead's anticipation window ghosts the next chord's guide tones during the last beat of the current step.
- Existing persisted lens values (`targets`, `guide-tones`, `tension`) migrate to `tones` or `lead` on first load after upgrade.

### Voicing

- The Region control is a 4-state ToggleBar: Position, +2, +4, All.
- The String Set picker is a `LabeledSelect`, not the graphical 6-string picker.
- Disabled ToggleBar options render with reduced opacity, `not-allowed` cursor, and no hover effect.

### Scale

- Scale picker is a single grouped `LabeledSelect`.
- The Theory Facts panel and the Scale Relationship toggle are gone.
- String-study modes use the same `LabeledSelect` picker pattern as Chord-tab voicing.

### Song (renamed Progression)

- The tab label reads "Song".
- The Backing Track section is collapsed by default.
- Each step row has an "Edit on Chord ↗" link that switches to the Chord tab and activates that step.
- The TransportBar Play button's tooltip surfaces `progressionPlaybackBlockedReasonAtom` when disabled.

### Libraries

- `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/note`, `@tonaljs/interval` are dependencies. The bespoke theory layer (`core/theory.ts`, `core/degrees.ts`, `core/circleOfFifthsUtils.ts`) is removed or substantially shrunk.
- `tone` is a dependency. The bespoke audio scheduling layer is replaced by `Tone.Transport` + `Tone.Sequence`.
- No other libraries are added.

### Build / quality gates

- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass at each phase boundary.
- Visual regression suites pass (darwin and linux) at each phase boundary.

---

## 16. What this spec deliberately does not address

- **Visual restyle.** Colors, spacing, typography are unchanged except where structurally required (e.g., the chord-note coloring base treatment). A dedicated visual refresh spec follows.
- **New voicing types.** No additions to `caged`/`drop2`/`triad`.
- **New fingering patterns.** The five (none/caged/3nps/one-string/two-strings) are unchanged.
- **Notation rendering.** No staff view, no MIDI export.
- **Multiple progressions / song library.** Save/load of named songs is out of scope.
- **AI features.** No suggested progressions, no generated melodies.

These can become future specs once the integration is stable.
