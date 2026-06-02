# Mobile Song Cards Fields Draft Plan

> **SUPERSEDED** — Song card field pairing is fully covered by Task 2 of the detailed plan:
> `docs/superpowers/plans/2026-06-01-mobile-song-progression-layout.md`
>
> Use that plan for execution. This draft is kept for reference only.

**Goal:** Use mobile width more efficiently in Song cards by pairing related fields while preserving 44px touch targets.

**Related detailed plan:** `docs/superpowers/plans/2026-06-01-mobile-song-progression-layout.md`

## Scope

- Focus on Preset, Key, Time, and Backing Track card field layout.
- Do not change progression card header or chord editor in this slice.
- Keep the existing Song tab.

## Likely Files

- `src/components/SongControls/SongControls.tsx`
- `src/components/SongControls/SongControls.module.css`
- `src/components/SongControls/BackingTrackControls.tsx`
- `src/components/SongControls/BackingTrackControls.module.css`
- `src/components/SongControls/SongControls.test.tsx`
- `e2e/app-mobile.visual.spec.ts`

## Tasks

- [ ] Identify fields that should pair on mobile: root/scale, time signature/tempo, and backing-track controls with similar widths.
- [ ] Add local CSS hooks/classes for paired mobile grids where existing `PropGrid` behavior is too blunt.
- [ ] Keep full-width controls where option text needs the room.
- [ ] Add a SongControls structure test for paired-grid hooks.
- [ ] Run SongControls and BackingTrackControls tests.
- [ ] Run the mobile Song tab visual snapshot.
- [ ] Commit with `fix(mobile): pair song card controls`.

## Acceptance

- Root and scale share a row without clipping.
- Time signature and tempo share a row without clipping.
- No paired control falls below mobile touch target size.

