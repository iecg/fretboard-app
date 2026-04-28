# FretFlow — Claude Code Guide

React 19 + TypeScript guitar fretboard tool. Deployed to GitHub Pages.

## Commands

```bash
npm run dev                   # start dev server
npm run build                 # production build (tsc -b && vite build)
npm run test                  # vitest run
npm run test:watch            # vitest watch
npm run test:coverage         # vitest with v8 coverage
npm run test:e2e              # playwright against dev server
npm run test:e2e:production   # build + playwright against vite preview
npm run test:visual           # build + visual regression suite
npm run test:visual:update    # refresh darwin visual snapshots
npm run lint                  # eslint + stylelint
npm run preview               # preview build locally
```

**MANDATORY:** Run `lint`, `test`, and `build` locally before PR.

## Development Workflow

- **Branching:** Trunk-based. `main` = trunk. PRs required.
- **Commits:** Conventional Commits with scope. `type(scope): message`.
- **Releases:** Triggered via GitHub Actions (Auto Release). Never tag manually.

## Architecture

### State & Logic

- **State:** Jotai atoms under `src/store/`, domain-split across `scaleAtoms`, `chordOverlayAtoms`, `practiceLensAtoms`, `fingeringAtoms`, `shapeAtoms`, `summaryAtoms`, `layoutAtoms`, `audioAtoms`, `uiAtoms`, `actions`. All re-exported through `src/store/atoms.ts` (a lean ~123-line barrel) so imports stay stable. Components subscribe directly to the atoms they consume (atomic reactivity — no prop drilling).
- **Domain (pure):** `src/core/` — `theory.ts`, `theoryCatalog.ts`, `guitar.ts`, `degrees.ts`, `circleOfFifthsUtils.ts`, `constants.ts`. Plus the `src/shapes/` package (`templates`, `helpers`, `polygons`, `threeNPS`, `analytics`).
- **Audio:** `GuitarSynth` singleton in `src/core/audio.ts` (Web Audio API).
- **Persistence:** `atomWithStorage` with keys prefixed via `src/utils/storage.ts`.

### Components & Layout

- **Orchestration:** `src/App.tsx` is a thin orchestrator (~158 lines) that wires atoms to `MainLayoutWrapper`.
- **Rendering:** `components/Fretboard/Fretboard.tsx` wraps `components/FretboardSVG/FretboardSVG.tsx` (the primary SVG renderer — large, direct atom subscriptions). `components/CircleOfFifths/` handles root/degree selection.
- **Layout:** `useLayoutMode` (in `src/hooks/`) measures viewport via `src/layout/responsive.ts` → returns `{ tier, variant, … }`. `MainLayoutWrapper` emits `data-layout-tier` (mobile/tablet/desktop) and `data-layout-variant` (mobile/landscape-mobile/tablet-split/tablet-stacked/desktop-split/desktop-stacked/desktop-3col) attributes. **Both gate responsive CSS — always consider both.**
- **Primitives:** `NoteGrid`, `ToggleBar`, `StepperControl`, `LabeledSelect`, `Card`.

## File Layout

```text
src/
├── App.tsx                   # thin orchestrator
├── main.tsx
├── core/                     # pure domain (theory, theoryCatalog, guitar, degrees, audio, ...)
├── store/                    # Jotai atom modules + actions.ts + atoms.ts barrel
├── hooks/                    # useLayoutMode, useFretboardState, useFocusTrap, ...
├── layout/                   # breakpoints + responsive layout resolver
├── shapes/                   # CAGED + 3NPS package
├── utils/                    # storage helpers, dom helpers
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
  - CSS Modules (`*.module.css`) for all component-scoped styles (26 modules).
  - Global foundations under `src/styles/` (`tokens.css`, `semantic.css`, `App.css`, `index.css`) — imported via `src/styles/index.css`.
  - Shared module CSS in `src/components/shared/shared.module.css`.
  - Use `clsx` for conditional classes, `cva` for variant class systems, `motion` (from `motion/react`) for animations.
  - Stylelint wired into `npm run lint` and `lint-staged`.
- **A11y:** ARIA labels + semantic HTML + `:focus-visible` styles required. `vitest-axe` available for component tests.

## CAGED / 3NPS System

1. `src/shapes/` finds note positions via `SHAPE_CONFIGS` and generates polygon vertices (fixed templates for pentatonic, dynamic for 7-note scales).
2. Orchestrator merges adjacent boundaries with buffer.
3. `FretboardSVG.tsx` renders pixel SVG polygons.

## Lens & Note Roles

Notes carry a semantic role (`root-active`, `chord-tone`, `note-blue`, `note-active`, `note-scale-only`, `chord-outside`, `note-inactive`). **Lenses** (registered in `src/store/practiceLensAtoms.ts` + `chordOverlayAtoms.ts`) compose emphasis rules (colors, squircles, tension cues) on top of that base model. **Scale and chord are independent domains** — do not cross-wire their visibility, lens, or color state.

## Testing

- **Vitest** + Testing Library for unit/component (jsdom). Coverage via `@vitest/coverage-v8`.
- **Playwright** for e2e + visual regression. Configs: default (dev server), production (serves `dist/`), production-base, visual.
- **Visual regression suites** under `e2e/`: `app-components`, `app-layout`, `app-mobile`, `app-overlays`, `fretboard-svg` — each with committed darwin + linux snapshots. Update via `npm run test:visual:update` (darwin) or `npm run test:visual:update:linux` (cross-platform).
- **a11y:** `vitest-axe` + `eslint-plugin-jsx-a11y`.

## CI / Release

- `ci.yml`: `changes` (paths-filter) → parallel `test` + `build` → `e2e` (downloads `dist`, production config) → `quality-gate` (skipped-aware PR comment). Docs-only PRs report `skipped` without breaking required checks.
- `deploy.yml`: GitHub Pages.
- `auto-release.yml`: manual trigger, semver from Conventional Commits.
- Dependabot weekly for npm + github-actions.
