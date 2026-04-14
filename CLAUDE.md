# FretFlow — Claude Code Guide

FretFlow = React 19 + TypeScript interactive guitar fretboard + music theory tool. Built with Vite, deployed GitHub Pages at `https://iecg.github.io/fretboard-app/`.

> Project context for **Claude Code**. Machine-local overrides → `CLAUDE.local.md` (git-ignored).

## Commands

```bash
npm run dev          # start dev server
npm run build        # tsc + vite build
npm run test         # run tests once (vitest)
npm run test:watch   # run tests in watch mode
npm run lint         # eslint
npm run preview      # preview production build locally
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
feat: add transpose shortcut to circle of fifths
fix: correct enharmonic display for Cb scale
chore: bump vite to 8.1
refactor(theory): simplify interval lookup
```

Enforced by `commit-msg` husky hook:
- Subject ≤ 72 chars
- No trailing period
- Match `type(optional-scope): description`

GitHub Release notes auto-grouped by prefix.

## PR title convention

PR titles follow Conventional Commits — GitHub squash-merge uses PR title as commit message on `main`.

```
feat: add capo support
fix(fretboard): off-by-one on fret 0 highlight
chore: upgrade eslint to v9
```

Same type prefixes + 72-char limit apply.

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

| File | Purpose |
|---|---|
| `src/App.tsx` | Main component + state (~686 lines) |
| `src/Fretboard.tsx` | Fretboard SVG viz |
| `src/CircleOfFifths.tsx` | Circle of Fifths widget |
| `src/DrawerSelector.tsx` | Reusable dropdown selector |
| `src/theory.ts` | Music theory (scales, chords, intervals) |
| `src/guitar.ts` | Tuning presets |
| `src/shapes.ts` | CAGED + 3NPS shape data |
| `src/audio.ts` | Web Audio API synth |
| `src/degrees.ts` | Scale degree colors |

### CAGED Shape System

Shape computation → three layers:

1. **`shapes.ts`** — `getCagedCoordinates()` finds note positions per shape via `SHAPE_CONFIGS` (fret ranges), generates polygon vertices via `SHAPE_TEMPLATES_PENT` (fixed per-string left/right offsets from anchor fret). Major-quality scales → shapes remapped via relative minor (`MAJOR_TO_MINOR_SHAPE`) — e.g., C Major Pentatonic "G shape" uses same pattern as A Minor Pentatonic "E shape".

2. **`App.tsx`** — Merges adjacent polygon boundaries at midpoints where shapes meet. Adds small overlap buffer (0.3 frets) to kill SVG anti-aliasing gaps.

3. **`Fretboard.tsx`** — Converts polygon vertices (fret/string coords) → pixel SVG polygons. Each shape polygon has left-edge vertices (top→bottom) + right-edge vertices (bottom→top), vertical caps extend to top/bottom of fretboard.

### Circle of Fifths Degrees

Scale degrees on circle use chromatic interval conversion: `(circleIntervalIndex * 7) % 12` converts circle-of-fifths position → chromatic semitones, then looks up degree from chromatic-interval-based maps (`MAJOR_CHROMATIC_DEGREES` / `MINOR_CHROMATIC_DEGREES`). Notes not in scale → no degree label.

## Key Conventions

**Notes stored as sharps internally.** Chromatic scale = `NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']` in `theory.ts`. Flat display resolved at render time via `getNoteDisplay(note, rootNote)`, checks `FLAT_KEYS` to decide e.g. `Bb` vs `A#`.

**Tuning arrays ordered highest string first** (index 0 = thinnest/highest, index 5 = thickest). Standard tuning: `['E4','B3','G3','D3','A2','E2']`.

**Fretboard cell coordinates** use `"stringIndex-fretIndex"` string keys (e.g. `"2-7"`) throughout props + maps.

**Fretboard rendering coordinates:**
- `STRING_ROW_PX = 40` — height per string row
- `fretToX(fret)` — maps fret number → pixel X (uniform width, including fret 0)
- `stringCenterY(s)` — vertical center of string `s` (`STRING_ROW_PX / 2 + s * STRING_ROW_PX`)

**Note classification** in `Fretboard.tsx`:
- `root-active` — root note highlighted or chord tone
- `chord-tone` — in scale + in chord
- `note-active` — in scale, no chord overlay
- `note-scale-only` — in scale, chord overlay active (hideable via `hideNonChordNotes`)
- `chord-outside` — in chord, not in scale
- `note-inactive` — neither

**CSS variables** defined in `index.css` under `:root`. CAGED shape colors use `--caged-e/d/c/a/g` + `--caged-*-bg` tokens.

**`clsx`** — all conditional class composition.

**`framer-motion`** — use for any new animations, not CSS transitions alone.

**`DrawerSelector`** = inline accordion dropdown defined at top of `App.tsx`. Use for any new selector controls → maintains visual consistency.

## Copyright

© Isaac Cocar. Licensed under AGPLv3.
