# Plan — Make `@fretflow/fretboard` self-contained for styling (token extraction)

> Status: **ready to execute** (not started). Owner: TBD. Gated by the visual-regression suite.

## Context

The **M1 mobile spike** ([fretflow-mobile](https://github.com/iecg/fretflow-mobile)) renders the
fretboard inside an Expo DOM island and surfaced that **`@fretflow/fretboard` is not self-contained
for styling**: its CSS modules and inline SVG `var(--…)` reference ~45 design tokens that are defined
in the **web app** (`src/styles/{tokens,semantic,themes}.css`), scoped under
`[data-theme="modern-light|modern-dark"]`. A standalone consumer that doesn't import those app
stylesheets gets fallback/black colors. The island works today only by reaching into
`fretboard-app/src/styles/*` from the mobile repo — a spike-only shortcut.

**Goal:** the fretboard's tokens become the package's own single source of truth. The package ships a
token stylesheet; the web app imports it back (so nothing changes for the web app); external
consumers import only the package. No duplication, no drift.

This is a **focused migration**, not a quick PR — the tokens are interleaved with app-wide tokens and
wired into a contrast-validation test suite and two tooling scripts. Do it on its own branch and gate
on visual regression.

## Token inventory (computed 2026-06-13 — re-verify before starting)

Source of truth for the reference list:
`grep -rhoE "var\(--[a-zA-Z0-9-]+" packages/fretboard/src --include='*.module.css' --include='*.tsx' --include='*.ts' | sort -u` (64 refs).

### A. MOVE into the package (fretboard-specific; defined in app `src/styles`)

These are owned by the fretboard. Move their declarations (both theme blocks + any `:root` base)
into the new package file. Note: the web app's **HelpModal diagrams** (`src/components/HelpModal/diagrams/*`)
also consume the `--fb-*` family — they keep working because the web app re-imports the package file.

- **Chord connectors** (`themes.css`): `--chord-connector-color-1…8`, `--chord-connector-fill-opacity`,
  `--chord-connector-halo-color`, `--chord-connector-halo-width`, `--chord-connector-outline-opacity`,
  `--chord-connector-outline-width`.
- **Note-role fills (`--fb-*`)** (`themes.css`): `--fb-home-fill/stroke`, `--fb-guide-fill/stroke`,
  `--fb-neutral-fill/stroke`, `--fb-connector-halo`, `--fb-region-tint`.
- **Board / fret-number / note-text** (`themes.css`): `--fretboard-board-shadow`,
  `--fretboard-fret-number-color`, `--fretboard-note-text-fill`, `--fretboard-note-text-stroke`,
  `--fret-wire-shadow`, `--nut-stop-1…4`.
- **Wood / wire / nut / inlay / string / edges** (`tokens.css`): `--fretboard-wood-top/mid/bottom`,
  `--fret-wire-dark/medium/bright`, `--inlay-pearl-stop1…3`, `--inlay-pearl-opacity1…3`,
  `--string-wire`, `--string-wire-bass`, `--fretboard-top-edge-color`, `--fretboard-bottom-edge-color`,
  `--fretboard-nut-slot-color`, `--fretboard-glow-opacity`.
- **Semantic fretboard tokens** (`semantic.css`): `--fretboard-a11y-hover-bg`.

> Ambiguous — DECIDE before moving (used by notes generally, maybe beyond the fretboard):
> `--note-incoming`, `--note-label-on-color`, `--note-label-on-color-stroke` (defined in
> `semantic.css` + `themes.css`). If any are referenced outside `packages/fretboard` and the fretboard
> HelpModal diagrams, leave them app-owned (category B). Verify with
> `grep -rn "var(--note-incoming\|var(--note-label-on-color" src | grep -v src/styles`.

### B. LEAVE app-owned; add `var(--token, <fallback>)` at the package reference sites

Genuinely app-wide tokens the fretboard merely references. Do **not** move. Add an inline fallback in
the package CSS/TSX so standalone consumers still render acceptably:

- `--accent-primary` (`index.css`) — focus accent.
- `--focus-ring`, `--focus-ring-glow`, `--focus-ring-offset` (`semantic.css`).
- `--font-sans` (`tokens.css`).
- `--neon-orange` (`tokens.css`) — palette token used by the orange glow.

### C. DYNAMIC / package-injected — no action

Set at runtime by components (inline style), not defined in any stylesheet:
`--emph-scale`, `--fb-connector-dash`, `--fretboard-svg-glow-orange-url`, `--guide-duration`,
`--note-r`, `--string-row-px`, `--string-taper-*`, `--shape-fill`, `--caged-*` (verify each is set in
TSX before assuming).

## Constraints & coupling (the reason this isn't a small PR)

1. **Interleaving.** Category-A tokens sit between app-wide tokens (`--note-role-*`, `--glow-*`,
   `--token-*`, `--elevation-*`, `--chip-*`) inside the same `:root` / `[data-theme]` blocks across
   three files. Extract line-by-line; do not move whole blocks.
2. **Two theme blocks.** `themes.css` defines the themed tokens under **both**
   `[data-theme="modern-light"]` and `[data-theme="modern-dark"]`. The package file must reproduce
   both selectors with the exact per-theme values.
3. **Contrast-test parser.** `src/styles/__tests__/cssTokens.ts` hardcodes
   `THEMES_CSS = new URL("../themes.css", …)` and `readThemeBlock()` parses it. Three tests depend on
   it: `fbColorTokens.test.ts`, `connectorLegibility.test.ts`, `cssTokens.test.ts`, plus the package's
   `FretboardSVG.test.tsx`. After the move these tokens live in the package file → **repoint
   `cssTokens.ts` to read the package token file** (or read both). Consider moving the three
   fretboard-contrast tests into the package alongside the tokens.
4. **`ui-tokens.mjs`.** Scans only `src/` for `--x:` definitions (line ~139-140). After the move, the
   app's HelpModal `var(--fb-*)` usages would be reported undefined → **extend the scan to include the
   package's `src/styles` (and ideally `packages/fretboard/src`)**, or have it follow the package
   import.
5. **Move = no duplicate definition.** A custom property defined once (in the package file) keeps the
   cascade deterministic regardless of import order. Never leave a token defined in both the app and
   the package.

## Approach (step-by-step)

1. **Create** `packages/fretboard/src/styles/fretboard-tokens.css` with three sections:
   `:root` (theme-independent primitives), `[data-theme="modern-light"]`, `[data-theme="modern-dark"]`.
   Populate by moving the exact Category-A declarations from `tokens.css` / `semantic.css` /
   `themes.css` (preserve values and comments verbatim).
2. **Remove** those declarations from `src/styles/{tokens,semantic,themes}.css`.
3. **Export** the file: it resolves through the existing `"./*": "./src/*"` exports map because the
   specifier carries the `.css` extension (`@fretflow/fretboard/styles/fretboard-tokens.css`).
4. **Web app import:** add `import "@fretflow/fretboard/styles/fretboard-tokens.css";` to
   `src/main.tsx` (order before `themes.css` is fine — single definitions, order-independent).
5. **Category-B fallbacks:** add `var(--token, <value>)` at the package's reference sites for the six
   app-owned tokens (use the current `modern-light` values as the fallback).
6. **Repoint tooling/tests:**
   - `src/styles/__tests__/cssTokens.ts`: read the package token file for fretboard tokens.
   - `scripts/ui-tokens.mjs`: include the package `src/styles` (and `packages/fretboard/src`) in the
     definition scan.
   - Optionally relocate `fbColorTokens.test.ts` + `connectorLegibility.test.ts` into
     `packages/fretboard/src/` (co-located with the tokens).
7. **Mobile consumer follow-up (separate, in `fretflow-mobile`):** replace the island's three
   `../../../fretboard-app/src/styles/*.css` imports with the single
   `@fretflow/fretboard/styles/fretboard-tokens.css`, and bump the submodule SHA.

## Verification (all must pass — visual regression is the gate)

1. `pnpm run lint` (incl. the fretboard boundary check — the new CSS is inside the package).
2. `pnpm run test` — especially `cssTokens`, `fbColorTokens`, `connectorLegibility`, and
   `FretboardSVG.test.tsx` (contrast/APCA guards prove the token values survived the move).
3. `pnpm run ui:tokens` — zero undefined `var(--x)` (proves the scan + HelpModal usages still resolve).
4. `pnpm run build`.
5. **`pnpm run test:visual`** — **zero snapshot diffs**. This is the real gate: any diff means a token
   value or scope drifted in the move. Do not update snapshots to pass.

## Risks

- **Value/scope drift** during the line-by-line move → caught by the contrast tests + visual
  regression. Move verbatim; diff `git show` against the originals.
- **Missed token** (esp. inline `var()` in `FretboardDefs.tsx`) → `ui:tokens` + visual regression
  catch a black/blank gradient.
- **Ambiguous `--note-*` tokens** — decide ownership up front (step inventory note) to avoid pulling a
  shared token out of the app.
- **`exports` extensionless map** — CSS subpath works (extension in specifier); do **not** rely on
  extensionless TS subpaths (see [#608](https://github.com/iecg/fretboard-app/pull/608) for that
  separate finding).
