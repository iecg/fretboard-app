# Architecture Reference

The detailed structural map of FretFlow — module inventory, component wiring, rendering pipeline, and CI shape. **Read on demand** when you're about to touch a subsystem; not preloaded into agent context. [`AGENTS.md`](../../AGENTS.md) keeps only the one-line orientation and points here.

## State & Logic

- **State:** Jotai atoms live in `@fretflow/fretboard` (`packages/fretboard/src/store/`), domain-split across `scaleAtoms`, `chordOverlayAtoms`, `practiceLensAtoms`, `fingeringAtoms`, `shapeAtoms`, `layoutAtoms`, `audioAtoms`, `uiAtoms`, `progressionAtoms`, `songStateAtoms`, `voicingFallbackAtoms`, `voicingStringSets`, `composableSelectors`, `actions`. App-shell atoms (`inspectorAtoms`, `languageAtom`, `urlOverrideAtoms`) remain in `src/store/`. Old `src/store/*` paths are thin re-export stubs — new code should import from `@fretflow/fretboard/store/<module>` (or the package's public surface) directly. Components subscribe directly to the atoms they consume (atomic reactivity — no prop drilling).
- **Domain (pure):** `@fretflow/core` workspace package at `packages/core/src/` — `theory.ts`, `theoryCatalog.ts`, `guitar.ts`, `degrees.ts`, `circleOfFifthsUtils.ts`, `diatonicNotes.ts`, `constants.ts`. Includes the `shapes/` package (`templates`, `fullChordShapes`, `voicings`, `helpers`, `polygons`, `threeNPS`, `analytics`, `practicePatterns`).
- **Music theory:** `@fretflow/core`'s theory functions (`getNoteDisplay`, `getChordNotes`, `getScaleNotes`, `getDiatonicChord`, `getKeySignature`, etc.) are backed by [Tonal.js](https://github.com/tonaljs/tonal) (`@tonaljs/note`, `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/key`, `@tonaljs/interval`, `@tonaljs/roman-numeral`, `@tonaljs/progression`). Naming translation lives in `packages/core/src/lib/tonal.ts`.
- **Audio:** `GuitarSynth` singleton in `packages/fretboard/src/core/audio.ts` (Web Audio API). Tone.js progression playback in `packages/fretboard/src/progressions/` + `packages/fretboard/src/hooks/useProgressionAudioPlayback.ts`. The matching `src/` paths (`src/progressions/`, `src/hooks/useProgressionAudioPlayback.ts`) are thin re-export stubs — import from `@fretflow/fretboard/...` in new code.
- **Persistence:** `atomWithStorage` with keys prefixed via `src/utils/storage.ts`.

## Components & Layout

- **Orchestration:** `src/App.tsx` wires atoms to `MainLayoutWrapper`.
- **Rendering:** `packages/fretboard/src/components/Fretboard/Fretboard.tsx` wraps `packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx` (the primary SVG renderer — large, direct atom subscriptions). The package's public contract is `FretboardEmbed` (serializable `config` in, `FretboardEvent`s out via `onEvent`, `audio: "builtin" | "events"`) — an additive surface that does not change how the web app renders `<Fretboard/>`.
- **Controls:** `components/Inspector/` is the control surface — a two-tab Inspector (`tabs.tsx`: `view` → "Overlay", `song` → "Song"). The **Overlay** tab (`ViewTab.tsx`) stacks two `InspectorCard`s: a Scale card hosting `FingeringPatternControls` (pattern / shape / position) and a Chord card hosting `ChordOverlayControls` (voicing + close-mode string set). The **Song** tab (`SongControls/SongControls.tsx`) owns key + scale (root/scale dropdowns), progression preset + sequence, time signature + tempo, and the backing track. On mobile the Inspector renders as a bottom tab bar; on larger screens as side-by-side cards.
- **Layout:** `useLayoutMode` (in `src/hooks/`) measures viewport via `src/layout/responsive.ts` → returns `{ tier, variant, … }`. `MainLayoutWrapper` emits `data-layout-tier` (mobile/tablet/desktop) and `data-layout-variant` (mobile/landscape-mobile/tablet-split/tablet-stacked/desktop-split/desktop-stacked/desktop-3col) attributes. **Both gate responsive CSS — always consider both.**
- **Primitives:** `ToggleBar`, `StepperControl` (+ `StepperSelect`, `StepperShell`), `LabeledSelect`, `NotePill`, `Switch`, `Tooltip` / `SettingsTooltip`, and `InspectorCard`.

## CAGED / 3NPS Rendering Pipeline

1. `packages/core/src/shapes/` finds note positions via `SHAPE_CONFIGS` and generates polygon vertices (fixed templates for pentatonic, dynamic for 7-note scales). `fullChordShapes.ts` + `voicings.ts` provide full-chord and close-voicing pickers.
2. Orchestrator merges adjacent boundaries with buffer.
3. `FretboardSVG.tsx` renders pixel SVG polygons; `useChordConnectorPolylines` draws the connector polylines linking voicing notes.

See [`fretboard-visual-language.md`](./fretboard-visual-language.md) for the *why* behind markers, color, and connectors.

## Note Roles

Notes carry a semantic role (`root-active`, `chord-tone`, `note-blue`, `note-active`, `note-scale-only`, `chord-outside`, `note-inactive`). The **emphasis layer** in `src/components/FretboardSVG/utils/semantics.ts#getEmphasis` adds voice-leading cues (anticipation, hold, departing) when a progression is active, falling back to guide-tone emphasis when there's no progression.

**Scale and chord rendering are independent domains** — do not cross-wire their visibility or color state. (Loading a progression preset is the one intentional exception: it sets the active *scale* — a one-time user action establishing harmonic context — but it does not couple the rendering/color domains.) This guardrail is also stated in `AGENTS.md` because it's easy to violate.

## CI / Release Pipeline

- `ci.yml`: `changes` (paths-filter) → parallel `test` + `build` → `e2e` (downloads `dist`, production config) → `quality-gate` (skipped-aware PR comment). Docs-only PRs report `skipped` without breaking required checks.
- `deploy.yml`: GitHub Pages.
- `auto-release.yml`: manual trigger, semver from Conventional Commits. Release mechanics and the breaking-change footer rules live in [`RELEASING.md`](../../RELEASING.md).
- Dependabot weekly for npm + github-actions.
