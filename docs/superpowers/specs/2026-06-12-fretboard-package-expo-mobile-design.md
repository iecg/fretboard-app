# Fretboard Package Extraction + Expo Mobile App — Design

**Date:** 2026-06-12
**Status:** Approved design, pending implementation plan

## Problem

FretFlow needs a mobile app with a genuinely native feel. Two approaches were evaluated and rejected:

- **Capacitor** (see local `capacitorjs` branch): wraps the existing web app in a webview. The result inherits both problems it was meant to solve — the app doesn't feel native (webview scroll physics, transitions, keyboards), and the mobile web UI's weaknesses ship to the store unchanged.
- **React Native (full rewrite)**: requires re-implementing the entire UI from scratch, including the fretboard renderer — the most valuable and hardest-won part of the codebase.

**Hard constraint:** the fretboard (`Fretboard` + `FretboardSVG` tree) must not be rewritten or redone. Everything else may be rebuilt.

**Requirements:**

- Native-feeling shell: navigation, tabs, sheets, controls, haptics.
- The existing fretboard renderer is reused byte-for-byte.
- Mobile needs backing-track (progression) playback.
- No published packages to maintain (no npm registry, no GitHub Packages).
- The mobile app must not live in a public repo. This repo stays public (GitHub Pages).

## Decision Summary

1. Extract the fretboard into a self-contained workspace package, **`@fretflow/fretboard`**, with a serializable, controlled-component public API (`config` in, `events` out, injectable audio). The Jotai store moves into an internal **`@fretflow/state`** package; atoms become an implementation detail rather than the public contract.
2. The progression playback engine joins `@fretflow/fretboard` behind the same injectable-audio seam, because mobile needs backing tracks and the fretboard's voice-leading visuals depend on its timing.
3. The mobile app is an **Expo (React Native) app in a new private repo**, consuming this repo's packages via a **git submodule + pnpm workspace span** — true `workspace:*` linking with no publishing.
4. The fretboard renders inside the Expo app as an **Expo DOM component** (`'use dom'`): the existing React DOM component running in an embedded webview, with native chrome (navigation, sheets, controls) around it. The shell owns state and passes serializable `config` across the boundary.

## Architecture

### Two runtimes, one fretboard

```
fretflow-mobile/  (new, PRIVATE repo)
├── apps/mobile/                  # Expo app
│   ├── Native shell (React Native)
│   │   • navigation, tab bar, bottom sheets
│   │   • Song/Overlay controls (rebuilt native)
│   │   • settings, haptics, audio session
│   │   • owns app state; any state lib
│   └── FretboardIsland ('use dom')
│       • renders <Fretboard config={...} onEvent={...}/>
│       • from @fretflow/fretboard, unchanged web code
├── fretboard-app/                # git submodule → this repo, pinned to a SHA
└── pnpm-workspace.yaml           # packages: [apps/*, fretboard-app/packages/*]

fretboard-app/  (this repo, PUBLIC, unchanged role)
├── packages/core/        @fretflow/core       (exists) — pure music theory
├── packages/state/       @fretflow/state      (new) — Jotai atom modules
├── packages/fretboard/   @fretflow/fretboard  (new) — fretboard + progression engine
└── src/                  web app — consumes the packages, ships to GitHub Pages
```

How DOM components work: a file beginning with the `'use dom'` directive default-exports a React DOM component. Expo's Metro bundler compiles it as a real web bundle (CSS modules, SVG, Web Audio all function) mounted in a webview, while the rest of the app is native. Props crossing the boundary must be serializable; callbacks are marshalled as async functions. Consequence: tight interaction and animation loops must live entirely inside the island — which is exactly the fretboard's existing behavior.

### Package: `@fretflow/state`

> **Amendment (M0 implementation):** `src/store` and `src/progressions` proved to be mutually coupled, so a standalone state package would create a dependency cycle. State ships inside `@fretflow/fretboard` as the internal `store/` module (subpath-importable via `@fretflow/fretboard/store/*`). Everything else in this section applies to that module unchanged.

