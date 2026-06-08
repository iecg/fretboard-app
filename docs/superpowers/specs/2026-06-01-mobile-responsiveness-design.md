# Mobile Responsiveness Design

## Context

The `mobile-responsiveness` branch is based on current `main` and includes `Standardize control sizes (#505)`. That work is the baseline for this spec: controls use the shared `--control-height` token, with mobile viewports receiving 44px touch targets.

The current mobile issues are spread across several user-facing surfaces:

- Overlay tab dropdowns can open underneath the fixed bottom tabs.
- The progression track compresses longer progressions until they are hard to read.
- The app header and transport row are too dense for mobile.
- Song controls use mobile space inefficiently.
- The progression card takes unnecessary vertical space and its editor overlaps the chord list.
- The fretboard has a right-edge shadow or paint bleed regression.

The canonical responsive matrix is already documented in layout and visual tests. This work should optimize for `390x844` portrait as the primary mobile target, use `375x667` portrait as the compact-height guardrail, and preserve the existing `667x375` mobile landscape portrait-lock behavior.

## Goals

- Break the work into self-contained, shippable tasks that can be handled independently or sequentially.
- Keep each task focused on one visible mobile problem with clear acceptance criteria.
- Prefer shared fixes only when the underlying problem is in shared infrastructure.
- Avoid adding a new Song tab unless the Song tab remains too dense after the card and editor fixes.
- Preserve desktop and tablet behavior unless a task explicitly touches a shared primitive.

## Non-Goals

- Do not redesign the full visual language of the app.
- Do not replace the existing Inspector tab model up front.
- Do not introduce a broad responsive design-system refactor.
- Do not change music/progression state behavior except where a UI task requires clearer selection or editing flow.

## Approach

Use a surface-by-surface plan with a "shared cause, local surface" rule:

- If a bug originates in a shared primitive, fix the primitive once and verify the affected surfaces. Dropdown safe-zone behavior belongs in the Radix select/dropdown wrappers, not in a one-off Overlay control.
- If a bug originates in a local composition, fix the local component and CSS. Song card row packing and progression editor stacking belong in `SongControls`.
- If a bug is a regression, isolate it and add targeted verification. The fretboard right-edge shadow should not be mixed with header or Song tab work.

Tasks should include likely files, implementation notes, user-visible acceptance criteria, and verification steps. A task is complete when its surface works on `390x844` and does not regress `375x667` compact portrait.

## Task Units

### 1. Shared Dropdown Safe Zone

**Goal:** Dropdown menus on mobile must stay usable above the fixed bottom tab bar.

**Likely files:**

- `src/components/LabeledSelect/LabeledSelect.tsx`
- `src/components/LabeledSelect/LabeledSelect.module.css`
- `src/components/PresetMenu/PresetMenu.tsx`
- `src/components/PresetMenu/PresetMenu.module.css`
- Existing Overlay/Song visual specs as verification targets

**Implementation notes:**

- Use Radix positioning options and CSS custom properties where possible.
- Account for `env(safe-area-inset-bottom)` and the fixed bottom tab height.
- Allow menus to flip upward when there is not enough room below.
- Ensure long menus scroll internally instead of extending under the bottom tabs.
- Apply the behavior to both select menus and dropdown menus where they can appear near the bottom of the mobile viewport.

**Acceptance criteria:**

- On `390x844`, opening the Overlay voicing dropdown does not render underneath the bottom tabs.
- On `375x667`, long dropdowns remain scrollable and selectable.
- Desktop dropdown sizing and alignment remain visually unchanged.

**Verification:**

- Add or update Playwright coverage around the Overlay voicing dropdown. If direct dropdown geometry is not stable enough for screenshot assertions, add a DOM geometry assertion that the dropdown bottom stays above the bottom tab bar.
- Run affected component tests and relevant mobile visual snapshots.

### 2. Progression Track Long-Progression Behavior

**Goal:** Progressions longer than four chords remain readable and operable on mobile.

**Likely files:**

- `src/components/ProgressionTrack/ProgressionTrack.tsx`
- `src/components/ProgressionTrack/ProgressionTrack.module.css`
- `src/components/ProgressionTrack/hooks/buildTimelineViewModel.ts`
- `src/components/ProgressionTrack/*.test.tsx`
- `e2e/progression.visual.spec.ts`

**Implementation notes:**

- Prefer a horizontal-scroll or minimum-block-width model on mobile.
- Preserve ruler, block, and playhead alignment. The playhead math must continue to reflect the full progression timeline.
- Avoid shrinking chord labels to unreadable sizes.
- Keep active chord selection reachable without requiring precise taps on tiny blocks.

**Acceptance criteria:**

