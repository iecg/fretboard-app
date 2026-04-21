# FretFlow — Claude Code Guide

React 19 + TypeScript guitar fretboard tool. Deployed to GitHub Pages.

## Commands

```bash
npm run dev            # start dev server
npm run build          # production build
npm run test           # run tests (vitest)
npm run test:e2e       # playwright e2e
npm run lint           # eslint
npm run preview        # preview build locally
```
**MANDATORY:** Run `lint`, `test`, and `build` locally before PR.

## Development Workflow

- **Branching:** Trunk-based. `main` = trunk. PRs required.
- **Commits:** Conventional Commits with scope. `type(scope): message`.
- **Releases:** Triggered via GitHub Actions (Auto Release). Never tag manually.

## Architecture

### State & Logic
- **State:** Jotai atoms in `src/store/`. Direct atom subscriptions in components.
- **Domain:** Pure logic in `theory.ts`, `guitar.ts`, `shapes/`, `degrees.ts`.
- **Audio:** `GuitarSynth` singleton in `audio.ts` (Web Audio API).

### Components & Layout
- **Orchestration:** `App.tsx` wires atoms to `MainLayoutWrapper`.
- **Rendering:** `FretboardSVG.tsx` handles SVG logic; `CircleOfFifths.tsx` handles root/degree selection.
- **Layout:** `useLayoutMode` measures viewport for Tier (mobile/tablet/desktop) and Variant.
- **Primitives:** `DrawerSelector` (dropdown), `NoteGrid`, `ToggleBar`.

## Conventions

- **Notes:** Stored as sharps internally (`C#`, `D#`). Flats resolved at render.
- **Tuning:** Arrays ordered high string (index 0) to low string.
- **Coordinates:** `"string-fret"` keys (e.g., `"0-12"`).
- **CSS:**
  - CSS Modules (`*.module.css`) for all components.
  - Global foundations in `tokens.css`, `semantic.css`, `App.css`, `index.css`.
  - Use `clsx` for conditional classes, `cva` for variant class systems, and `motion` for animations.
- **A11y:** Use ARIA labels and semantic HTML. Focus-visible styles required.

## CAGED / 3NPS System
1. `src/shapes/` finds note positions and generates polygon vertices.
2. Orchestrator merges adjacent boundaries with buffer.
3. `FretboardSVG.tsx` renders pixel SVG polygons.

## Lens & Note Roles
Notes are classified by semantic role (`root-active`, `chord-tone`, `note-active`, etc.). **Lenses** in `practiceLensAtoms.ts` apply emphasis (colors, squircles) based on these roles. Scale and chord domains remain independent.
