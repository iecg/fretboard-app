# Mobile-First UI Overhaul — Design

**Date:** 2026-06-09
**Status:** Approved (brainstorming session)

## Problem

After several rounds of responsive improvements, the mobile UI still reads as "a desktop app adapted to a phone":

- The whole page is one scrolling document. The fretboard — the core canvas — scrolls out of view.
- The desktop DAW transport cluster (play, loop, instrument toggles, metronome, position/tempo/scale readouts) consumes ~280px of top chrome before any content.
- The bottom "tab bar" is not navigation; it swaps an in-flow panel below the fretboard.
- Controls are desktop widgets (full-width labeled dropdowns, small hit targets) stacked vertically.

A Capacitor port for iOS/Android is in progress, so the mobile UI must feel native, not adapted.

## Goals

- Mobile UI that reads and behaves like a native app: fixed app surface, fretboard always visible, controls in a bottom sheet, transport in thumb reach.
- Desktop must not regress. Mobile is the focus; small shared refactors are acceptable when they leave desktop behavior identical.
- No duplicated per-tier components. Shared primitives everywhere; mobile-specific code is structural only.
- Ready for Capacitor: safe-area insets, touch targets, platform pickers.

## Non-Goals

- Landscape mobile layout (explicit follow-up; portrait lock stays for now).
- Desktop or tablet-stacked/desktop-split visual changes.
- New state architecture — existing Jotai atoms remain the source of truth.

## Decisions

| Decision | Choice |
|---|---|
| Interaction model | Fretboard hero + draggable bottom sheet (snap points), fixed non-scrolling shell |
| Transport placement | Sheet peek row doubles as mini-player transport (Spotify pattern) |
| Orientation | Portrait-first; landscape is a follow-up project |
| Scope | Main screen + secondary surfaces (Settings, Help, banners) |
| Implementation | Separate mobile *shell*, shared control internals; sheet via `vaul` |

## Component Sharing Policy

This is a hard constraint of the design:

- The **only** mobile-specific components are structural: the shell, the sheet wrapper, and the compact header arrangement.
- Everything with behavior — `ViewTab`, `SongControls`, `ProgressionTrack`, `StepperControl`, `ToggleBar`, `LabeledSelect`, transport buttons, settings/help content — stays single-source.
- Per-tier adaptation happens via CSS gated on `data-layout-tier` (or container queries), never via a forked `MobileX` twin component.
- If a control cannot adapt with CSS alone, refactor the one component to accept a variant prop. Do not copy it.

## Architecture

### Shell selection

`App.tsx` renders `MobileShell` when `layout.tier === "mobile"`, otherwise the existing `MainLayoutWrapper`. Desktop and tablet-stacked/desktop trees are byte-for-byte unchanged.

`MobileShell` (`src/components/MobileShell/`) is a fixed `100dvh`, non-scrolling surface with five regions:

1. **Compact header** — brand mark + a single overflow menu collapsing theme, mute, settings, and help. The four round icon buttons disappear on mobile. The menu items reuse the same action handlers as the desktop buttons (extracted so both surfaces share them).
2. **Progression chip strip** — the existing `ProgressionTrack` restyled slimmer. Tap chord = jump playhead, behavior unchanged.
3. **Fretboard stage** — fills all remaining height. `stringRowPx` for mobile may grow since ~200px of chrome is reclaimed.
4. **Bottom sheet** — see below.
5. **Safe areas** — `env(safe-area-inset-*)` padding baked into the shell for the Capacitor port.

### Bottom sheet

Built with `vaul` (new dependency; Radix-ecosystem drawer used by shadcn). Vaul supplies drag physics, velocity snapping, and the scroll-inside-sheet conflict resolution.

- **Snap points:** peek ~96px, half ~45%, full ~85%. At full, a slim fretboard preview strip remains visible.
- **Peek row = transport mini-player:** play/pause, key readout, tempo readout, loop toggle. Visible at every snap point, pinned at the sheet top when expanded.
- **Expanded content:** Overlay/Song tabs (existing two-tab structure and keep-alive mounting preserved), with the tab bar inside the sheet. Tab bodies reuse `ViewTab` and `SongControls`.
- **Full transport set** (instrument toggles, metronome, time signature, position readout) lives in the expanded sheet — transport row pinned above the tabs, song-level readouts in the Song tab. These reuse the existing `HeaderTransportCluster` buttons restyled.
- **No custom floating dropdowns inside the sheet:** option pickers either use the platform-native `<select>` picker (OS wheel/sheet) or render as inline expanding rows / nested sheets. Styled floating menus are the one desktop idiom explicitly banned on mobile.
- **State:** one new persisted atom, `mobileSheetSnapAtom`. Sheet content scrolls internally only at the full snap; otherwise drags move the sheet.

### Touch pass on shared controls (CSS-level)

- Minimum 44px hit targets throughout the sheet.
- `LabeledSelect` on mobile leans into the native `<select>` picker rather than styled dropdowns.
- Steppers get larger +/- zones.

### Tablet-split

`tablet-split` currently reuses the mobile bottom-tab Inspector. It is a touch context, so it adopts the bottom sheet as well. This lets the old bottom-tab rendering path be deleted instead of orphaned. Other tablet/desktop variants are untouched.

## Secondary Surfaces

- **Settings & Help:** on mobile, render as full-height modal sheets (vaul, single snap, swipe-down dismiss). Inner content components unchanged; only the wrapper is tier-dependent.
- **Banners** (audio error, output wedged): positioned above the sheet and inside safe-area insets.
- **Rotate overlay:** kept (portrait-first), but moved from global `App.css` into the mobile shell as an explicit mobile concern.

## Cleanup

After the shell lands:

- Delete the `placement="bottom"` Inspector mode and the `mobile-tabs-shell` wrapper in `MainLayoutWrapper`.
- Re-derive layout-resolver flags (`showMobileTabs`, tablet-split special cases) to match the new world. Desktop variant logic unchanged.
- One rendering path per surface; no zombie branches.

## Testing

- **Unit/component (vitest):** `MobileShell` rendering per tier, snap atom behavior, Inspector tests updated for placement-prop removal.
- **Visual e2e (Playwright):** the `app-mobile` suite gets fully refreshed snapshots (all current ones are expected to change); new scenarios cover sheet at peek/half/full (via drag simulation or snap-atom seeding).
- **Manual:** browser preview at 375×812 and Capacitor shells on device.
- `pnpm run lint`, `test`, `build` locally before PR, per repo policy.

## Risks

- **Vaul + React 19 / React Compiler interplay:** validate early with a spike; if vaul misbehaves under the compiler, opt the sheet component out with `'use no memo'` per repo convention.
- **Fretboard height changes** may shift SVG layout-cache assumptions; verify `fretboardLayoutCache` handles the taller stage.
- **Visual snapshot churn:** large, expected, one-time. Keep the refresh in its own commit for reviewability.

## Follow-ups (out of scope)

- Landscape mobile layout (full-width fretboard, side controls).
- Replacing native `<select>` pickers with custom sheet pickers if the platform picker feels insufficient.
