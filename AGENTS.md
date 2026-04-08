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

## Releasing — how to bump the version

`package.json` `"version"` is the **single source of truth**. Vite bakes it into the bundle at build time as `__APP_VERSION__`. A semi-transparent version badge is displayed at the bottom-right of the app.

**Always use `npm version`, never edit `package.json` by hand:**

```bash
npm version patch   # bug fix:      1.0.0 → 1.0.1
npm version minor   # new feature:  1.0.0 → 1.1.0
npm version major   # breaking:     1.0.0 → 2.0.0

git push && git push --tags
```

`npm version` updates `package.json`, creates a commit, and creates a git tag. Pushing the tag triggers:

1. **`deploy.yml`** → builds and deploys to GitHub Pages (**tags only** — main pushes do not deploy)
2. **`release.yml`** → runs lint + test + build, then creates a GitHub Release with auto-generated notes

**Rules:**
- Never bump `major` without explicit human approval
- Never tag a release from a feature branch or from `develop` — merge to `main` first, then tag from `main`

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
