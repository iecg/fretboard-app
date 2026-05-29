# Playback Lock Redesign — Transport-Mounted Status + Subtle Card Scrim

- **Status:** Approved design, pre-implementation
- **Date:** 2026-05-29
- **Branch:** `playback-lock-overlay`

## Problem

The current playback lock implementation places a centered overlay ("Stop playback to edit") on each locked InspectorCard during playback. This approach has several issues:

1. Repeated overlays feel intrusive and redundant
2. The UI loses its immersive DAW/instrument aesthetic during playback
3. Centered overlay text competes with the fretboard as the visual focus
4. The lock state reads as a hard restriction instead of a natural playback mode
5. Overlay panels flatten the depth and visual hierarchy of the interface
6. Multiple repeated overlays make the app feel broken instead of intentionally locked

## Design Goals

- Preserve the immersive synth/DAW/instrument aesthetic
- Make playback feel like an active mode, not an error or restriction
- Communicate edit-lock state globally rather than repeating it per panel
- Maintain visual depth, glow, layering, and spatial continuity
- Keep focus on the fretboard and playback visualization
- Use subtle motion, transport-state language, and integrated status indicators
- Editable regions should feel "temporarily under transport control" rather than disabled
- Avoid instructional wording (no "Stop playback to edit")
- Avoid generic disabled-form aesthetics

## Chosen Approach: Transport Badge + Card Scrim (Hybrid)

The transition animation is the primary communication mechanism. Cards dim + header lock icons appear while the user watches, making the mode shift feel like an intentional physical event (like hardware synths lighting up when activated). During playback, the dimmed state settles to subtle — the fretboard remains the visual focus — but header lock icons persist as reference. When playback stops, the reverse transition restores the editing state.

## Architecture

### Before

```
TransportBar                 Inspector (Song tab)
  [Play/Stop]                  InspectorCard (Preset)
  [status dot]                   locked={true}
                                 overlay=<Overlay>  ← centered text + backdrop
                                 header: [PRESET] [desc]
                                 body: [content] + overlay div
                               InspectorCard (Key)
                                 locked={true}
                                 overlay=<Overlay>  ← same repeated overlay
                               InspectorCard (Progression)
                                 locked={true}
                                 overlay=<Overlay>  ← same repeated overlay
```

### After

```
TransportBar                 Inspector (Song tab)
  [▶ PLAYING]                  InspectorCard (Preset)
  [Play/Stop]                    locked={true}  ← no overlay prop
                                 header: [PRESET] 🔒 [desc]
                                 body: [content] (opacity 0.75, accent line)
                               InspectorCard (Key)
                                 locked={true}  ← no overlay prop
                                 header: [KEY] 🔒 [desc]
                               InspectorCard (Progression)
                                 locked={true}  ← no overlay prop
                                 header: [PROGRESSION] 🔒 [desc]
```

### Key Changes

| Layer | Change |
|-------|--------|
| `TransportBar.tsx` | "Play" status label → "Playing" when `progressionPlaying` is true; amplified pulse glow |
| `InspectorCard.tsx` | Remove `overlay` prop entirely. Add `<Lock>` icon in header after h3 when `locked` |
| `InspectorCard.module.css` | Remove `.cardBodyOverlay`. Add `data-locked` styles: body opacity 0.75, inset accent box-shadow, lock icon transition |
| `SongControls.tsx` | Delete 3 overlay JSX blocks. Remove `Square` import. `locked` props stay |
| `en.ts` / `es.ts` | Delete `controls.lockedHint` key |
| `SongControls.test.tsx` | Update "locked hint text" test → check for lock icon in header |
| `InspectorCard.test.tsx` | Remove overlay tests. Add lock icon presence test |

## Component Changes

### TransportBar — "PLAYING" Indicator

The existing Play status light in `.statusLights` conditionally changes its label:

```tsx
<span className={styles.statusLabel}>
  {progressionPlaying ? "Playing" : "Play"}
</span>
```

The CSS `text-transform: uppercase` renders this as "PLAYING" / "PLAY". The existing `track-pulse` animation on the active dot remains. A stronger pulse glow is added when `data-active="true"` (the existing class already applies).

No new DOM elements are added to the TransportBar.

### InspectorCard — Lock Treatment

