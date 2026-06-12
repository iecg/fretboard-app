---
name: ui-review
description: Review the mobile/tablet UI against docs/design/mobile-ui-contract.md — runs the undefined-token check, drives the live preview to assert runtime layout invariants (overflow, scrollbars, header padding, dead band, zoom control), and walks the judgment rules. Report-only; not a CI gate.
---

# UI Review

Checks the sheet-shell UI (MobileShell, its panels/drawers, the Settings/Help sheets, the
header, the stage, the zoom control) against the **Mobile & Tablet UI Contract**
(`docs/design/mobile-ui-contract.md`). That doc is the single source of truth — cite every
finding by its rule ID (`T1`, `L3`, `Z2`, …). Do **not** restate rules from memory; if a
check is unclear, read the contract.

**Report-only.** This skill never edits code. It produces a findings report so the owner (or
the agent, in a later pass) can fix. It is a development-time tool, not a merge gate.

**Optional focus arg.** `/ui-review [area]` (e.g. `/ui-review song panel`) narrows the
`[review]` walk to the named area; the `[static]` and `[runtime]` passes always run in full.

## Step 1 — Static pass (`[static]`: T1)

Run the token checker from the repo root:

```
pnpm run ui:tokens
```

Report every **error** (undefined `var(--x)` with no fallback) as a `T1` violation with its
`file:line`. List **warnings** (undefined but with a fallback) separately as "confirm
intended" — they are tolerated, not failures.

## Step 2 — Runtime pass (`[runtime]`: L1–L5, Z2)

Start the preview (`preview_start` if not already running). Run the checks at **both** canonical
viewports — mobile **390×844** and tablet **768×1024** (`preview_resize`). Adding a device
means adding a viewport here. Prefer text-based tools (`preview_eval`, `preview_inspect`,
`preview_snapshot`); take a `preview_screenshot` only as evidence for a real violation.

**Driving the UI reliably (learned by dogfooding — do this or you will misread):**

- **Open/close panels programmatically, not with `preview_click`.** A synthetic `preview_click`
  on `[data-testid="dock-toggle-overlay"]` did *not* flip the `data-mobile-panel` atom. In a
  `preview_eval`, call `document.querySelector('[data-testid="dock-toggle-overlay"]').click()`
  and confirm `shell.getAttribute('data-mobile-panel')` changed before measuring.
- **Wait for the slide to settle before measuring.** Panels animate via a motion `y` transform
  (0.28s), so `getBoundingClientRect()` is wrong mid-animation (you will see the panel as a
  sliver at the viewport bottom and the zoom control still at opacity 1). Poll until the
  panel's `rect.top` is unchanged across ~3 frames, *then* read Z2/P1. Likewise the stage's
  `padding-bottom` animates on close — reload (or wait out the 0.28s) before reading L4.
- **Surfaces are intentionally transparent.** Panel/dock/modal backgrounds let the app
  gradient show through, so a transparent computed `background-color` is *not* a T2 failure.
  T2 is satisfied when the surface is driven by `--surface-app-panel` (even via its fallback);
  flag only raw hex / one-off gradients. Note: `--surface-app-panel` currently resolves via a
  fallback (it has no `--surface-app-panel: …` declaration) — `ui:tokens` lists it as a
  tolerated warning; defining it in `semantic.css` would make the canonical token real.

For each viewport:

- **L2 — no horizontal overflow.** `preview_eval`:
  `document.documentElement.scrollWidth <= window.innerWidth` → must be `true`.
- **L3 — no stray shell scrollbar.** `preview_eval` that the shell
  (`[data-testid="mobile-shell"]`) computed `overflow` is `hidden` and
  `document.body.scrollHeight <= window.innerHeight` (body does not scroll). Intentional
  inner scroll (panel/sheet body) is fine; a scrollbar on the shell or body is a violation.
- **L1 — header not flush.** `preview_inspect` the header: `padding-left`/`padding-right`
  > 0, and the logo's left edge is inset from x=0. Flush-to-edge is a violation.
- **L4 — no dead band / shadow below the board.** `preview_eval` the gap between the board
  (`[data-testid="fretboard-outer"]`) bottom and the stage bottom; a large empty gap or a
  visible shadow strip beneath the board is a violation.
- **Z2 — horizontal zoom control, bottom-right, hidden under a panel.** With no panel open,
  the control sits in the stage's bottom-right and its `flex-direction` is `row` (buttons
  side-by-side, not stacked). Open a panel (`.click()` the Overlay dock toggle) and confirm
  the control is hidden (`opacity:0` / not hit-testable), then close it.
- **L5 — sheets scroll.** Open Settings (and Help): `preview_eval` that the hosted content
  (`settings-overlay-content` / `help-modal-content`) is the bounded scroller
  (`scrollHeight > clientHeight`, setting `scrollTop` holds) and its header stays put while
  the body scrolls. Content clipped with no scroll is a violation.
- **P1b no reflow.** Record the board (`fretboard-outer`) height with no panel, then open
  Overlay and Song in turn (settle each). The board height must be UNCHANGED in all three
  states — both drawers slide over a static board. A resize is a `P1b` violation.
- **P1 chrome parity.** Overlay and Song must share surface, radius, border, and a
  **visible** header divider, and the dock tabs stay visible under both. Differences are a
  `P1`/`T4` violation.

## Step 3 — Review pass (`[review]`: T2, T3, T4, P1, P2, P3, Z1)

Walk these against the source that changed (or the named focus area). Read the relevant files
rather than guessing:

- **T2** surfaces use `--surface-app-panel`; **T3** dividers use `--panel-header-border`;
  **T4** every bottom drawer shares the 0.28s `easeOut` motion. Grep the panel/sheet CSS
  modules for raw hex/gradient surfaces, ad-hoc border colors, and divergent transition
  durations.
- **P1** Overlay and Song both render through `MobilePanel`
  (`src/components/MobileShell/MobilePanel.tsx`); **P2** Settings/Help render through
  `AdaptiveModal` with the shared `.sheet` chrome; **P3** mobile context-menu icons match the
  desktop set.
- **Z1** the sheet shell allows sub-100% zoom (`FRET_ZOOM_OUT_MIN`); desktop keeps 100.

## Step 4 — Report

Group findings and cite the rule ID + evidence:

```
## UI Review — <date/branch>

### Violations
- T1  src/components/Foo/Foo.module.css:42  var(--missing) has no definition
- L3  390×844  body scrolls (scrollHeight 920 > innerHeight 844) — stray scrollbar
- Z2  390×844  zoom control still visible with the Overlay panel open  [screenshot]

### Confirm intended (tolerated)
- T1(warn)  Bar.module.css:5  var(--x, 8px) — undefined but has a fallback

### Pass
- L1 header padding, L2 no overflow, L4 no dead band, P1 drawer chrome parity, …

Summary: N violations, M to confirm, across 2 viewports.
```

End with the one-line summary count.

## Guard rails

- **Never edit code.** Report only.
- **Cite the contract, don't re-derive it.** Every finding references a rule ID from
  `docs/design/mobile-ui-contract.md`; that doc is canonical, this skill is the runner.
- **Both viewports, every run** (390×844 and 768×1024) for the runtime pass.
- **Token-frugal:** lead with `preview_eval`/`preview_inspect`/`preview_snapshot`; screenshot
  only to evidence a confirmed violation.
