# Playback Lock Redesign — Transport-Mounted Status + Subtle Card Scrim

- **Status:** Approved design, pre-implementation (revised post-review 2026-05-29)
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

**Static-state communication (when the transition isn't witnessed).** A user who starts playback and *then* switches to the Song tab never sees the transition — they arrive at an already-locked state. For them, the lock is carried by three persistent cues: (1) the global PLAY status dot in the TransportBar (bright cyan + pulsing while playing), (2) the per-card header lock icon, and (3) the inset accent line on each locked card. The 0.75 body opacity is deliberately subtle and is *not* relied on alone to signal "locked."

**Verified — the global indicator is co-visible in every layout tier.** The TransportBar renders inside `HeaderTransportCluster`, which sits in the always-on `AppHeader` (`App.tsx`), independent of the active inspector tab. On the mobile tier the header cluster wraps (`flex-wrap: wrap`) but the `statusLights` are not hidden, so the PLAY status dot remains visible alongside the locked Song-tab cards across mobile / tablet / desktop. No tier shows locked cards without the global indicator.

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
  [● PLAY]  ← dot glows/pulses InspectorCard (Preset)
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
| `TransportBar.tsx` | Status label stays "Play" (no text swap — avoids layout shift); the active dot's pulse glow is amplified to signal playback. Add one sr-only `aria-live` region announcing the global edit-lock state (see A11y below) |
| `InspectorCard.tsx` | Remove `overlay` prop **and its JSDoc** from `InspectorCardProps`. Update the `locked` JSDoc (drop the "paired with `overlay`" sentence). Add `<Lock>` icon in header after h3 when `locked` |
| `InspectorCard.module.css` | Remove `.cardBodyOverlay` **and the `:global([data-theme="modern-light"]) .cardBodyOverlay` rule**. Add `data-locked` styles: body opacity 0.75, inset accent box-shadow (combined with the existing light-mode soft shadow — see CSS below), lock icon transition |
| `SongControls.tsx` | Delete 3 overlay JSX blocks. Remove `Square` import. `locked` props stay |
| `en.ts` / `es.ts` / `types.ts` | Delete `controls.lockedHint` key from **all three** — `types.ts` declares it as required, so the build breaks if the data files drop it without the type |
| `SongControls.test.tsx` | Replace "surfaces the locked hint text" test → assert a lock icon (`.lucide-lock` svg) is present in each locked card's header |
| `InspectorCard.test.tsx` | Remove overlay tests. Add lock icon presence/absence test (query the `.lucide-lock` svg, not the hashed module class) |

## Component Changes

### TransportBar — Playback Indicator

The Play status light label stays the static string "Play" (rendered "PLAY" via the existing `text-transform: uppercase`). It is **not** swapped to "Playing" during playback — widening the label from 4 to 7 characters shifts the surrounding transport layout, and the label is a channel name (like the sibling "LOOP" label), not a live state readout.

Playback is signalled entirely by the status **dot**, which already toggles via `data-active`: stopped = dim/static, playing = bright cyan + pulsing (`track-pulse`) + glow. The only change here is to amplify that glow when `data-active="true"` (the existing class already applies), making the live state read more strongly at a glance.

**Global edit-lock announcement (a11y):** One visually-hidden `aria-live="polite"` region is added so screen-reader users learn that editing is suspended during playback. The status light label is decorative (`statusLabel` is a visual chip, not announced as state), and per the design below the per-card lock icons are `aria-hidden` and the locked card bodies are `inert` (which removes them from the a11y tree but announces nothing). Without this region a keyboard/SR user tabbing through the inspector would find dead, unlabelled controls with no explanation. A single global region — rather than one per card — matches the design goal of communicating lock state globally.

```tsx
<span className={shared["sr-only"]} role="status" aria-live="polite">
  {progressionPlaying ? t("controls.lockedAnnouncement") : ""}
</span>
```

This is the **only** new DOM element in the TransportBar. It replaces the screen-reader affordance previously carried by the per-card overlay's `role="status" aria-live="polite"`. Add a `controls.lockedAnnouncement` key (e.g. EN "Editing locked during playback", ES "Edición bloqueada durante la reproducción") to `en.ts`, `es.ts`, and `types.ts`. (This is a net rename of `lockedHint` from per-card instructional text to a single global status string.)

### InspectorCard — Lock Treatment

**Header lock icon:** A `<Lock>` icon from lucide-react (size 11) is rendered after the h3, conditionally shown when `locked` is true. It is `aria-hidden="true"` — purely a visual cue. The `inert` attribute on the body makes the controls non-focusable and removes them from the a11y tree, but it does **not** announce *why* the region is locked. The screen-reader affordance is carried by the global `aria-live` region in the TransportBar (see above), not by this icon.

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

**Light-mode box-shadow collision.** In light mode `.card` already carries a soft elevation shadow (`box-shadow: 0 1px 4px rgb(42 37 29 / 0.06)` under `:global([data-theme="modern-light"]) .card`). The locked rule above has equal specificity and later source order, so it would *replace* that shadow — the card would lose its elevation while locked. Combine both shadows in a light-mode-specific locked rule so the accent line and the soft shadow coexist:

```css
:global([data-theme="modern-light"]) .card[data-locked="true"] {
  box-shadow:
    inset 2px 0 0 0 var(--faceplate-accent),
    0 1px 4px rgb(42 37 29 / 0.06);
}
```

The 50ms delay on the lock icon transition ensures the body starts dimming before the icon appears — creating a sequential effect.

**No overlay div** is rendered. Remove from the component:
- The `overlay?: ReactNode` field and its JSDoc block from `InspectorCardProps`.
- The `overlay` param from the destructured props and the trailing `{overlay ? (…) : null}` JSX block.
- Update the `locked` JSDoc — drop the trailing "Typically paired with `overlay` to communicate why the card is locked" sentence (no longer true).

And from `InspectorCard.module.css`, remove both the `.cardBodyOverlay` rule and the `:global([data-theme="modern-light"]) .cardBodyOverlay` rule. The `.card[data-locked="true"] .cardHeadActions` cursor rules stay — the Progression card still passes `actions` while locked.

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

### i18n — Replace `lockedHint` with `lockedAnnouncement`

Delete the per-card instructional `lockedHint` key from **all three** i18n files (`en.ts`, `es.ts`, and the `types.ts` interface — it is declared as a required string, so removing it only from the data files breaks `tsc`):
```
lockedHint: "Stop playback to edit",                         // en.ts — delete
lockedHint: "Detén la reproducción para editar",             // es.ts — delete
lockedHint: string;                                          // types.ts — delete
```

Add the global announcement key in the same three files (consumed by the TransportBar `aria-live` region):
```
lockedAnnouncement: "Editing locked during playback",            // en.ts
lockedAnnouncement: "Edición bloqueada durante la reproducción", // es.ts
lockedAnnouncement: string;                                      // types.ts
```

## Transition Behavior

All transitions are CSS-only, 300ms `ease`:

| State Change | Element | Animation | Duration |
|---|---|---|---|
| Playback starts | Card body | opacity 1 → 0.75 | 300ms |
| Playback starts | Lock icon | opacity 0 → 1 (50ms delay) | 300ms |
| Playback starts | Card accent line | box-shadow inset appears | 300ms |
| Playback starts | Transport dot | glow amplifies (label text unchanged) | ~200ms (existing dot transition) |
| Playback stops | All reversed | — | 300ms |

Total transition budget: ~350ms. Feels instantaneous but perceptible. No JS animation libraries required.

## Visual Style

- **Lock icon color:** `var(--faceplate-accent)` — cyan in dark mode (#4de4ff), cyan-teal in light mode (#147088)
- **Body scrim:** `opacity: 0.75` — preserves visual depth and legibility
- **Accent line:** `box-shadow: inset 2px 0 0 0 var(--faceplate-accent)` — thin cyan left-border, no layout shift
- **Transport PLAY dot:** Reuses existing `.statusLight[data-active="true"]` styles + `track-pulse` animation, with an amplified glow; the label text stays "PLAY"
- **No backdrop blur, no centered text, no overlay divs**

## Light Mode

All tokens are theme-adaptive: `--faceplate-accent` resolves to `#147088` in light mode, providing visible contrast on warm cream card surfaces. Body opacity reduction is theme-agnostic and functions identically in both modes.

## Test Changes

- `InspectorCard.test.tsx`: Remove overlay-related test cases (lines ~30–44, ~81). Add a test for lock icon presence when `locked=true` and absence when `locked=false`. **Query the rendered svg via `container.querySelector(".lucide-lock")`, not the CSS-module class** — `styles.lockIcon` is hashed at build time so `.lockIcon` won't match; lucide-react emits `<svg class="lucide lucide-lock">`.
- `SongControls.test.tsx`: Replace the "Progression card surfaces the locked hint text during playback" test (~line 220) with "shows lock icons in card headers during playback" — assert `.lucide-lock` is present within each locked card's header. The existing `data-locked` assertions (lines 189–205, 232–241) stay unchanged.
- TransportBar a11y: add a test asserting the global `aria-live` region renders the `lockedAnnouncement` text when `progressionPlaying` is true and is empty when stopped.
- `i18n` tests: remove `lockedHint` references; add `lockedAnnouncement` if keys are asserted explicitly (e.g. an en/es parity test).

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
- Ambiguity: The transport status label stays "PLAY" (no text swap) — playback is signalled by the amplified dot glow, avoiding a layout shift. Lock icon reuses `Lock` from lucide-react (confirmed available).

### Post-review revisions (2026-05-29)

Addressed in this revision after a code-grounded review:

1. **Build correctness** — `controls.lockedHint` is declared in `src/i18n/types.ts` as a required string; deleting it must include `types.ts`, not just `en.ts`/`es.ts`.
2. **A11y** — `inert` does not announce *why* a region is locked, and the lock icon is `aria-hidden`. Removing the per-card `aria-live` overlay therefore drops the only screen-reader affordance. Restored as a single global `aria-live` region in the TransportBar (`lockedAnnouncement` key), matching the "communicate globally, not per-panel" goal.
3. **Static-state communication** — documented the three persistent cues for users who navigate to the Song tab after playback starts, and **verified** the global PLAY status dot is co-visible with locked cards in every layout tier (header cluster is always rendered; mobile wraps but does not hide it).
4. **CSS** — the locked inset box-shadow collides with the light-mode soft elevation shadow (equal specificity, later source order); added a combined light-mode locked rule so both coexist.
5. **Test selectors** — lock-icon assertions target the lucide `.lucide-lock` svg, not the hashed `.lockIcon` CSS-module class.
6. **Completeness** — explicit removal of the `overlay` prop + JSDoc, the `locked` JSDoc sentence, and the light-mode `.cardBodyOverlay` rule.

- Visual regression: no committed snapshot captures the playing/locked state (the `app-overlays` suite captures only the initial-mount state), so removing the per-card overlay does not require a snapshot refresh.