**Header lock icon:** A `<Lock>` icon from lucide-react (size 11) is rendered after the h3, conditionally shown when `locked` is true. It uses `aria-hidden="true"` since the `inert` attribute already communicates lock state to screen readers.

```tsx
// Inside <header>, after <h3>
{locked ? (
  <Lock size={11} className={styles.lockIcon} aria-hidden="true" />
) : null}
```

**Card body scrim:** The `data-locked` attribute (already set by the component) drives:

```css
.cardBody {
  transition: opacity 300ms ease;
}

.card[data-locked="true"] .cardBody {
  opacity: 0.75;
}

.card[data-locked="true"] {
  box-shadow: inset 2px 0 0 0 var(--faceplate-accent);
}

.lockIcon {
  color: var(--faceplate-accent);
  opacity: 0;
  transition: opacity 300ms ease 50ms;
}

.card[data-locked="true"] .lockIcon {
  opacity: 1;
}
```

The 50ms delay on the lock icon transition ensures the body starts dimming before the icon appears — creating a sequential effect.

**No overlay div** is rendered. The `.cardBodyOverlay` class and all its styles are removed.

### SongControls — Cleanup

Delete these patterns (3 occurrences, for Preset, Key, and Progression cards):

```tsx
// Before:
overlay={editsLocked ? (
  <><Square size={16} aria-hidden="true" />{t("controls.lockedHint")}</>
) : undefined}

// After:
// (overlay prop removed entirely)
```

Remove `Square` from the lucide-react import.

### i18n — Remove `lockedHint`

Delete from `en.ts` and `es.ts`:
```
lockedHint: "Stop playback to edit",
lockedHint: "Detén la reproducción para editar",
```

## Transition Behavior

All transitions are CSS-only, 300ms `ease`:

| State Change | Element | Animation | Duration |
|---|---|---|---|
| Playback starts | Card body | opacity 1 → 0.75 | 300ms |
| Playback starts | Lock icon | opacity 0 → 1 (50ms delay) | 300ms |
| Playback starts | Card accent line | box-shadow inset appears | 300ms |
| Playback starts | Transport label | "Play" → "Playing" text swap | Instant |
| Playback stops | All reversed | — | 300ms |

Total transition budget: ~350ms. Feels instantaneous but perceptible. No JS animation libraries required.

## Visual Style

- **Lock icon color:** `var(--faceplate-accent)` — cyan in dark mode (#4de4ff), cyan-teal in light mode (#147088)
- **Body scrim:** `opacity: 0.75` — preserves visual depth and legibility
- **Accent line:** `box-shadow: inset 2px 0 0 0 var(--faceplate-accent)` — thin cyan left-border, no layout shift
- **Transport "PLAYING":** Reuses existing `.statusLight[data-active="true"]` styles + `track-pulse` animation
- **No backdrop blur, no centered text, no overlay divs**

## Light Mode

All tokens are theme-adaptive: `--faceplate-accent` resolves to `#147088` in light mode, providing visible contrast on warm cream card surfaces. Body opacity reduction is theme-agnostic and functions identically in both modes.

## Test Changes

- `InspectorCard.test.tsx`: Remove overlay-related test cases. Add test for lock icon presence when `locked=true`, absence when `locked=false`
- `SongControls.test.tsx`: Replace "surfaces the locked hint text" test with "shows lock icons in card headers during playback" test — check for `.lockIcon` presence in each locked card's header
- `i18n` tests: Remove `lockedHint` key references if tested explicitly

## Out of Scope

- Changes to the ProgressionTrack/playhead visualization
- Changes to the fretboard rendering during playback
- Backing track controls (they remain unlocked during playback)
- Responsive behavior changes (existing layout tiers unaffected)
- Any additions to the playback state machine

## Spec Self-Review

- Placeholders: None. All sections complete.
- Internal consistency: Architecture matches feature descriptions. TransportBar handles global status, InspectorCard handles per-card visual treatment. No overlap.
- Scope: Focused on playback lock state only. No scope creep into transport controls, fretboard, or other features.
- Ambiguity: "Playing" label text will use the existing `text-transform: uppercase` to render as "PLAYING" — matches existing design language. Lock icon reuses `Lock` from lucide-react (confirmed available).
