# Mobile Progression Master Detail Draft Plan

> **SUPERSEDED** — Progression master-detail stacking is fully covered by Task 4 of the detailed plan:
> `docs/superpowers/plans/2026-06-01-mobile-song-progression-layout.md`
>
> Use that plan for execution. This draft is kept for reference only.

**Goal:** Prevent the progression chord list and chord editing detail panel from overlapping on mobile.

**Related detailed plan:** `docs/superpowers/plans/2026-06-01-mobile-song-progression-layout.md`

## Scope

- Focus on the progression list/editor body inside the progression card.
- Preserve chord selection and previous/next editor navigation.
- Do not add a new tab in this slice.

## Likely Files

- `src/components/SongControls/SongControls.module.css`
- `src/components/SongControls/SongControls.tsx`
- `src/components/SongControls/ProgressionStepList.tsx`
- `src/components/SongControls/ProgressionStepList.module.css`
- `src/components/SongControls/ProgressionStepList.test.tsx`
- `e2e/responsive.spec.ts`

## Tasks

- [ ] Add mobile geometry coverage for chord list/editor non-overlap.
- [ ] Force `.progression-master-detail` into a single-column composition on mobile.
- [ ] Let editor panel width shrink to the viewport with `min-width: 0`.
- [ ] Wrap duration and quality rows cleanly at `375x667`.
- [ ] Run ProgressionStepList and SongControls tests.
- [ ] Run focused e2e non-overlap test.
- [ ] Commit with `fix(mobile): stack progression editor below chord list`.

## Acceptance

- Chord list and editor do not overlap on `390x844`.
- All editor fields remain reachable on `375x667`.
- Selecting a chord updates the editor without layout breakage.