The domain-split Jotai atom modules move from `src/store/` into `packages/state/`. Internal-facing: consumed by `@fretflow/fretboard` and by the web app (which keeps its existing atom-level integration). Changes required by the move:

- **Storage adapter injection.** `atomWithStorage` currently assumes `localStorage` via `src/utils/storage.ts`. The package accepts an injected storage implementation (web: `localStorage`; the DOM island also uses `localStorage`; a future native consumer could supply AsyncStorage). Keys and prefixing behavior are unchanged.
- **Viewport decoupling.** `layoutAtoms` / `layout/responsive` currently measure the window. The layout tier becomes an input atom that the host sets (web app keeps `useLayoutMode` and writes into it; the mobile shell passes tier via `config`). The fretboard package never measures the window itself.

### Package: `@fretflow/fretboard`

Contains, moved as-is with tests and CSS modules co-located:

- `components/Fretboard/` and `components/FretboardSVG/` (all layers, hooks, geometry, motion policy, semantics/emphasis utils)
- Fretboard-specific shared hooks currently in `src/hooks/` (`useFretboardState`, topology/viewport/playback models, connector polyline hooks)
- App-runtime pieces the tree depends on: `core/lazyGuitarAudio` (GuitarSynth), `core/fretboardLayoutCache`, `core/polygonCoverage`
- The progression engine: `src/progressions/` plus `useProgressionAudioPlayback` and transport hooks

Dependency audit (performed 2026-06-12) confirms the tree's only external reach is: 8 store modules, the app-runtime pieces above, fretboard-specific hooks, and `@fretflow/core`. No router, Inspector, or i18n entanglement.

#### Public contract

Atoms are not the public API. The package exposes a controlled component:

```tsx
<Fretboard
  config={{
    root, scale, pattern, shape, position,        // scale/fingering intent
    chordVoicing, stringSet,                       // chord overlay intent
    progression, tempo, timeSignature, transport,  // song intent (play/pause/seek)
    tier, theme,                                   // presentation context
  }}
  onEvent={(e) => void}   // noteActivated, chordStrummed, chordBoundary,
                          // coarse playback progress — serializable payloads
  audio={"builtin" | "events"}
/>
```

- A thin **hydration wrapper** maps `config` → atom writes. `FretboardSVG` and every layer below keep their direct atom subscriptions byte-for-byte.
- `config` is fully serializable and changes at human speed only. High-frequency state (running playhead, animations) never crosses the boundary; it animates inside the island.
- The web app may continue to use the deeper atom-level integration via a secondary entry point, so nothing about the web app's behavior changes.

#### Injectable audio

- `audio="builtin"` (default): current behavior — `GuitarSynth` (Web Audio) for note taps, Tone.js engine for progression playback. The web app and the M1 mobile spike use this.
- `audio="events"`: the package plays no sound and emits timing events; the consumer renders audio. This is the seam for native mobile audio (M3) — `react-native-audio-api` implements the Web Audio spec natively, so `GuitarSynth`'s graph code is expected to port largely intact.

#### Dual-bundler discipline

The package is consumed by Vite (web app) and Metro (Expo DOM island). Inside `packages/state` and `packages/fretboard`:

- No Vite-isms (`import.meta.env`, `?url`/`?raw` asset imports, plugin-dependent tricks).
- No direct window measurement (see viewport decoupling) and no other host-environment assumptions beyond standard DOM APIs.
- Enforced by an ESLint boundary rule scoped to the two packages, so the auditable surface is the packages rather than all of `src/`.
- React Compiler runs in both pipelines (Vite babel plugin here; `experiments.reactCompiler` in Expo).

### Repo topology and linking

