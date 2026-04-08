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

- **Never push directly to `main`**
- All work goes on feature branches; open a PR to merge into main
- CI (`ci.yml`) runs lint + test + build on every push to main and every PR targeting main

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
- Never tag a release from a feature branch — merge to main first, then tag from main

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

## Copyright

© Isaac Cocar. All rights reserved.
