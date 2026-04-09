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

The app uses `layoutMode` derived from viewport dimensions:

| Mode | Width | Orientation |
|------|-------|-------------|
| `mobile` | < 768px | portrait |
| `landscape-mobile` | < 768px | landscape |
| `tablet-portrait` | 768–1365px | portrait |
| `landscape-tablet` | 1024–1365px | landscape |
| `desktop` | >= 1366px | any |

CSS overrides use `[data-layout-mode="..."]` selectors in `App.css`.

## Tests

- Unit tests for pure computation modules (`theory.ts`, `guitar.ts`, `shapes.ts`) in `src/__tests__/`
- Snapshot tests for component rendering
- Run with `npm test` — all tests must pass before submitting a PR

## License

By contributing, you agree that your contributions will be licensed under the [GNU AGPL v3.0](LICENSE).
