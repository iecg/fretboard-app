# FretFlow — Claude Code Guide

React 19 + TypeScript guitar fretboard tool. Deployed to GitHub Pages.

## Commands

```bash
pnpm run dev                   # start dev server
pnpm run build                 # production build (tsc -b && vite build)
pnpm run test                  # vitest run
pnpm run test:watch            # vitest watch
pnpm run test:coverage         # vitest with v8 coverage
pnpm run test:e2e              # playwright against dev server
pnpm run test:e2e:production   # build + playwright against vite preview
pnpm run test:visual           # build + visual regression suite
pnpm run test:visual:update    # refresh darwin visual snapshots
pnpm run lint                  # eslint + stylelint
pnpm run preview               # preview build locally
```

**MANDATORY:** Run `lint`, `test`, and `build` locally before PR.

## Development Workflow

- **Branching:** Trunk-based. `main` = trunk. PRs required.
- **Commits:** Conventional Commits with scope. `type(scope): message`.
- **Breaking changes:** The Auto Release workflow uses the Angular preset, which does **not** recognize the `!` shorthand (e.g. `feat!:`). To trigger a major version bump you **must** include a `BREAKING CHANGE:` footer in the commit body:

  ```text
  feat(scope): short subject

  Optional body.

  BREAKING CHANGE: explanation of what breaks and how to migrate.
  ```

  When merging a PR via squash, ensure the squash commit body (not just the title) carries the footer — GitHub does not append PR body to the commit by default. Without the footer, breaking PRs will be released as a minor bump.
- **Releases:** Triggered via GitHub Actions (Auto Release). Never tag manually.

## Architecture

### State & Logic

- **State:** Jotai atoms under `src/store/`, domain-split across `scaleAtoms`, `chordOverlayAtoms`, `practiceLensAtoms`, `fingeringAtoms`, `shapeAtoms`, `layoutAtoms`, `audioAtoms`, `uiAtoms`, `progressionAtoms`, `songStateAtoms`, `voicingFallbackAtoms`, `voicingStringSets`, `composableSelectors`, `actions`. Import directly from the relevant domain module (e.g. `import { rootNoteAtom } from "../store/scaleAtoms"`). Components subscribe directly to the atoms they consume (atomic reactivity — no prop drilling).
- **Domain (pure):** `@fretflow/core` workspace package at `packages/core/src/` — `theory.ts`, `theoryCatalog.ts`, `guitar.ts`, `degrees.ts`, `circleOfFifthsUtils.ts`, `diatonicNotes.ts`, `constants.ts`. Includes the `shapes/` package (`templates`, `fullChordShapes`, `voicings`, `helpers`, `polygons`, `threeNPS`, `analytics`, `practicePatterns`).
- **Music theory:** `@fretflow/core`'s theory functions (`getNoteDisplay`, `getChordNotes`, `getScaleNotes`, `getDiatonicChord`, `getKeySignature`, etc.) are backed by [Tonal.js](https://github.com/tonaljs/tonal) (`@tonaljs/note`, `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/key`, `@tonaljs/interval`, `@tonaljs/roman-numeral`, `@tonaljs/progression`). Naming translation lives in `packages/core/src/lib/tonal.ts`.
- **Audio:** `GuitarSynth` singleton in `src/core/audio.ts` (Web Audio API). Tone.js progression playback in `src/progressions/` + `src/hooks/useProgressionAudioPlayback.ts`.
- **Persistence:** `atomWithStorage` with keys prefixed via `src/utils/storage.ts`.

### Components & Layout

- **Orchestration:** `src/App.tsx` (~260 lines) wires atoms to `MainLayoutWrapper`.
- **Rendering:** `components/Fretboard/Fretboard.tsx` wraps `components/FretboardSVG/FretboardSVG.tsx` (the primary SVG renderer — large, direct atom subscriptions). `components/CircleOfFifths/` handles root/degree selection.
- **Layout:** `useLayoutMode` (in `src/hooks/`) measures viewport via `src/layout/responsive.ts` → returns `{ tier, variant, … }`. `MainLayoutWrapper` emits `data-layout-tier` (mobile/tablet/desktop) and `data-layout-variant` (mobile/landscape-mobile/tablet-split/tablet-stacked/desktop-split/desktop-stacked/desktop-3col) attributes. **Both gate responsive CSS — always consider both.**
- **Primitives:** `NoteGrid`, `ToggleBar`, `StepperControl`, `LabeledSelect`, `Card`, `InspectorCard`.

## File Layout

