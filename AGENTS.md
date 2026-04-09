# FretFlow — Agent Guide

FretFlow is a React 19 + TypeScript interactive guitar fretboard and music theory tool, built with Vite and deployed to GitHub Pages at `https://iecg.github.io/fretboard-app/`.

## Commands

```bash
npm run dev          # start dev server
npm run build        # tsc + vite build
npm run test         # run tests once (vitest)
npm run test:watch   # run tests in watch mode
npm run lint         # eslint
npm run preview      # preview production build locally
```

Always run `npm run lint` and `npm run test` before committing.

**MANDATORY: Run `npm run lint`, `npm run test`, and `npm run build` locally before creating a PR.** All three must pass. Do not rely on CI alone — catch failures before pushing.

## Branching rules

This repo uses **trunk-based development** with `main` as the single integration branch.

| Branch | Role |
|---|---|
| `main` | Trunk — all work lands here. Deployed on every push. |
| `feature/*` | Short-lived branches for individual features or fixes. |

**Rules:**
- **Never push directly to `main`** — requires a PR
- Feature branches are cut from `main` and merged back into `main` via PR
- CI runs lint + test + build on every push to `main` and on every PR
- Auto-release creates a tag after every merge to `main`

**Typical workflow:**
```bash
git switch main && git pull
git switch -c feature/my-thing
# ... work ...
git push -u origin feature/my-thing
# open PR → main
```

## Commit conventions

Use conventional commits — prefix every commit message:

| Prefix | When to use |
|---|---|
| `feat:` | new feature or user-visible improvement |
| `fix:` | bug fix |
| `chore:` | deps, config, tooling, CI — no production code change |
| `refactor:` | code change with no behaviour change |
| `docs:` | documentation only |
| `test:` | adding or fixing tests |

Examples:
```
feat: add transpose shortcut to circle of fifths
fix: correct enharmonic display for Cb scale
chore: bump vite to 8.1
```

Keep the subject line under 72 characters. No period at the end.
GitHub Release notes are auto-grouped by these prefixes.

## Releasing — manual trigger

Releases are triggered manually via GitHub Actions → Auto Release → Run workflow.

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

`vite.config.ts` reads `package.json` for `__APP_VERSION__`. The deploy workflow injects the tag version at build time with `git describe --tags`. The auto-release workflow also opens a PR to bump `package.json` so local dev shows the correct version.

### Rules

- **Never tag manually** — use the Auto Release workflow
- **Never bump `major` without explicit human approval** — coordinate before merging breaking changes

## Architecture

| File | Purpose |
|---|---|
| `src/App.tsx` | Main component and state (~1000 lines) |
| `src/Fretboard.tsx` | Fretboard SVG visualization |
| `src/CircleOfFifths.tsx` | Circle of Fifths widget |
| `src/DrawerSelector.tsx` | Reusable dropdown selector |
| `src/theory.ts` | Music theory (scales, chords, intervals) |
| `src/guitar.ts` | Tuning presets |
| `src/shapes.ts` | CAGED and 3NPS shape data |
| `src/audio.ts` | Web Audio API synth |
| `src/degrees.ts` | Scale degree colors |

### CAGED Shape System

Shape computation flows through three layers:

1. **`shapes.ts`** — `getCagedCoordinates()` finds note positions per shape using `SHAPE_CONFIGS` (fret ranges) and generates polygon vertices using `SHAPE_TEMPLATES_PENT` (fixed per-string left/right offsets from anchor fret). For major-quality scales, shapes are remapped via relative minor (`MAJOR_TO_MINOR_SHAPE`) — e.g., C Major Pentatonic "G shape" uses the same pattern as A Minor Pentatonic "E shape".

2. **`App.tsx`** — Merges adjacent polygon boundaries at midpoints where shapes meet, then adds a small overlap buffer (0.3 frets) to eliminate SVG anti-aliasing gaps.

3. **`Fretboard.tsx`** — Converts polygon vertices (fret/string coordinates) to pixel SVG polygons. Each shape polygon has left-edge vertices (top→bottom) and right-edge vertices (bottom→top), with vertical caps extending to the top and bottom of the fretboard.

### Circle of Fifths Degrees

Scale degrees on the circle use chromatic interval conversion: `(circleIntervalIndex * 7) % 12` converts circle-of-fifths position to chromatic semitones, then looks up the degree from chromatic-interval-based maps (`MAJOR_CHROMATIC_DEGREES` / `MINOR_CHROMATIC_DEGREES`). Notes not in the scale get no degree label.

## Key Conventions

**Notes are always stored as sharps internally.** The chromatic scale is `NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']` in `theory.ts`. Flat display is resolved at render time only via `getNoteDisplay(note, rootNote)`, which checks `FLAT_KEYS` to decide whether to show e.g. `Bb` vs `A#`.

**Tuning arrays are ordered highest string first** (index 0 = thinnest/highest string, index 5 = thickest). Standard tuning: `['E4','B3','G3','D3','A2','E2']`.

**Fretboard cell coordinates** use `"stringIndex-fretIndex"` string keys (e.g. `"2-7"`) throughout props and maps.

**Fretboard rendering coordinates:**
- `STRING_ROW_PX = 40` — height per string row
- `fretToX(fret)` — maps fret number to pixel X (uniform width, including fret 0)
- `stringCenterY(s)` — vertical center of string `s` (`STRING_ROW_PX / 2 + s * STRING_ROW_PX`)

**Note classification** in `Fretboard.tsx`:
- `root-active` — root note that is highlighted or a chord tone
- `chord-tone` — in scale + in chord
- `note-active` — in scale, no chord overlay
- `note-scale-only` — in scale, chord overlay active (can be hidden by `hideNonChordNotes`)
- `chord-outside` — in chord but not in scale
- `note-inactive` — neither

**CSS variables** are defined in `index.css` under `:root`. CAGED shape colors use `--caged-e/d/c/a/g` and `--caged-*-bg` tokens.

**`clsx`** is used for all conditional class composition.

**`framer-motion`** — use for any new animations rather than CSS transitions alone.

**`DrawerSelector`** is an inline accordion dropdown defined at the top of `App.tsx`. Use it for any new selector controls to maintain visual consistency.

## Copyright

© Isaac Cocar. All rights reserved.
