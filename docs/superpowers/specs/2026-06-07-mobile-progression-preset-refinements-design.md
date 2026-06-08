# Mobile Progression & Preset Refinements Design

## Context

A follow-up to the mobile responsiveness sweep ([2026-06-01-mobile-responsiveness-design.md](2026-06-01-mobile-responsiveness-design.md)). After shipping the first round (dropdown safe zone, header/transport, progression track scroll, song layout, fretboard edge), four mobile defects remain on the Song tab and progression surfaces. Primary mobile target is `390x844` portrait; `375x667` is the compact-height guardrail. Mobile tier is gated by `.app-container[data-layout-tier="mobile"]`.

The four defects:

1. **Progression card editor overlaps the chord list.** The chord editor panel reads as floating over the faded steps list above it.
2. **Timeline track does not follow the current chord.** The mobile timeline is horizontally scrollable, but during playback the active chord scrolls off-screen with no auto-scroll.
3. **Timeline short chords get squished.** Chords with shorter durations (e.g. 1-bar chords after 2-bar chords) fall below readable width.
4. **Preset menu overflows off-screen.** Category submenus open sideways and run past the viewport edge on narrow phones.

## Goals

- Eliminate the progression card list/editor overlap on mobile with a single-column, no-nested-scroll layout.
- Keep the active chord visible in the timeline during playback and on selection, with minimal, touch-respecting motion.
- Guarantee every timeline block meets a readable minimum width while preserving ruler/playhead/percent alignment.
- Make the preset menu structurally incapable of horizontal overflow on mobile, using Radix-native primitives.
- Preserve desktop and tablet behavior. Each change is mobile-tier gated or additive.

## Non-Goals

- No redesign of the desktop progression card, timeline, or preset menu.
- No change to progression/music/playback state semantics.
- No new UI dependency. Preset menu stays on Radix `DropdownMenu`.
- No change to the Beat/Bar duration model or the playhead timing math.

## Approach

Surface-by-surface, "shared cause, local surface": each defect is fixed in the component that owns it, mobile-tier gated where the desktop behavior must be preserved.

---

### 1. Progression card: collapse master-detail to single-column flow

**Root cause.** `src/components/SongControls/SongControls.module.css` already stacks `.progression-master-detail` into a column on mobile and makes `.editor-panel` full width (lines ~503-513). The remaining defect is in the chord list: `src/components/SongControls/ProgressionStepList.module.css` `.list` keeps `max-height: 17rem; overflow-y: auto` on all tiers (lines ~74-85), plus scroll-fade mask pseudo-elements (`.col` `position: relative` + absolutely-positioned fades, lines ~43-55). On mobile this produces a small nested scroll window (~5-6 rows) with top/bottom fades, sitting inside the already-scrolling inspector. The cramped nested region plus fade masks reads as the editor "overlapping" the list.

**Fix.** Add mobile-tier rules in `ProgressionStepList.module.css`:

- Remove the inner scroll cap: `.list { max-height: none; overflow-y: visible; }` under `:global(.app-container[data-layout-tier="mobile"])`, so the full list flows naturally and the editor sits cleanly below it.
- Neutralize the scroll-fade masks on mobile (the fades exist only to hint at inner-scroll overflow, which no longer exists): hide the fade pseudo-elements at the mobile tier.

The result is a single natural-flow column: full list → editor below → inspector page scroll. No nested scroll region.

**Rationale.** Apple HIG and Material both collapse master-detail to a single stack on compact width, and nested scroll-within-scroll is a documented mobile anti-pattern (scroll trapping). This is the lowest-risk fix and adds no new state.

**Tradeoff.** The card grows taller with long progressions; the inspector scroll absorbs this, which is the intended mobile behavior.

**Acceptance criteria.**

- On `390x844`, the chord list shows all steps without an inner scrollbar, and the editor panel sits fully below the list with no visual overlap or fade collision.
- On `375x667`, the list and editor remain reachable via inspector scroll; no field is clipped.
- Desktop and tablet keep the bounded `max-height: 17rem` scroll list and fades unchanged.

**Verification.** Extend the existing mobile overlap geometry guard in `e2e/responsive.spec.ts` ("keeps mobile progression chord list and editor from overlapping") to also assert the list has no inner scroll on mobile (its rendered height is not capped at 17rem when content exceeds it), or add a focused assertion. Run the mobile Song visual snapshot.

---

### 2. Timeline track: auto-scroll the active chord into view

**Behavior.** Minimal "keep in view." Scroll the timeline's horizontal scroll container only when the active block lies outside the visible x-range, moving just enough to bring it into view with a small lead margin (a fraction of the container width, so the active chord is not flush against the edge). Triggers on:

- Playback advance (active step index changes while playing).
- Chord selection in the editor (active step index changes while not playing).