```text
packages/
└── core/                     # @fretflow/core — pure music-theory package
    └── src/                  # theory, theoryCatalog, guitar, degrees, circleOfFifthsUtils,
                              # diatonicNotes, constants, shapes/, lib/tonal.ts

src/
├── App.tsx                   # orchestrator (~260 lines)
├── main.tsx
├── core/                     # app-side runtime (audio, lazyGuitarAudio, toneInit,
│                             # fretboardLayoutCache, polygonCoverage)
├── store/                    # Jotai atom modules (domain-split) + actions.ts
├── hooks/                    # useLayoutMode, useFretboardState, useFretboardTopologyModel,
│                             # usePlaybackTransportModel, useProgressionAudioPlayback, ...
├── layout/                   # breakpoints + responsive layout resolver
├── progressions/             # progression domain + Tone.js audio engine
├── utils/                    # storage helpers, dom helpers
├── i18n/                     # translation strings + useTranslation
├── test-utils/               # renderWithAtoms, a11y helpers, vitest setup
├── styles/                   # tokens.css, semantic.css, App.css, index.css (global only)
├── assets/                   # static images
├── components/               # PascalCase folders; tests + CSS modules co-located
└── __tests__/__snapshots__/  # gitignored; auto-generated in CI (vitest.update='new' seeds missing snapshots)
```

## Conventions

- **Notes:** Stored as sharps internally (`C#`, `D#`). Flats resolved at render via `getNoteDisplay(note, rootNote)` / `FLAT_KEYS`.
- **Tuning:** Arrays ordered high string (index 0) to low string.
- **Coordinates:** `"string-fret"` keys (e.g., `"0-12"`).
- **Tests:** Co-located with source — `components/<Name>/<Name>.test.tsx`, `core/<name>.test.ts`, `store/<name>.test.ts`. Shared helpers in `src/test-utils/`.
- **CSS:**
  - CSS Modules (`*.module.css`) for all component-scoped styles (38 modules).
  - Global foundations under `src/styles/` (`tokens.css`, `semantic.css`, `App.css`, `index.css`) — imported via `src/styles/index.css`.
  - Shared module CSS in `src/components/shared/shared.module.css`.
  - Use `clsx` for conditional classes, `cva` for variant class systems, `motion` (from `motion/react`) for animations.
  - Stylelint wired into `pnpm run lint` and `lint-staged`. Package manager is **pnpm** (workspace defined in `pnpm-workspace.yaml`).
- **React Compiler:** Enabled via `babel-plugin-react-compiler` in `vite.config.ts` with `compilationMode: 'infer'`. Every component and hook in `src/` and `packages/core/src/` is auto-memoized — manual `useMemo` / `useCallback` / `React.memo` is rarely needed for render-perf and should be added only when profiling proves it. The `react-compiler/react-compiler` ESLint rule runs at `error` and guards Rules-of-React compliance. To opt a single component out, add `'use no memo'` as the first statement of the function body with a `// TODO(react-compiler): <reason>` comment.
- **A11y:** ARIA labels + semantic HTML + `:focus-visible` styles required. `vitest-axe` available for component tests.

## CAGED / 3NPS System

1. `packages/core/src/shapes/` finds note positions via `SHAPE_CONFIGS` and generates polygon vertices (fixed templates for pentatonic, dynamic for 7-note scales). `fullChordShapes.ts` + `voicings.ts` provide full-chord and close-voicing pickers.
2. Orchestrator merges adjacent boundaries with buffer.
3. `FretboardSVG.tsx` renders pixel SVG polygons; `useChordConnectorPolylines` draws the connector polylines linking voicing notes.

## Note Roles

Notes carry a semantic role (`root-active`, `chord-tone`, `note-blue`, `note-active`, `note-scale-only`, `chord-outside`, `note-inactive`). The **emphasis layer** in `src/components/FretboardSVG/utils/semantics.ts#getEmphasis` adds voice-leading cues (anticipation, hold, departing) when a progression is active, falling back to guide-tone emphasis when there's no progression. **Scale and chord are independent domains** — do not cross-wire their visibility or color state.

## Testing

- **Vitest** + Testing Library for unit/component (jsdom). Coverage via `@vitest/coverage-v8`.
- **Playwright** for e2e + visual regression. Configs: default (dev server), production (serves `dist/`), production-base, visual.
- **Visual regression suites** under `e2e/`: `app-components`, `app-layout`, `app-mobile`, `app-overlays`, `fretboard-svg` — each with committed darwin + linux snapshots. Update via `pnpm run test:visual:update` (darwin) or `pnpm run test:visual:update:linux` (cross-platform).
- **a11y:** `vitest-axe` + `eslint-plugin-jsx-a11y`.

## CI / Release

- `ci.yml`: `changes` (paths-filter) → parallel `test` + `build` → `e2e` (downloads `dist`, production config) → `quality-gate` (skipped-aware PR comment). Docs-only PRs report `skipped` without breaking required checks.
- `deploy.yml`: GitHub Pages.
- `auto-release.yml`: manual trigger, semver from Conventional Commits.
- Dependabot weekly for npm + github-actions.
