# Playback Lock Overlay Design

## Problem

When progression playback is active, the Preset, Key, and Progression cards in
SongControls become locked to prevent edits. The current approach:

1. Replaces the card's `description` text with italic "Pause playback to edit"
   in the header — causing layout shift.
2. Dims the card body to 55% opacity + `cursor: not-allowed`.
3. The hint text is small, easy to miss, and communicates poorly.

## Solution

Replace the inline `lockedHint` text + dimming with an absolutely-positioned
overlay inside each locked card's body. The approach:

- Adds an `overlay?: ReactNode` prop to `InspectorCard`.
- When set, renders a frosted-overlay `<div>` covering the card body entirely.
- The existing `description` text in the header stays untouched — no layout
  shift when locking/unlocking.
- The overlay includes a pause icon + "Pause playback to edit" message,
  centered with backdrop blur.

## Design

### InspectorCard

New optional `overlay` prop:

```ts
export interface InspectorCardProps {
  // …existing props…
  /**
   * Optional overlay rendered inside the card body when the card is locked
   * during playback. Absolutely positioned on top of the body content with
   * backdrop blur. When set, `locked` is still needed for `inert` behavior
   * but the visual treatment shifts from dimming to the overlay.
   */
  overlay?: ReactNode;
}
```

Rendering:

```tsx
<section className={styles.card} data-locked={locked ? "true" : undefined} ...>
  <header>…</header>
  <div className={styles.cardBody} data-locked={locked ? "true" : undefined} inert={locked || undefined}>
    {children}
  </div>
  {overlay ? <div className={styles.cardBodyOverlay}>{overlay}</div> : null}
</section>
```

### SongControls

Three locked cards (Preset, Key, Progression) change from:

```tsx
<InspectorCard locked={editsLocked} lockedHint={t("controls.lockedHint")}>
```

to:

```tsx
<InspectorCard
  locked={editsLocked}
  overlay={editsLocked ? <PlaybackLockOverlay /> : undefined}
>
```

Extract `PlaybackLockOverlay` as a small component renderable inline or in a
shared location — just the pause icon + "Pause playback to edit" text, with
`role="status"` for a11y.

### CSS

New class `.cardBodyOverlay`:

```css
.cardBodyOverlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
}
```

Light theme variant (matching existing light-theme card styles):

```css
:global([data-theme="modern-light"]) .cardBodyOverlay {
  background: rgba(255, 255, 255, 0.5);
  color: inherit;
}
```

The `.cardBody` gets `position: relative` to anchor the overlay.

Existing `card[data-locked="true"] .cardBody` opacity rule removed (no longer
needed — overlay covers instead). Keep `cursor: not-allowed` on body.

Remove `.cardLockedHint` class and related render logic from `InspectorCard`.

### A11y

- Overlay uses `role="status"` + `aria-live="polite"`.
- Body remains `inert={true}` when locked — focus never reaches controls.
- Overlay text is visible and high-contrast in both themes.

### Cards Affected

| Card | Locked? | Gets overlay? |
|---|---|---|
| Preset | Yes | Yes |
| Key | Yes | Yes |
| Progression | Yes | Yes |
| Time | No | No |
| Backing Track | No | No |

### Files Changed

| File | Change |
|---|---|
| `src/components/Inspector/InspectorCard.tsx` | Add `overlay` prop, render overlay div, remove `lockedHint` header logic |
| `src/components/Inspector/InspectorCard.module.css` | Add `.cardBodyOverlay`, remove `.cardLockedHint`, make `.cardBody` position relative, remove opacity dim |
| `src/components/SongControls/SongControls.tsx` | Replace `lockedHint` with `overlay` prop using `PlaybackLockOverlay` |
| `src/components/SongControls/SongControls.module.css` | No changes needed (unless overlay needs positioning) |
| `src/i18n/en.ts` | Keep `lockedHint` key (remove if unused elsewhere) |
| Tests | Update InspectorCard + SongControls tests |

### Edge Cases

- **Overlay on mobile:** Same treatment — overlay covers card body, text scales
  normally.
- **Multiple locked cards:** Each card renders its own overlay independently.
- **Fast toggle:** Entering/exiting playback: overlay mounts/unmounts. No
  animation transitions (keep it simple — instant).
- **Header actions still inert:** The header's action toolbar (Progression's
  Add/Move/Duplicate/Delete buttons) remains `inert` when locked. The overlay
  only covers the body — these buttons are also protected by `inert`.
