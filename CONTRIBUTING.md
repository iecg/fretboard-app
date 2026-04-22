# Contributing to FretFlow

Thanks for your interest in contributing! FretFlow is an interactive guitar fretboard learning tool built with React 19, TypeScript, and Vite.

## Getting Started

```bash
git clone https://github.com/iecg/fretboard-app.git
cd fretboard-app
npm install
npm run dev        # Start dev server at http://localhost:5173
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check (tsc) + production build |
| `npm run lint` | ESLint across all .ts/.tsx files |
| `npm run test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |

## Finding Issues

- Look for issues labeled [`good first issue`](https://github.com/iecg/fretboard-app/labels/good%20first%20issue) — these are scoped, self-contained tasks with clear instructions.
- Check the [Chord Progressions milestone](https://github.com/iecg/fretboard-app/milestone/1) for larger feature work.
- Comment on an issue to claim it before starting work.

## Making Changes

1. **Fork the repo** and create a branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b your-branch-name
   ```

2. **Make your changes.** Follow the conventions below.

3. **Run checks before committing:**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

4. **Commit** using [conventional commits](https://www.conventionalcommits.org/):
   ```
   feat(scope): add new feature
   fix(scope): fix a bug
   style(scope): CSS/styling changes
   refactor(scope): code restructuring
   test(scope): add or update tests
   docs(scope): documentation changes
   ```

5. **Open a PR** against `main`.

## Architecture Overview

Single-page React app. All UI state lives in Jotai atoms (`src/store/atoms.ts`). No routing, no server.

| Module | Role |
|--------|------|
| `store/atoms.ts` | All app state as Jotai atoms with localStorage persistence |
| `theory.ts` | Music theory constants and pure functions |
| `guitar.ts` | Guitar-specific logic — tunings, fretboard layout, note/frequency math |
| `shapes.ts` | CAGED and 3NPS fingering pattern computation |
| `audio.ts` | Web Audio API synth singleton |
| `Fretboard.tsx` | Pure rendering — receives data as props, handles drag/zoom/click |
| `CircleOfFifths.tsx` | SVG ring for root note selection |
| `DrawerSelector.tsx` | Dropdown component with upward-flip detection |
| `App.tsx` | Layout, controls panel, derived computations via `useMemo` |
| `App.css` | Layout styles with responsive breakpoints |
| `index.css` | CSS variables and design tokens |

## Code Conventions

- **Notes stored as sharps internally:** `['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']`. Flat display resolved at render time.
- **Tuning arrays:** highest string first (index 0 = high E).
- **Fretboard coordinates:** `"stringIndex-fretIndex"` string keys.
- **State:** Jotai `atomWithStorage` for persistent state, plain `atom` for derived/write-only. No `useState` for user preferences.
- **CSS:** Variables in `index.css` under `:root`. BEM-like class naming. Use `clsx` for conditional classes.
- **Icons:** `lucide-react` (tree-shakeable).
- **No CSS-in-JS** — plain CSS with variables.

## Adding Things

| What | How |
|------|-----|
| New scale | Add to `SCALES` in `theory.ts` with interval array. CAGED/3NPS work automatically. |
| New chord | Add to `CHORDS` in `theory.ts`. |
| New tuning | Add to `TUNINGS` in `guitar.ts`. |
| New state | Add `atomWithStorage` in `store/atoms.ts`. Add to `resetAtom` if it should reset. |
| New CSS token | Add variable in `index.css` under `:root`. |

## Responsive Layout

The app sets two data attributes on `.app-container` to drive layout:

**`data-layout-tier`** — coarse breakpoint bucket:

| Tier | Width |
|------|-------|
| `mobile` | ≤ 767px |
| `tablet` | 768–1365px |
| `desktop` | ≥ 1366px |

**`data-layout-variant`** — concrete layout variant (finer-grained):

| Variant | Tier | Condition |
|---------|------|-----------|
| `mobile` | mobile | portrait |
| `landscape-mobile` | mobile | landscape |
| `tablet-split` | tablet | normal height |
| `tablet-stacked` | tablet | compact height |
| `desktop-split` | desktop | compact height or narrow |
| `desktop-stacked` | desktop | compact height |
| `desktop-3col` | desktop | full height + wide |

CSS overrides use `[data-layout-tier="..."]` and `[data-layout-variant="..."]` selectors in `App.css` and component CSS files.

## Tests

- **Unit tests:** Pure computation modules (`theory.ts`, `guitar.ts`, `shapes.ts`) in `src/core/` and `src/shapes/`. Run with `npm test`.
- **Component tests:** Vitest + React Testing Library + Snapshots in `src/components/`. Run with `npm test`.
- **Visual tests:** Playwright visual regression tests in `e2e/`. Run with `npm run test:visual`.

All tests must pass before submitting a PR.

## Visual Regression Testing

We use Playwright for visual regression testing to ensure UI consistency across different devices and layout modes.

### Running Visual Tests

To run the visual tests locally:

```bash
npm run test:visual
```

This builds the app and compares current screenshots against the baselines stored in `e2e/**/*.visual.spec.ts-snapshots/`.

To run tests without rebuilding (e.g., in CI or if you've already run a build):

```bash
npm run test:visual:ci
```

### Updating Baselines

If you've intentionally changed the UI and need to update the baseline screenshots:

```bash
npm run test:visual:update
```

### Reviewing Diffs

When a visual test fails, Playwright generates a diff image highlighting the differences. You can review these in the `test-results/` directory. Each failure will have a sub-folder containing the expected image, the actual image, and the `diff.png`.

If you want a visual report, run:

```bash
npx playwright show-report
```

### OS and Environment Baselines

**Important:** Snapshot baselines are platform-specific due to differences in font rendering and anti-aliasing.

- **macOS Baselines:** Useful for local review and development on macOS.
- **Linux Baselines:** These are the **source of truth** used by CI.

If CI fails due to visual diffs, you **must** regenerate the Linux baselines from a Linux/Ubuntu environment (e.g., via Docker or a Linux machine), not from macOS. Snapshots generated on macOS will not match the Linux snapshots exactly.

#### Regenerating Linux Baselines

The project provides a helper script to safely regenerate Linux baselines from a macOS host using Docker:

```bash
./scripts/update-linux-snapshots.sh
```

This script uses a Playwright Docker container to run the update. It utilizes an isolated `node_modules` volume within the container so that your local macOS `node_modules` are not overwritten or corrupted by Linux-specific dependencies during the process.


## License

By contributing, you agree that your contributions will be licensed under the [GNU AGPL v3.0](LICENSE).
