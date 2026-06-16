# FretFlow — AI Agent Guide

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
pnpm run lint                  # eslint
pnpm run ui:tokens             # flag undefined CSS token (var(--x)) references — see /ui-review
pnpm run preview               # preview build locally
```

**MANDATORY:** Run `lint` and `test` locally before opening a PR; run `build` too when the change touches types, imports, or the build graph (it's the slow one). Git hooks do **not** run these checks — `.githooks/pre-commit` only blocks direct commits to `main`. CI is the real gate, but running them locally first avoids burning a CI cycle.

## Development Workflow

- **Branching:** Trunk-based. `main` = trunk. PRs required.
- **Commits:** Conventional Commits with scope. `type(scope): message`.
- **Releases & breaking changes:** Triggered via GitHub Actions (Auto Release). Never tag manually. Breaking changes need a `BREAKING CHANGE:` footer (the Angular preset ignores `!`), and footer placement is fiddly — read [`RELEASING.md`](RELEASING.md) before merging a breaking PR or cutting a release.
- **Worktrees (preferred isolation):** Before starting multi-step feature work or executing an implementation plan, create a git worktree first — invoke `superpowers:using-git-worktrees`. Run each concurrent/subagent stream that touches files in its own worktree so parallel agents never clobber a shared working tree. Quick single-file doc/config edits on a short-lived branch may skip the worktree. The `.githooks/pre-commit` nudge is only a last-resort reminder when this was missed.
- **Git hooks:** `.githooks/pre-commit` (plain POSIX shell) hard-blocks direct commits to `main` and prints a non-blocking nudge to use a worktree when committing in the primary checkout while other worktrees exist. Registered via `git config core.hooksPath .githooks` in the `postinstall` script. No husky and no Node-based tooling in hooks — they stay near-zero CPU so concurrent AI agents never thrash or stall on a hung hook.
- **Instruction files:** `AGENTS.md` is the canonical project guide. `CLAUDE.md` and `GEMINI.md` are `@AGENTS.md` import stubs so Claude Code, Gemini CLI, opencode, Codex, Copilot, and Antigravity all read the same content. Edit `AGENTS.md` only.

## Architecture

### State & Logic

- **State:** Jotai atoms live in `@fretflow/fretboard` (`packages/fretboard/src/store/`), domain-split across `scaleAtoms`, `chordOverlayAtoms`, `practiceLensAtoms`, `fingeringAtoms`, `shapeAtoms`, `layoutAtoms`, `audioAtoms`, `uiAtoms`, `progressionAtoms`, `songStateAtoms`, `voicingFallbackAtoms`, `voicingStringSets`, `composableSelectors`, `actions`. App-shell atoms (`inspectorAtoms`, `languageAtom`, `urlOverrideAtoms`) remain in `src/store/`. Old `src/store/*` paths are thin re-export stubs — new code should import from `@fretflow/fretboard/store/<module>` (or the package's public surface) directly. Components subscribe directly to the atoms they consume (atomic reactivity — no prop drilling).
- **Domain (pure):** `@fretflow/core` workspace package at `packages/core/src/` — `theory.ts`, `theoryCatalog.ts`, `guitar.ts`, `degrees.ts`, `circleOfFifthsUtils.ts`, `diatonicNotes.ts`, `constants.ts`. Includes the `shapes/` package (`templates`, `fullChordShapes`, `voicings`, `helpers`, `polygons`, `threeNPS`, `analytics`, `practicePatterns`).
- **Music theory:** `@fretflow/core`'s theory functions (`getNoteDisplay`, `getChordNotes`, `getScaleNotes`, `getDiatonicChord`, `getKeySignature`, etc.) are backed by [Tonal.js](https://github.com/tonaljs/tonal) (`@tonaljs/note`, `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/key`, `@tonaljs/interval`, `@tonaljs/roman-numeral`, `@tonaljs/progression`). Naming translation lives in `packages/core/src/lib/tonal.ts`.
- **Audio:** `GuitarSynth` singleton in `packages/fretboard/src/core/audio.ts` (Web Audio API). Tone.js progression playback in `packages/fretboard/src/progressions/` + `packages/fretboard/src/hooks/useProgressionAudioPlayback.ts`. The matching `src/` paths (`src/progressions/`, `src/hooks/useProgressionAudioPlayback.ts`) are thin re-export stubs — import from `@fretflow/fretboard/...` in new code.
- **Persistence:** `atomWithStorage` with keys prefixed via `src/utils/storage.ts`.

### Components & Layout

- **Orchestration:** `src/App.tsx` wires atoms to `MainLayoutWrapper`.
- **Rendering:** `packages/fretboard/src/components/Fretboard/Fretboard.tsx` wraps `packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx` (the primary SVG renderer — large, direct atom subscriptions). The package's public contract is `FretboardEmbed` (serializable `config` in, `FretboardEvent`s out via `onEvent`, `audio: "builtin" | "events"`) — an additive surface that does not change how the web app renders `<Fretboard/>`.
- **Controls:** `components/Inspector/` is the control surface — a two-tab Inspector (`tabs.tsx`: `view` → "Overlay", `song` → "Song"). The **Overlay** tab (`ViewTab.tsx`) stacks two `InspectorCard`s: a Scale card hosting `FingeringPatternControls` (pattern / shape / position) and a Chord card hosting `ChordOverlayControls` (voicing + close-mode string set). The **Song** tab (`SongControls/SongControls.tsx`) owns key + scale (root/scale dropdowns), progression preset + sequence, time signature + tempo, and the backing track. On mobile the Inspector renders as a bottom tab bar; on larger screens as side-by-side cards.
- **Layout:** `useLayoutMode` (in `src/hooks/`) measures viewport via `src/layout/responsive.ts` → returns `{ tier, variant, … }`. `MainLayoutWrapper` emits `data-layout-tier` (mobile/tablet/desktop) and `data-layout-variant` (mobile/landscape-mobile/tablet-split/tablet-stacked/desktop-split/desktop-stacked/desktop-3col) attributes. **Both gate responsive CSS — always consider both.**
- **Primitives:** `ToggleBar`, `StepperControl` (+ `StepperSelect`, `StepperShell`), `LabeledSelect`, `NotePill`, `Switch`, `Tooltip` / `SettingsTooltip`, and `InspectorCard`.

## File Layout

```text
packages/
├── core/                     # @fretflow/core — pure music-theory package
│   └── src/                  # theory, theoryCatalog, guitar, degrees, circleOfFifthsUtils,
│                             # diatonicNotes, constants, shapes/, lib/tonal.ts
└── fretboard/                # @fretflow/fretboard — fretboard renderer, Jotai store closure,
    └── src/                  # progression engine, audio runtime, FretboardEmbed contract.
                              # Source-only (no dist); consumed via Vite alias + tsconfig paths.
                              # Self-contained: no imports from src/, no import.meta
                              # (enforced by scripts/check-fretboard-boundaries.mjs in `pnpm run lint`).

src/
├── App.tsx                   # orchestrator
├── main.tsx
├── core/                     # app-side runtime (audio, lazyGuitarAudio, toneInit,
│                             # fretboardLayoutCache, polygonCoverage)
├── store/                    # app-shell atoms (inspectorAtoms, languageAtom, urlOverrideAtoms)
│                             # + re-export stubs; the domain atom closure now lives in
│                             # packages/fretboard/src/store/
├── hooks/                    # useLayoutMode, useFretboardState, useFretboardTopologyModel,
│                             # usePlaybackTransportModel, useProgressionAudioPlayback, ...
├── layout/                   # breakpoints + responsive layout resolver
├── progressions/             # (now in packages/fretboard/) progression domain + Tone.js audio engine
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
  - CSS Modules (`*.module.css`) for all component-scoped styles.
  - Global foundations under `src/styles/` (`tokens.css`, `semantic.css`, `App.css`, `index.css`) — imported via `src/styles/index.css`.
  - Shared module CSS in `src/components/shared/shared.module.css`.
  - Use `clsx` for conditional classes, `cva` for variant class systems, `motion` (from `motion/react`) for animations.
  - Linting is **ESLint only** (`pnpm run lint` → `eslint .`); there is no stylelint or lint-staged. Package manager is **pnpm** (workspace defined in `pnpm-workspace.yaml`).
  - **Tokens must resolve.** Every `var(--x)` must point at a defined token (a CSS `--x: …` declaration or a React inline-style key). Run `pnpm run ui:tokens` (or `/ui-review`) before finishing any mobile/tablet UI change — see `docs/design/mobile-ui-contract.md`.
- **React Compiler:** Enabled via `babel-plugin-react-compiler` in `vite.config.ts` with `compilationMode: 'infer'`. Every component and hook in `src/` and `packages/core/src/` is auto-memoized — manual `useMemo` / `useCallback` / `React.memo` is rarely needed for render-perf and should be added only when profiling proves it. The `react-compiler/react-compiler` ESLint rule runs at `error` and guards Rules-of-React compliance. To opt a single component out, add `'use no memo'` as the first statement of the function body with a `// TODO(react-compiler): <reason>` comment.
- **A11y:** ARIA labels + semantic HTML + `:focus-visible` styles required. `vitest-axe` available for component tests.

## CAGED / 3NPS System

1. `packages/core/src/shapes/` finds note positions via `SHAPE_CONFIGS` and generates polygon vertices (fixed templates for pentatonic, dynamic for 7-note scales). `fullChordShapes.ts` + `voicings.ts` provide full-chord and close-voicing pickers.
2. Orchestrator merges adjacent boundaries with buffer.
3. `FretboardSVG.tsx` renders pixel SVG polygons; `useChordConnectorPolylines` draws the connector polylines linking voicing notes.

## Note Roles

Notes carry a semantic role (`root-active`, `chord-tone`, `note-blue`, `note-active`, `note-scale-only`, `chord-outside`, `note-inactive`). The **emphasis layer** in `src/components/FretboardSVG/utils/semantics.ts#getEmphasis` adds voice-leading cues (anticipation, hold, departing) when a progression is active, falling back to guide-tone emphasis when there's no progression. **Scale and chord rendering are independent domains** — do not cross-wire their visibility or color state. (Loading a progression preset is the one intentional exception: it sets the active *scale* — a one-time user action establishing harmonic context — but it does not couple the rendering/color domains.)

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

## Design Rationale (read on demand — do not preload)

Durable "why" docs live in `docs/design/` (index: `docs/design/README.md`). They are **not** preloaded — pull the relevant one only when making a decision in its domain, cite it, and add new sources back:

- markers / color / marker shape / connectors / voice-leading motion → `docs/design/fretboard-visual-language.md`
- voicing / strum / close-voicing fallback / audio playback → `docs/design/audio-voicing-engine.md`
- chord qualities / scales / guide tones / improvisation lenses / modes → `docs/design/music-theory-pedagogy.md`
- mobile/tablet sheet shell / panels & drawers / Settings & Help sheets / surfaces & dividers / header padding / scroll & overflow / zoom control → `docs/design/mobile-ui-contract.md` (run `/ui-review` to enforce)

Provenance: each doc lists the source specs it consolidates with the git SHA before deletion (`git show <sha>:<path>` recovers the original).
