# FretFlow — AI Agent Guide

React 19 + TypeScript guitar fretboard tool. Deployed to GitHub Pages.

## Commands

```bash
pnpm run dev                   # start dev server
pnpm run build                 # production build (tsc -b && vite build)
pnpm run test                  # vitest run
pnpm run test:watch            # vitest watch
pnpm run test:coverage         # vitest with v8 coverage
pnpm run test:e2e              # playwright against dev server
pnpm run test:e2e:production   # build + playwright against vite preview
pnpm run test:visual           # build + visual regression suite
pnpm run test:visual:update    # refresh darwin visual snapshots
pnpm run lint                  # eslint
pnpm run ui:tokens             # flag undefined CSS token (var(--x)) references — see /ui-review
pnpm run preview               # preview build locally
```

**MANDATORY:** Run `lint` and `test` locally before opening a PR; run `build` too when the change touches types, imports, or the build graph (it's the slow one). Git hooks do **not** run these checks — `.githooks/pre-commit` only blocks direct commits to `main`. CI is the real gate, but running them locally first avoids burning a CI cycle.

## Development Workflow

- **Branching:** Trunk-based. `main` = trunk. PRs required.
- **Commits:** Conventional Commits with scope. `type(scope): message`.
- **Releases & breaking changes:** Triggered via GitHub Actions (Auto Release). Never tag manually. Breaking changes need a `BREAKING CHANGE:` footer (the Angular preset ignores `!`), and footer placement is fiddly — read [`RELEASING.md`](RELEASING.md) before merging a breaking PR or cutting a release.
- **Worktrees (preferred isolation):** Before starting multi-step feature work or executing an implementation plan, create a git worktree first — invoke `superpowers:using-git-worktrees`. Run each concurrent/subagent stream that touches files in its own worktree so parallel agents never clobber a shared working tree. Quick single-file doc/config edits on a short-lived branch may skip the worktree. The `.githooks/pre-commit` nudge is only a last-resort reminder when this was missed.
- **Git hooks:** `.githooks/pre-commit` (registered via `postinstall`) hard-blocks direct commits to `main` and nudges worktree use. Plain POSIX, no husky/Node — kept near-zero CPU so concurrent agents don't stall.
- **Instruction files:** `AGENTS.md` is the canonical project guide. `CLAUDE.md` and `GEMINI.md` are `@AGENTS.md` import stubs so Claude Code, Gemini CLI, opencode, Codex, Copilot, and Antigravity all read the same content. Edit `AGENTS.md` only.

## Architecture

- **State:** Jotai atoms — atomic reactivity, no prop drilling. Domain atoms live in `@fretflow/fretboard` (`packages/fretboard/src/store/`); app-shell atoms (`inspectorAtoms`, `languageAtom`, `urlOverrideAtoms`) in `src/store/`. Old `src/store/*` and `src/progressions/` paths are re-export stubs — import from `@fretflow/fretboard/...` in new code.
- **Domain (pure):** `@fretflow/core` (`packages/core/src/`) — theory, guitar, degrees, `shapes/`. Theory functions are backed by [Tonal.js](https://github.com/tonaljs/tonal); naming translation in `packages/core/src/lib/tonal.ts`.
- **Rendering:** `packages/fretboard/src/components/FretboardSVG/FretboardSVG.tsx` is the primary SVG renderer; `FretboardEmbed` is the package's serializable public contract (`config` in, `FretboardEvent`s out).
- **Controls:** `components/Inspector/` — two tabs (Overlay = scale + chord cards; Song = key/scale, progression, tempo, backing track).
- **Layout:** `useLayoutMode` → `MainLayoutWrapper` emits `data-layout-tier` + `data-layout-variant`; **both gate responsive CSS — always consider both.**
- **Rendering domains:** Scale and chord rendering are independent — **do not cross-wire their visibility or color state.** (Loading a progression preset is the one intentional exception: it sets the active *scale* but does not couple the color domains.)

Full module inventory, component wiring, the CAGED/3NPS pipeline, and Note Roles → [`docs/design/architecture.md`](docs/design/architecture.md).

## File Layout

```text
packages/
├── core/                     # @fretflow/core — pure music-theory package
│   └── src/                  # theory, theoryCatalog, guitar, degrees, circleOfFifthsUtils,
│                             # diatonicNotes, constants, shapes/, lib/tonal.ts
└── fretboard/                # @fretflow/fretboard — fretboard renderer, Jotai store closure,
    └── src/                  # progression engine, audio runtime, FretboardEmbed contract.
                              # Source-only (no dist); consumed via Vite alias + tsconfig paths.
                              # Self-contained: no imports from src/, no import.meta
                              # (enforced by scripts/check-fretboard-boundaries.mjs in `pnpm run lint`).

src/
├── App.tsx                   # orchestrator
├── main.tsx
├── core/                     # app-side runtime (audio, lazyGuitarAudio, toneInit,
│                             # fretboardLayoutCache, polygonCoverage)
├── store/                    # app-shell atoms (inspectorAtoms, languageAtom, urlOverrideAtoms)
│                             # + re-export stubs; the domain atom closure now lives in
│                             # packages/fretboard/src/store/
├── hooks/                    # useLayoutMode, useFretboardState, useFretboardTopologyModel,
│                             # usePlaybackTransportModel, useProgressionAudioPlayback, ...
├── layout/                   # breakpoints + responsive layout resolver
├── progressions/             # (now in packages/fretboard/) progression domain + Tone.js audio engine
├── utils/                    # storage helpers, dom helpers
├── i18n/                     # translation strings + useTranslation
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
- **CSS:** CSS Modules (`*.module.css`) for components; global foundations in `src/styles/` (imported via `src/styles/index.css`); shared module CSS in `src/components/shared/`. Use `clsx` (conditional classes), `cva` (variants), `motion` from `motion/react` (animations). **Tokens must resolve** — every `var(--x)` must point at a defined token; run `pnpm run ui:tokens` (or `/ui-review`) before finishing mobile/tablet UI changes (see `docs/design/mobile-ui-contract.md`).
- **Tooling:** Package manager **pnpm** (workspace in `pnpm-workspace.yaml`); linting is **ESLint only** — no stylelint, no lint-staged.
- **React Compiler:** Enabled via `babel-plugin-react-compiler` in `vite.config.ts` with `compilationMode: 'infer'`. Every component and hook in `src/` and `packages/core/src/` is auto-memoized — manual `useMemo` / `useCallback` / `React.memo` is rarely needed for render-perf and should be added only when profiling proves it. The `react-compiler/react-compiler` ESLint rule runs at `error` and guards Rules-of-React compliance. To opt a single component out, add `'use no memo'` as the first statement of the function body with a `// TODO(react-compiler): <reason>` comment.
- **A11y:** ARIA labels + semantic HTML + `:focus-visible` styles required. `vitest-axe` available for component tests.

## Testing

- **Vitest** + Testing Library for unit/component (jsdom). Coverage via `@vitest/coverage-v8`.
- **Playwright** for e2e + visual regression. Configs: default (dev server), production (serves `dist/`), production-base, visual.
- **Visual regression suites** under `e2e/`: `app-components`, `app-layout`, `app-mobile`, `app-overlays`, `fretboard-svg` — each with committed darwin + linux snapshots. Update via `pnpm run test:visual:update` (darwin) or `pnpm run test:visual:update:linux` (cross-platform).
- **a11y:** `vitest-axe` + `eslint-plugin-jsx-a11y`.

## Reference docs (read on demand — do not preload)

Durable docs live in `docs/design/` (index: `docs/design/README.md`) plus `RELEASING.md`. They are **not** preloaded — pull the relevant one only when working in its domain, cite it, and add new sources back:

- module inventory / component wiring / CAGED-3NPS pipeline / note roles / CI shape → `docs/design/architecture.md`
- releases / breaking-change footer rules → `RELEASING.md`
- markers / color / marker shape / connectors / voice-leading motion → `docs/design/fretboard-visual-language.md`
- voicing / strum / close-voicing fallback / audio playback → `docs/design/audio-voicing-engine.md`
- chord qualities / scales / guide tones / improvisation lenses / modes → `docs/design/music-theory-pedagogy.md`
- mobile/tablet sheet shell / panels & drawers / Settings & Help sheets / surfaces & dividers / header padding / scroll & overflow / zoom control → `docs/design/mobile-ui-contract.md` (run `/ui-review` to enforce)

Provenance: each doc lists the source specs it consolidates with the git SHA before deletion (`git show <sha>:<path>` recovers the original).
