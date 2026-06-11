# Mobile & Tablet UI Contract

**Status:** Durable reference. **Read before** changing any sheet-shell surface — the
MobileShell, its panels/drawers, the Settings/Help sheets, the header, the stage, or the
zoom control. This is the single source of truth for the rules the `/ui-review` skill and
the `pnpm run ui:tokens` check enforce. Cite a rule by its ID (e.g. `T1`) in reviews.

## Why this exists

Five rounds of mobile redesign (v1–v4) kept re-introducing the *same classes* of defect.
Catching them by eye each round was slow and inconsistent. This contract names each rule
as a checkable assertion and tags **how** it is verified, so the result is repeatable:

- `[static]` — caught deterministically by `pnpm run ui:tokens` (`scripts/ui-tokens.mjs`).
- `[runtime]` — caught by `/ui-review` driving the live preview at fixed viewports.
- `[review]` — a judgment rule; `/ui-review` walks it against changed source.

The motivating failures are cited inline as **(seen: …)** so the rule is grounded in a real
bug, not an abstraction.

## 1. Tokens & surfaces

- **T1 `[static]` Every `var(--x)` must resolve.** A reference to an undefined token
  silently resolves to nothing. *(seen: `var(--border-subtle)` had no definition, so a
  panel header divider rendered transparent and content scrolled under it with no
  separation.)* A token counts as defined if declared in any `src/**/*.css` (`--x: …`) or
  injected as a React inline-style key in `.ts/.tsx` (`"--x": value`). References with an
  intentional fallback (`var(--x, 8px)`) are tolerated (warning, not error).
- **T2 `[review]` Panel / drawer / modal surfaces use `--surface-app-panel`.** Never a raw
  hex, a one-off gradient, or pure white. *(seen: the mobile sheet sat on a different
  surface color than the desktop cards, which never sit on pure white.)*
- **T3 `[review]` Dividers use `--panel-header-border`.** One token for every panel/sheet
  header separator (it aliases `--chrome-border`). Do not invent per-component border
  tokens or hardcode `rgb(255 255 255 / …)`.
- **T4 `[review]` One drawer-motion spec.** Every bottom drawer slides with the same
  duration and easing (0.28s `easeOut`). *(seen: Overlay used 0.28s and Song used 0.32s, so
  two “identical” drawers animated differently.)*

## 2. Shared primitives

- **P1 `[review]` All mobile bottom drawers render through `MobilePanel`**
  (`src/components/MobileShell/MobilePanel.tsx`). Overlay and Song are wrappers over it;
  no screen builds a bespoke drawer. *(seen: Song was a Radix Dialog while Overlay was an
  anchored drawer, so they had different chrome, focus behavior, and push behavior.)*
- **P2 `[review]` Settings and Help render through `AdaptiveModal`** and adopt the shared
  `.sheet` chrome on the sheet shell (same surface + header treatment as the panels).
  *(seen: Settings/Help did not match the panel family and their content could not scroll.)*
- **P3 `[review]` Icon parity.** A control that exists on both desktop and the mobile
  context menu uses the same icon in both. *(seen: the mobile context menu used a different
  icon set than the desktop header.)*

## 3. Layout & scroll

- **L1 `[runtime]` Header is never flush to the edge.** The header has horizontal padding;
  the logo and action buttons keep an inset from the viewport edge. *(seen: logo and header
  buttons sat flush against the screen edge.)*
- **L2 `[runtime]` No horizontal overflow.** At every sheet-shell width,
  `documentElement.scrollWidth <= innerWidth`.
- **L3 `[runtime]` No stray scrollbar on the fixed shell.** The shell is `overflow:hidden`
  and `body` does not scroll. Scrollable regions are intentional (panel/sheet bodies) and
  their scrollbars stay hidden when idle. *(seen: the whole mobile app showed scrollbars
  that should only appear conditionally.)*
- **L4 `[runtime]` No dead band or stray shadow below the board.** The stage centers the
  board; there is no empty gap or drop-shadow strip beneath it. *(seen: large whitespace and
  a weird shadow below the fretboard on mobile.)*
- **L5 `[runtime]` Sheet content scrolls when it overflows.** Settings/Help bodies must be
  scrollable; content is never clipped with no way to reach it.

## 4. Stage & zoom

- **Z1 `[review]` The sheet shell allows sub-100% zoom** down to `FRET_ZOOM_OUT_MIN`
  (`packages/core/src/constants.ts`), so more of the neck fits. Desktop keeps `FRET_ZOOM_MIN`
  (100) as its floor.
- **Z2 `[runtime]` The zoom control sits bottom-right** of the stage and **hides while a
  panel is open** (it must not overlap an open drawer).

## 5. How to run

```bash
pnpm run ui:tokens     # T1 only — fast, deterministic, exits non-zero on a no-fallback miss
/ui-review             # T1 + all [runtime] checks (drives the preview) + the [review] walk
```

`/ui-review` is report-only and is **not** a CI gate — it is a development-time tool invoked
by the owner or the agent before finishing a mobile/tablet UI change.

## Provenance

New doc (2026-06-11). Rules distilled from the v1–v4 mobile-redesign review rounds on PR
#602 (`claude/musing-gould-9706c8`); the per-rule **(seen: …)** notes are the concrete
defects those rounds surfaced. No prior spec consolidated here.