- A progression with more than four chords does not squash blocks below usable widths on `390x844`.
- The active chord and playhead remain aligned with the timeline.
- Horizontal overflow, if used, is intentional and contained.

**Verification:**

- Add a long-progression fixture or visual state.
- Run progression unit tests and the mobile progression visual test.

### 3. Mobile App Header Actions

**Goal:** Header utility actions must be touch-sized and fit cleanly beside the brand on mobile.

**Likely files:**

- `src/components/AppHeader/AppHeader.tsx`
- `src/components/AppHeader/AppHeader.module.css`
- `src/components/AppHeader/AppHeader.test.tsx`
- Header action composition in `src/App.tsx`

**Implementation notes:**

- Build on the standardized `--control-height` baseline.
- Keep the first mobile header row focused on brand plus utility actions.
- Avoid tiny icon-only targets and clipped action groups.
- Preserve desktop and tablet header layout.

**Acceptance criteria:**

- On `390x844`, brand and utility actions fit without overlap or horizontal clipping.
- Header action buttons meet the mobile touch target size.
- Header does not consume excessive vertical height before the transport row.

**Verification:**

- Update or add header layout assertions.
- Run mobile app visual snapshots.

### 4. Mobile Header Transport

**Goal:** The play/stop controls, position, tempo, and scale readouts should be usable without making the mobile header too wide.

**Likely files:**

- `src/components/HeaderTransportCluster/HeaderTransportCluster.tsx`
- `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css`
- `src/components/TransportBar/TransportBar.tsx`
- `src/components/TransportBar/TransportBar.module.css`
- `src/components/HeaderTransportCluster/*.test.tsx`

**Implementation notes:**

- Treat the transport as the second mobile header row.
- Prioritize touch-sized play/stop controls.
- Make position, tempo, and scale readouts compact enough to scan but not so wide that they crowd transport actions.
- Consider abbreviated labels or row wrapping only if readability remains clear.

**Acceptance criteria:**

- On `390x844`, transport controls are touch-sized and the row does not clip.
- Tempo and scale readouts remain legible.
- On `375x667`, the transport does not dominate the entire first viewport.

**Verification:**

- Run header transport unit tests.
- Run app mobile visual snapshots in dark and light mode.

### 5. Song Cards Responsive Fields

**Goal:** Song tab cards should use mobile width efficiently while preserving touch targets.

**Likely files:**

- `src/components/SongControls/SongControls.tsx`
- `src/components/SongControls/SongControls.module.css`
- `src/components/Inspector/InspectorGrid.module.css`
- `src/components/SongControls/BackingTrackControls.*`
- `src/components/SongControls/SongControls.test.tsx`

**Implementation notes:**

- Keep full-width controls where full width improves selection.
- Allow related controls to share a row where they naturally pair: key root plus scale, time signature plus tempo, and similar backing-track pairs.
- Avoid forcing every mobile field to full width when two controls can fit comfortably at 44px height.
- Keep labels readable and avoid text overflow inside controls.

**Acceptance criteria:**

- Key root and scale can share a row on mobile without clipping.
- Time signature and tempo can share a row on mobile without clipping.
- Backing-track controls are reviewed and paired where sensible.
- No control becomes smaller than the mobile touch target.

**Verification:**

- Add focused SongControls layout tests for the mobile pairing rules, or document why the behavior is covered by visual regression instead.
- Run mobile Song/progression visual snapshots.

### 6. Progression Card Header And Actions

**Goal:** The progression card title and actions should not waste a full extra row on mobile.

**Likely files:**

- `src/components/Inspector/InspectorCard.tsx`
- `src/components/Inspector/InspectorCard.module.css`
- `src/components/SongControls/SongControls.tsx`
- `src/components/SongControls/SongControls.module.css`
- `src/components/Inspector/InspectorCard.test.tsx`

**Implementation notes:**

- Keep the title and common actions on one compact header where possible.
- If the full action set cannot fit on the smallest mobile target, use a compact action presentation instead of pushing all actions into an always-visible second row.
- Preserve locked-state behavior and `inert` handling.

**Acceptance criteria:**

- On `390x844`, progression card actions do not force an unnecessary separate title/action row.
- Actions remain discoverable and tappable.
- Locked playback state still disables actions correctly.

**Verification:**

- Run InspectorCard and SongControls tests.
- Run mobile progression visual snapshots.

### 7. Progression Master-Detail Editor

**Goal:** The chord list and chord editing details must not overlap and must both remain usable on mobile.

**Likely files:**

- `src/components/SongControls/SongControls.tsx`
- `src/components/SongControls/SongControls.module.css`
- `src/components/SongControls/ProgressionStepList.tsx`
- `src/components/SongControls/ProgressionStepList.module.css`
- `src/components/SongControls/ProgressionStepList.test.tsx`

