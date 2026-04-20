# FretFlow — Claude Code Guide

FretFlow = React 19 + TypeScript interactive guitar fretboard + music theory tool. Built with Vite, deployed GitHub Pages at `https://iecg.github.io/fretboard-app/`.

> Project context for **Claude Code**. Machine-local overrides → `CLAUDE.local.md` (git-ignored).

## Commands

```bash
npm run dev            # start dev server
npm run build          # tsc + vite build
npm run build:types    # tsc only (no bundle)
npm run test           # run tests once (vitest)
npm run test:watch     # run tests in watch mode
npm run test:coverage  # vitest with v8 coverage
npm run test:e2e       # playwright e2e
npm run lint           # eslint
npm run preview        # preview production build locally
```

Run `npm run lint` + `npm run test` before committing as a quick pre-commit check.

**MANDATORY: run `npm run lint`, `npm run test`, `npm run build` locally before PR.** All three pass. No CI-only reliance — catch failures pre-push.

## Branching rules

Trunk-based dev. `main` = single integration branch.

| Branch | Role |
|---|---|
| `main` | Trunk. All work lands here. Deploy on every push. |
| `feature/*` | Short-lived. Individual features/fixes. |

**Rules:**
- **Never push directly to `main`** — PR required
- Feature branches cut from `main`, merged back via PR
- CI runs lint + test + build on every push to `main` + every PR
- Auto-release tags after every merge to `main`

**Typical workflow:**
```bash
git switch main && git pull          # always sync before branching
git switch -c feature/my-thing
# ... work ...
git push -u origin feature/my-thing
# open PR → main
```

> **Always pull latest `main` before new branch.** No auto-enforcement — your responsibility. Stale `main` → needless merge conflicts.

## Commit conventions

Conventional commits. Prefix every message:

| Prefix | When to use |
|---|---|
| `feat:` | new feature / user-visible improvement |
| `fix:` | bug fix |
| `chore:` | deps, config, tooling, CI — no prod code change |
| `refactor:` | code change, no behaviour change |
| `docs:` | docs only |
| `test:` | add/fix tests |
| `style:` | formatting, whitespace — no logic change |
| `perf:` | perf improvement |
| `ci:` | CI/CD pipeline changes |
| `build:` | build system/tooling changes |
| `revert:` | reverts previous commit |

Examples:
```
feat(theory): add transpose shortcut to circle of fifths
fix(fretboard): correct enharmonic display for Cb scale
chore(deps): bump vite to 8.1
refactor(theory): simplify interval lookup
```

Enforced by `commit-msg` husky hook:
- Subject ≤ 72 chars
- No trailing period
- Match `type(scope): description` — **scope is expected** (hook allows omission but workflow convention requires it)

GitHub Release notes auto-grouped by prefix.

## PR title convention

PR titles follow Conventional Commits — GitHub squash-merge uses PR title as commit message on `main`.

```
feat(fretboard): add capo support
fix(fretboard): off-by-one on fret 0 highlight
chore(deps): upgrade eslint to v9
```

Same type prefixes + 72-char limit apply. Scope expected.

## Releasing — manual trigger

Releases triggered manually via GitHub Actions → Auto Release → Run workflow.

### Pipeline

```
You click "Run workflow" on GitHub Actions
       │
       ▼
auto-release.yml  — analyzes commits → computes semver → pushes annotated tag
       │
       ├──▶ deploy.yml  — triggers on tag push → lint → test → build → GitHub Pages
       └──▶ creates PR  — bumps package.json version → auto-merge after CI
```

### Semver bump rules (from conventional commits)

| Commit type | Bump |
|---|---|
| `feat!:` / `BREAKING CHANGE:` | major |
| `feat:` | minor |
| `fix:`, `chore:`, `refactor:`, `ci:`, `test:`, `docs:`, `style:` | patch |

### Version badge