**Touch yield.** When the user manually scrolls the track, suspend auto-scroll until the next index change originating from playback or a new selection. Implemented with a "user-scrolled" flag set on manual scroll and cleared when the active index next changes.

**Mechanics.**

- Scroll container: the mobile-scrollable `.track` element (`overflow-x: auto` added in the prior sweep). Add a `ref` to it in `src/components/ProgressionTrack/ProgressionTrack.tsx`.
- Active index source: the existing `displayedStepIndex` derivation (`fastDisplayedStepIndexPrimitiveAtom` when playing, else `activeProgressionStepIndexAtom`), as used by `hooks/useTimelineViewModel.ts`.
- Active block geometry: resolve the active block's offset/width. Prefer a data attribute or ref keyed by step index on `ProgressionBlock`, or compute from the block's known `startPercent`/`widthPercent` against the scrollable content width. Avoid `scrollIntoView` on the element if it would also scroll ancestors vertically; use `container.scrollTo({ left, behavior })` computed from the block rect vs container rect.
- Encapsulate in a `useTimelineAutoScroll` hook taking the container ref, active index, playing flag, and block locator; returns nothing (side-effecting effect).

**Reduced motion.** When `prefers-reduced-motion: reduce`, use an instant jump (`behavior: "auto"`) instead of smooth scroll.

**Acceptance criteria.**

- On `390x844`, with a progression long enough to overflow the track, starting playback keeps the active chord visible; as playback advances past the right edge, the track scrolls to reveal the new active chord with lead margin.
- Selecting a chord in the editor brings its block into view if off-screen.
- After the user manually scrolls the track, auto-scroll does not fight the user until the active index next changes.
- Reduced-motion users get an instant scroll, not an animated one.
- Desktop/tablet (non-scrolling track) behavior is unaffected (no-op when there is no horizontal overflow).

**Verification.** Unit-test `useTimelineAutoScroll` with a mocked container (jsdom: assert `scrollTo`/`scrollLeft` is called with the expected direction when the active block is out of range, and not called when in range or when the user-scrolled flag is set). Add a Playwright check at `390x844` that advances playback and asserts the active block's rect is within the track's visible x-range.

---

### 2b. Timeline track: stop short chords from squishing

**Root cause.** Blocks are width-weighted by duration: `ProgressionBlock` uses `left: startPercent%` and `width: calc(widthPercent% - 3px)`, where `widthPercent = durationBars / totalBars * 100`. The prior sweep set the mobile `.timeline` min-width from chord count: `min-width: max(100%, calc(var(--mobile-min-chord-count, 1) * 5.25rem))`. Chord count assumes equal per-chord width, but duration weighting means a 1-bar chord gets half the width of a 2-bar chord. When the timeline is sized for the chord count, the shortest-duration blocks fall below readable width.

**Fix.** Drive the mobile timeline min-width from the **shortest block duration** so the smallest block hits a readable minimum and all longer blocks scale up proportionally:

```
timelineMinWidthRem = (totalBarsForDisplay / shortestDurationBars) * MIN_BLOCK_REM
```

- `totalBarsForDisplay` and each step's duration (in bars, accounting for the Beat/Bar unit) are already available where `ProgressionTrack.tsx` builds the timeline style object.
- Compute `shortestDurationBars` as the minimum per-step duration in bars (sub-bar Beat durations included, so beat-length chords are covered).
- `MIN_BLOCK_REM` is a named constant (the readable floor for the shortest block; tuned to fit a Roman numeral + name + "N BAR" label, on the order of the current 5.25rem).
- Expose the computed width as a CSS variable on the timeline (e.g. `--mobile-timeline-min-width`) and set the mobile `.timeline` `min-width: max(100%, var(--mobile-timeline-min-width))`.
- Remove the now-superseded `--mobile-min-chord-count` variable and its CSS rule (and update/replace its unit + CSS-module tests).

**Alignment safety.** Only the total timeline width scales; relative block positions/widths remain percentages of that width, so ruler, playhead, and block alignment are preserved exactly. Per-block `min-width` is explicitly rejected: blocks are absolutely positioned with percent widths, so a min-width would exceed a block's time slot and overlap neighbors, breaking playhead alignment.

**Acceptance criteria.**

- On `390x844`, a progression mixing 2-bar and 1-bar chords renders every block at or above the readable minimum; no block is visibly squished.
- The ruler, playhead, and blocks stay aligned during playback (the playhead crosses each block boundary at the correct time).
- Short/compact progressions (total content narrower than the viewport) still fill the width via the `max(100%, …)` floor and do not over-stretch.

**Verification.** Update `ProgressionTrack.test.tsx` and `ProgressionTrack.module.css.test.ts` to cover the new shortest-duration-driven width variable (replacing the `--mobile-min-chord-count` assertions). Update or add the long-progression mobile visual state to include mixed durations and confirm the shortest blocks are legible.