**Implementation notes:**

- Prefer a single-column mobile composition: chord list first, editor below.
- Keep the selected chord identity clear.
- Preserve next/previous chord navigation if it remains useful.
- Avoid absolute positioning or flex minimums that cause list/editor overlap.
- Ensure editor controls wrap into readable rows on `375x667`.

**Acceptance criteria:**

- On `390x844`, the chord list and editor do not overlap.
- Selecting a chord updates the editor without moving controls into an unusable position.
- On `375x667`, the editor remains scrollable and all fields are reachable.

**Verification:**

- Add a mobile layout regression test for list/editor non-overlap. If jsdom cannot represent the needed geometry, cover the behavior with a Playwright DOM geometry assertion.
- Run ProgressionStepList and SongControls tests.
- Run mobile progression visual snapshots.

### 8. Fretboard Right-Edge Shadow Regression

**Goal:** Remove the right-edge shadow or paint bleed around the fretboard.

**Likely files:**

- `src/components/Fretboard/Fretboard.module.css`
- `src/components/Fretboard/Fretboard.tsx`
- `src/components/FretboardSVG/FretboardSVG.module.css`
- `src/components/FretboardSVG/FretboardSVG.tsx`
- Fretboard visual specs

**Implementation notes:**

- Isolate whether the artifact comes from wrapper overflow, SVG filter regions, shadow styles, or scroll container painting.
- Keep mobile horizontal fretboard scrolling intact.
- Avoid hiding legitimate fretboard content or chord connector pixels.

**Acceptance criteria:**

- The right side of the fretboard no longer shows the stray shadow on mobile.
- Fretboard scrolling still works on mobile and tablet.
- Desktop fretboard visuals are not degraded.

**Verification:**

- Add or update a visual snapshot focused on the fretboard edge, or add a Playwright screenshot/assertion that captures the affected mobile fretboard region.
- Run relevant Fretboard and FretboardSVG tests.

### 9. Song Tab Density Checkpoint

**Goal:** Decide whether an extra mobile tab is still necessary after the Song tab layout fixes.

**Likely files if needed:**

- `src/components/Inspector/tabs.tsx`
- `src/components/Inspector/Inspector.tsx`
- `src/components/SongControls/SongControls.tsx`
- i18n dictionary files
- Inspector and app mobile tests

**Implementation notes:**

- This is a checkpoint, not a default implementation task.
- First evaluate the Song tab after Tasks 5-7.
- If the tab is still too dense, create a follow-up task to split the content by workflow, such as Song setup vs Progression editing.
- Do not split tabs just to hide layout issues that should be solved locally.

**Acceptance criteria:**

- The decision is documented after reviewing `390x844` and `375x667`.
- If no split is needed, no new tab is added.
- If a split is needed, the follow-up task defines labels, content ownership, and migration/testing requirements.

**Verification:**

- Manual visual review on primary and compact mobile targets.
- Update tests only if a tab split is actually implemented.

**Decision record:** After implementing the Song card pairing, compact progression actions, and stacked progression editor, review the Song tab at `390x844` and `375x667`. If the tab is still too dense, create a separate implementation plan for a new mobile tab. If the tab is usable, keep the existing two-tab Inspector.

## Recommended Order

1. Shared dropdown safe zone.
2. Mobile header actions.
3. Mobile header transport.
4. Progression track long-progression behavior.
5. Song cards responsive fields.
6. Progression card header/actions.
7. Progression master-detail editor.
8. Fretboard right-edge shadow regression.
9. Song tab density checkpoint.

The order balances visible pain points with dependency management. Tasks 5-7 should finish before the density checkpoint. The fretboard regression is isolated and can be handled any time.

## Testing Strategy

Use the existing test layers:

- Unit/component tests for state-preserving layout behavior and locked/disabled controls.
- CSS module tests where the project already uses them for token or responsive rules.
- Playwright visual tests for mobile surfaces at `390x844`.
- Targeted compact checks at `375x667` for layout overlap and reachability.
- Existing mobile landscape test at `667x375` to preserve the portrait-lock behavior.

Each implementation task should name the smallest verification set that proves its own acceptance criteria. Full visual snapshot refreshes should happen only when the task intentionally changes captured surfaces.

## Success Criteria

The mobile UI is acceptable when:

- Overlay dropdowns stay above the bottom tabs or scroll within the safe area.
- Long progressions remain readable and selectable.
- Header actions and transport controls are touch-sized and not clipped.
- Song cards use mobile space efficiently without shrinking controls below 44px.
- The progression card header is compact and actions remain accessible.
- The progression chord list and editor do not overlap.
- The fretboard right-edge artifact is gone.
- The Song tab is reviewed after fixes, and an extra tab is added only if the remaining density justifies it.