`vite.config.ts` reads `package.json` for `__APP_VERSION__`. Deploy workflow injects tag version at build via `git describe --tags`. Auto-release workflow also opens PR to bump `package.json` so local dev shows correct version.

### Rules

- **Never tag manually** — use Auto Release workflow
- **Never bump `major` without explicit human approval** — coordinate before merging breaking changes

## Architecture

### Layered model

```
View: App.tsx (thin orchestrator) → MainLayoutWrapper → panels + Fretboard
      Fretboard.tsx → FretboardSVG.tsx (direct atom subscriptions)
Hooks: useLayoutMode, useFretboardState, useShapeState, useScaleState,
       useChordState, usePracticeBarState, useFocusTrap
State: src/store/*Atoms.ts (domain-split) → re-exported via store/atoms.ts
Domain: theory, theoryCatalog, guitar, degrees, circleOfFifthsUtils, shapes/
Effects: audio.ts (GuitarSynth singleton)
```

### Key files

**Entry / orchestration**
| File | Purpose |
|---|---|
| `src/App.tsx` | Thin orchestrator (~158 lines); wires atoms + `useLayoutMode` into `MainLayoutWrapper` |
| `src/components/MainLayoutWrapper.tsx` | Routes panel tree per `data-layout-tier` / `data-layout-variant` |
| `src/hooks/useLayoutMode.ts` | Measures viewport → returns `{ tier, variant }`; emits `--string-row-px` |
| `src/App.css`, `src/index.css`, `src/tokens.css`, `src/semantic.css` | Layout styles + design tokens |

**Fretboard rendering**
| File | Purpose |
|---|---|
| `src/Fretboard.tsx` | Wrapper (~281 lines) — composition + scroll centering |
| `src/FretboardSVG.tsx` | Primary SVG renderer (~1359 lines, **hotspot**) — drag/zoom/click, direct atom subscriptions, lens emphasis, squircles, additive overlays, tension cues |
| `src/FretboardSVG.css` | Renderer styles |
| `src/CircleOfFifths.tsx` / `.module.css` | CoF SVG — root selection, chord degrees |
| `src/circleOfFifthsUtils.ts` | CoF pure helpers |

**Shapes package**
| File | Purpose |
|---|---|
| `src/shapes/index.ts` | Public surface |
| `src/shapes/helpers.ts` | Find note positions per shape; `MAJOR_TO_MINOR_SHAPE` remap |
| `src/shapes/templates.ts` | Fixed per-string offsets for pentatonic/blues CAGED |
| `src/shapes/polygons.ts` | Build polygon vertices (fixed for pentatonic, dynamic for 7-note) |
| `src/shapes/threeNPS.ts` | 3-notes-per-string patterns |
| `src/shapes/analytics.ts` | Shape metrics (main shape, center fret) |

**State (Jotai, domain-split)**
| File | Purpose |
|---|---|
| `src/store/atoms.ts` | Aggregator + legacy re-exports (~547) |
| `src/store/scaleAtoms.ts` | Scale domain (~307) |
| `src/store/chordOverlayAtoms.ts` | Chord overlay facts + lens registry (~299) |
| `src/store/practiceLensAtoms.ts` | Lens registry + emphasis model (~347) |
| `src/store/fingeringAtoms.ts` | CAGED / 3NPS selection |
| `src/store/layoutAtoms.ts`, `audioAtoms.ts`, `uiAtoms.ts` | Layout / audio / UI atoms |
| `src/utils/storage.ts` | Prefixed `localStorage` helpers (`STORAGE_PREFIX`) |

**Domain / effects**
| File | Purpose |
|---|---|
| `src/theory.ts` | NOTES, SCALES, CHORDS, ENHARMONICS, keys (~620) |
| `src/theoryCatalog.ts` | Chord-row entries, legend items, role-aware catalog (~576) |
| `src/guitar.ts` | Tunings, fretboard layout, note/frequency math |
| `src/degrees.ts` | Interval / degree display helpers |
| `src/constants.ts` | Shared numeric constants |
| `src/audio.ts` | `GuitarSynth` singleton (Web Audio) |

