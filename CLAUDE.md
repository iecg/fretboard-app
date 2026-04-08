# FretFlow — Claude Code Guide

## Project overview

FretFlow is a React + TypeScript interactive guitar fretboard and music theory tool, built with Vite and deployed to GitHub Pages.

## Commands

```bash
npm run dev          # start dev server
npm run build        # tsc + vite build
npm run test         # run tests once (vitest)
npm run test:watch   # run tests in watch mode
npm run lint         # eslint
npm run preview      # preview production build locally
```

## Branching & CI

- `main` is the stable branch — **do not push directly to main**
- All work goes on feature branches; open a PR to merge
- CI (`ci.yml`) runs lint + test + build on every push to main and every PR

## Releasing — how to bump the version

The version in `package.json` is the **single source of truth**. Vite bakes it into the bundle at build time via `__APP_VERSION__`.

```bash
# Choose one:
npm version patch   # bug fix:      1.0.0 → 1.0.1
npm version minor   # new feature:  1.0.0 → 1.1.0
npm version major   # breaking:     1.0.0 → 2.0.0

git push && git push --tags
```

`npm version` automatically updates `package.json`, commits it, and creates the git tag. Pushing the tag triggers:
1. **`deploy.yml`** — builds and deploys to GitHub Pages (tags only, not every main push)
2. **`release.yml`** — runs lint + test + build, then creates a GitHub Release with auto-generated notes

**Never** bump the version manually by editing `package.json` — always use `npm version` so the git tag is created consistently.

**Never** push a version bump directly to `main` — create a branch, get it merged, then tag from main.

## Architecture

- `src/App.tsx` — main application component and state (~1000 lines)
- `src/Fretboard.tsx` — fretboard SVG visualization
- `src/CircleOfFifths.tsx` — circle of fifths widget
- `src/DrawerSelector.tsx` — reusable dropdown selector
- `src/theory.ts` — music theory (scales, chords, intervals)
- `src/guitar.ts` — tuning presets
- `src/shapes.ts` — CAGED and 3NPS shape data
- `src/audio.ts` — Web Audio API synth
- `src/degrees.ts` — scale degree colors

## Copyright

© Isaac Cocar. All rights reserved.