---

### 3. Preset menu: flatten category submenus on mobile

**Root cause.** In `src/components/PresetMenu/PresetMenu.tsx`, each category renders as a `DropdownMenu.Sub` with `SubTrigger` + `SubContent` that opens sideways (`sideOffset={2} alignOffset={-4}`). On a `390px` viewport there is no room on either side for a fly-out, so the submenu runs off-screen. Vertical safe-zone handling is already in place: `getCollisionPadding()` is wired into `collisionPadding` on both `Content` and `SubContent`, and `.preset-menu-content` already caps `max-width: min(90vw, 22rem)` and `max-height: min(60vh, 480px)`.

**Fix.** On mobile, render categories inline instead of as fly-outs, using the exact flat pattern the suggestion groups already use (`DropdownMenu.Group` + `DropdownMenu.Label` + `MenuOption` items), inside the single scrollable `Content`. With no sideways submenus, horizontal overflow is structurally impossible. Desktop and tablet keep the `Sub`/`SubTrigger`/`SubContent` fly-outs.

- Pass the layout tier into `PresetMenu` as a presentational prop (e.g. `compact?: boolean` or `flattenCategories?: boolean`) from `SongControls`, which already subscribes to layout state. `PresetMenu` stays pure and unit-testable; no hook coupling inside the presentational component.
- When `compact` is true, the categories section maps to `DropdownMenu.Group` blocks (label + items) with separators between categories, mirroring the suggestion-group rendering. When false, it maps to the existing `Sub` structure.
- The suggestion groups already render flat; they are unchanged.

**Rationale.** Radix documents `Sub` menus as pointer/desktop navigation; the touch-friendly Radix-native pattern is a flat grouped, scrollable `Content`. This is pure conditional rendering of existing primitives — no new dependency, no custom positioning.

**Acceptance criteria.**

- On `390x844` and `375x667`, opening the preset menu and browsing categories never renders content past the left/right viewport edges; long content scrolls within the capped-height menu.
- All categories and their options remain reachable and selectable; the active option still shows its check indicator.
- Desktop preset menu keeps the category fly-out submenus, unchanged.

**Verification.** Unit-test `PresetMenu` in `compact` mode: categories render as inline groups (no `SubTrigger`), all options present, selection fires `onSelect`. Add a Playwright geometry assertion at `390x844` that the opened preset menu content's left/right stay within the viewport (reuse the dropdown safe-zone pattern from the prior sweep).

---

## File Touchpoints

- `src/components/SongControls/ProgressionStepList.module.css` — mobile `.list` scroll removal, fade-mask neutralization.
- `e2e/responsive.spec.ts` — extend overlap guard; add timeline active-block in-view check and preset-menu horizontal-bounds check.
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — track container ref; shortest-duration timeline width computation; wire `useTimelineAutoScroll`.
- `src/components/ProgressionTrack/hooks/useTimelineAutoScroll.ts` — new hook (auto-scroll effect + touch-yield flag).
- `src/components/ProgressionTrack/ProgressionTrack.module.css` — replace `--mobile-min-chord-count` rule with `--mobile-timeline-min-width`.
- `src/components/ProgressionTrack/ProgressionBlock.tsx` — optional step-index data attribute/ref for block geometry lookup.
- `src/components/ProgressionTrack/ProgressionTrack.test.tsx`, `ProgressionTrack.module.css.test.ts` — update width-variable coverage.
- `src/components/PresetMenu/PresetMenu.tsx` — `compact` prop; conditional flat vs sub category rendering.
- `src/components/PresetMenu/PresetMenu.test.tsx` — compact-mode coverage.
- `src/components/SongControls/SongControls.tsx` — pass `compact` (layout tier) to `PresetMenu`.
- `e2e/app-mobile.visual.spec.ts` / `e2e/progression.visual.spec.ts` — refreshed/added mobile visual states.

## Testing Strategy

- Unit/component (vitest + Testing Library): `useTimelineAutoScroll` logic, `PresetMenu` compact rendering, progression track width variable, CSS-module rule assertions.
- Playwright geometry guards at `390x844` (and `375x667` where height matters): list/editor non-overlap and no inner-scroll, active block in-view after playback advance, preset menu content within horizontal viewport bounds.
- Visual regression for the mobile Song tab and the mobile long/mixed-duration progression track.
- Respect `prefers-reduced-motion` in the auto-scroll path.

## Success Criteria

- The mobile progression card shows the full chord list with the editor cleanly below it — no nested scroll, no overlap.
- The active chord stays visible in the timeline during playback and on selection, with minimal motion that yields to manual scrolling.
- No timeline block squishes below a readable width, and playhead/ruler alignment is preserved.
- The preset menu cannot overflow horizontally on mobile and remains fully navigable with Radix-native primitives.
- Desktop and tablet behavior for all four surfaces is unchanged.
