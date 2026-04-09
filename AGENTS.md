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

## Branching rules

This repo uses a **main/develop** integration strategy.

| Branch | Role |
|---|---|
| `main` | Stable, production-ready code. Deployed via tags only. |
| `develop` | Integration branch. All feature work lands here first. |
| `feature/*` | Short-lived branches for individual features or fixes. |
| `hotfix/*` | Emergency fixes cut from `main`, merged back to `main` then `develop`. |

**Rules:**
- **Never push directly to `main` or `develop`** — both require a PR
- Feature branches are cut from `develop` and merged back into `develop` via PR
- `develop` merges into `main` via PR when ready to release
- `hotfix/*` branches are cut from `main`, merged to `main` via PR, then back-merged to `develop`
- Releases are tagged from `main` only (see Releasing section)
- CI (`ci.yml`) runs lint + test + build on every push to `main` and `develop`, and on every PR targeting either branch

**Typical workflow:**
```bash
git switch develop && git pull
git switch -c feature/my-thing
# ... work ...
git push -u origin feature/my-thing
# open PR → develop
# when ready to release, open PR develop → main
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

## Releasing — fully automated

Releases are **fully automated**. Every merge to `main` triggers the pipeline below — no manual version bumps or tagging required.

### Pipeline

```
PR merges to main
       │
       ▼
auto-release.yml  — analyzes commits → computes semver → pushes tag
       │
       ├──▶ release.yml  — lint → test → build → GitHub Release + changelog
       └──▶ deploy.yml   — lint → test → build → GitHub Pages
```

### Semver bump rules (from conventional commits)

| Commit type | Bump |
|---|---|
| `feat!:` / `BREAKING CHANGE:` | major |
| `feat:` | minor |
| `fix:`, `chore:`, `refactor:`, `ci:`, `test:`, `docs:`, `style:` | patch |

### Starting point

`v1.0.0` is already tagged. Every merge to `main` computes the bump from conventional commits since the last tag.

### Version badge

`vite.config.ts` reads `package.json` for `__APP_VERSION__`. The deploy and release workflows inject the tag version at build time with:

```bash
npm version <tag-without-v> --no-git-tag-version
```

This updates `package.json` only in the ephemeral runner — no commit is made. The version badge in the app will always reflect the deployed tag.

### Rules

- **Never tag manually** — let `auto-release.yml` handle it
- **Never bump `major` without explicit human approval** — if a breaking change PR is merged, major bump happens automatically; coordinate in advance
- Tags are only created from `main`; never from `develop` or feature branches

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