**Layout tunables**
| File | Purpose |
|---|---|
| `src/layout/breakpoints.ts` | Tier / variant breakpoints |
| `src/layout/responsive.ts` | Playwright-measured layout tunables (string-row px clamps, min heights, chrome) |

**Controls / panels**
| File | Purpose |
|---|---|
| `src/components/AppHeader.tsx`, `BrandMark.tsx`, `FretFlowWordmark.tsx`, `VersionBadge.tsx` | Chrome |
| `src/components/ExpandedControlsPanel.tsx` (lazy) | Desktop two-column controls |
| `src/components/MobileTabPanel.tsx` (lazy) + `BottomTabBar.tsx` | Mobile tabs + content |
| `src/components/SettingsOverlay.tsx` (lazy, ~577) | Full-screen animated settings overlay (`motion/react`) |
| `src/components/HelpModal.tsx` (lazy, ~230) | Help modal |
| `src/components/SummaryRibbon.tsx` + `ScaleStripPanel.tsx` + `ChordOverlayDock.tsx` + `ChordOverlayControls.tsx` | Summary / overlay surfaces (split from the old single ribbon) |
| `src/components/ChordPracticeBar.tsx`, `ChordRowStrip.tsx`, `DegreeChipStrip.tsx` | Chord practice surfaces |
| `src/components/FingeringPatternControls.tsx` | CAGED / 3NPS / All selector |
| `src/components/TheoryControls.tsx`, `ScaleSelector.tsx`, `KeyExplorer.tsx` | Scale + chord controls |
| `src/components/FretRangeControl.tsx`, `StepperControl.tsx`, `NoteGrid.tsx`, `ToggleBar.tsx`, `LabeledSelect.tsx`, `Card.tsx` | Reusable primitives |
| `src/DrawerSelector.tsx` / `.module.css` | Reusable dropdown with upward-flip detection |
| `src/components/ErrorBoundary.tsx` | Error boundary |

### CAGED / 3NPS Shape System

Three-stage pipeline:

1. **`src/shapes/` package** — `getCagedCoordinates()` finds note positions per shape via `SHAPE_CONFIGS`; `polygons.ts` generates vertices (fixed templates from `templates.ts` for pentatonic/blues; dynamic boundaries for 7-note scales). Major-quality scales remapped via relative minor (`MAJOR_TO_MINOR_SHAPE`) — e.g. C Major Pentatonic "G shape" uses the same pattern as A Minor Pentatonic "E shape".

2. **Orchestration layer** — Merges adjacent polygon boundaries at midpoints where shapes meet. Adds a small overlap buffer (~0.3 frets) to kill SVG anti-aliasing gaps.

3. **`FretboardSVG.tsx`** — Converts polygon vertices (fret/string coords) → pixel SVG polygons. Each polygon has left-edge vertices (top→bottom) + right-edge vertices (bottom→top); vertical caps extend to top/bottom of fretboard.

### Lens + Semantic Note Model

Every rendered fret cell has a **semantic role** (see Note classification below). **Lenses** (registered in `practiceLensAtoms.ts` + `chordOverlayAtoms.ts`) compose emphasis rules on top of that role — colors, squircles, tension cues, additive overlays. **Scale and chord are independent domains**: each owns its own visibility toggle, color lens, and emphasis. Never cross-wire their state.

### Circle of Fifths Degrees

Scale degrees on circle use chromatic interval conversion: `(circleIntervalIndex * 7) % 12` converts circle-of-fifths position → chromatic semitones, then looks up degree from chromatic-interval-based maps (`MAJOR_CHROMATIC_DEGREES` / `MINOR_CHROMATIC_DEGREES`). Notes not in scale → no degree label.

## Key Conventions