- This repo remains public and remains the source of truth for `packages/*`. The web app's release flow is unchanged.
- The private `fretflow-mobile` repo adds this repo as a **git submodule**, and its `pnpm-workspace.yaml` spans into `fretboard-app/packages/*`. The mobile app depends on `@fretflow/fretboard` via `workspace:*`.
- The submodule SHA pins exactly which fretboard the mobile app builds against; it is bumped deliberately. During development the submodule is a normal checkout — fretboard changes are committed and PR'd to this repo as usual.
- EAS Build supports private submodules via an auth token environment variable.
- Rejected alternatives: publishing to a registry (maintenance the owner explicitly does not want); pnpm git dependency with `#path:` (requires an install-time build step and makes Metro/TS source resolution finicky); making this repo private (breaks the public GitHub Pages product).

## Milestones

- **M0 — Extraction (this repo, web-only, zero behavior change).** Move store → `@fretflow/state`, fretboard tree + progression engine → `@fretflow/fretboard`. Build the hydration wrapper, event surface, and audio injection seam. Re-point web app imports. Guarded by the existing co-located tests (which move with the code) and the visual regression suites — the extraction must produce zero snapshot diffs. Shippable and valuable on its own.
- **M1 — Spike (private repo, decision gate).** Create `fretflow-mobile` with the submodule + workspace wiring. One Expo screen rendering the FretboardIsland with `audio="builtin"` (web audio inside the island). Validate on real devices: SVG rendering performance (especially low-end Android webview), touch gestures, CSS modules under Metro, audio latency, the pnpm/Metro monorepo plumbing. Failure here costs days, not weeks, and M0 retains its value.
- **M2 — Native shell.** Native tab bar, bottom sheets, Song/Overlay controls rebuilt with native components (consuming `@fretflow/core` for theory data). Shell owns state; serialized `config` flows into the island; events flow back. Haptics, safe areas, status bar.
- **M3 — Native audio.** Port `GuitarSynth` and progression playback to `react-native-audio-api` (or `expo-audio` where simpler). Island flips to `audio="events"`. Fixes backgrounded-webview timer throttling for backing tracks.
- **M4 — Store readiness.** EAS builds, icons/splash, background-audio session behavior, TestFlight.

M0 happens in this repo. M1–M4 happen in the private repo and are specced separately when reached; this document fixes only their sequence and the seams they rely on.

## Testing

- **M0:** existing unit/component tests move with their code and must pass unchanged. The e2e visual regression suites are the primary guard: zero diffs expected. New contract tests cover the hydration wrapper (given `config`, the correct atoms are written; events fire with serializable payloads; `audio="events"` emits instead of playing).
- **Packages:** `packages/state` and `packages/fretboard` get their own vitest projects within the workspace, runnable in isolation.
- **Mobile:** starts with manual device testing via Expo dev builds; Maestro e2e considered later if warranted.

## Risks

- **Android webview SVG performance** on low-end devices — the M1 spike's primary question; the design's go/no-go gate.
- **Bridge chattiness** — mitigated by design: `config` changes at human speed; playhead and animation stay inside the island.
- **Backgrounded webview timers** degrade progression playback in M1–M2 — accepted temporarily; properly fixed by M3 native audio.
- **Two audio implementations during M2–M3** — the `builtin`/`events` mode switch keeps them from interleaving; drift risk is contained to the M3 port.
- **pnpm + Expo + Metro monorepo/submodule plumbing** — known-solvable; budget roughly a day of bundler configuration in M1.
- **Extraction churn** — M0 is a large mechanical import-rewrite PR. Mitigated by `git mv` (history preserved), co-located tests, and the zero-visual-diff gate.

## Open Questions (deferred, non-blocking)

- Exact `config` field list and event taxonomy — finalized during M0 implementation planning from the real atom allowlist.
- Whether the mobile shell needs i18n from day one (current i18n stays in `src/`; the package surface is intentionally i18n-free).
- `react-native-audio-api` vs `expo-audio` for M3 — decided by an M3-time spike; the events seam is identical either way.

## Provenance

- Dependency audit of the fretboard tree: this conversation, 2026-06-12 (grep of `src/components/Fretboard*`, `src/hooks/useFretboard*`).
- Prior art: `capacitorjs` branch (safe areas, touch-target token scaling, dynamic base path); mobile-first UI overhaul (#602, `docs/superpowers/specs/2026-06-09-mobile-first-ui-design.md`).