**Notes stored as sharps internally.** Chromatic scale = `NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']` in `theory.ts`. Flat display resolved at render time via `getNoteDisplay(note, rootNote)`, checks `FLAT_KEYS` to decide e.g. `Bb` vs `A#`.

**Tuning arrays ordered highest string first** (index 0 = thinnest/highest, index 5 = thickest). Standard tuning: `['E4','B3','G3','D3','A2','E2']`.

**Fretboard cell coordinates** use `"stringIndex-fretIndex"` string keys (e.g. `"2-7"`) throughout props + maps.

**Fretboard rendering coordinates:**
- `stringRowPx` — adaptive height per string row, derived in `useLayoutMode`; clamped via `STRING_ROW_PX_*` constants; emitted as `--string-row-px` CSS property.
- `fretToX(fret)` — maps fret number → pixel X (uniform width, including fret 0).
- `stringCenterY(s)` — vertical center of string `s` (`stringRowPx / 2 + s * stringRowPx`).

**State (Jotai):** all atoms flow through `src/store/atoms.ts` for import stability; implementations live in domain modules (`scaleAtoms`, `chordOverlayAtoms`, `practiceLensAtoms`, `fingeringAtoms`, `layoutAtoms`, `audioAtoms`, `uiAtoms`). Persistent atoms use `atomWithStorage` with keys prefixed via `STORAGE_PREFIX` from `utils/storage.ts`. Components subscribe to atoms directly (**atomic reactivity**, #223) — avoid prop-drilling large state objects.

**Note classification** in `FretboardSVG.tsx` (priority order) — base semantic role, then lens emphasis:
- `root-active` — root note highlighted
- `note-blue` — blue note (blues scale)
- `chord-tone` — in scale + in chord
- `note-active` — in scale, no chord overlay
- `note-scale-only` — in scale, chord overlay active (hideable via `hideNonChordNotes`)
- `chord-outside` — in chord, not in scale
- `note-inactive` — neither

**CSS variables** defined in `tokens.css` under `:root` (imported via `index.css`). CAGED shape colors use `--caged-e/d/c/a/g` + `--caged-*-bg` tokens. Responsive layout via `[data-layout-tier="..."]` (coarse: `mobile` | `tablet` | `desktop`) and `[data-layout-variant="..."]` (fine: `mobile` | `landscape-mobile` | `tablet-split` | `tablet-stacked` | `desktop-split` | `desktop-stacked` | `desktop-3col`) selectors.

**`clsx`** — all conditional class composition. **`cva`** (class-variance-authority) — variant-based component class systems.

**`motion`** (`motion` package, formerly `framer-motion`) — use for any new animations, not CSS transitions alone. Import from `motion/react`.

**`DrawerSelector`** = accordion dropdown in `src/DrawerSelector.tsx`. Use for any new selector controls → maintains visual consistency.

**CSS Modules** (`*.module.css`) are the direction for component-scoped styles (e.g. `components/shared.module.css`, `DrawerSelector.module.css`, `CircleOfFifths.module.css`). Design tokens + semantic utilities remain global.

**A11y:** `eslint-plugin-jsx-a11y` + `vitest-axe` are in place. `:focus-visible` glow styles available; keyboard navigation supported on `NoteGrid` and others.

## Worktree Setup

When working in a new git worktree that lacks a `.vbw-planning` directory, check the parent repo (`git worktree list` to find the main working tree) for an existing `.vbw-planning`. If found, create a symlink from the worktree to the parent:

```bash
MAIN_TREE=$(git worktree list --porcelain | grep -m1 '^worktree ' | sed 's/^worktree //')
if [ ! -e .vbw-planning ] && [ -d "$MAIN_TREE/.vbw-planning" ]; then
  ln -s "$MAIN_TREE/.vbw-planning" .vbw-planning
fi
```

This ensures all worktrees share a single source of truth for VBW planning state.

## Copyright

© Isaac Cocar. Licensed under AGPLv3.
