# Mobile Progression Card Actions Draft Plan

> **SUPERSEDED** — Progression card action compaction is fully covered by Task 3 of the detailed plan:
> `docs/superpowers/plans/2026-06-01-mobile-song-progression-layout.md`
>
> Use that plan for execution. This draft is kept for reference only.

**Goal:** Keep progression card title and actions compact on mobile without adding a wasteful extra header row.

**Related detailed plan:** `docs/superpowers/plans/2026-06-01-mobile-song-progression-layout.md`

## Scope

- Focus only on the progression card header and action toolbar.
- Preserve locked playback/inert behavior.
- Do not change chord list/editor layout in this slice.

## Likely Files

- `src/components/Inspector/InspectorCard.module.css`
- `src/components/Inspector/InspectorCard.test.tsx`
- `src/components/SongControls/SongControls.module.css`
- `src/components/SongControls/SongControls.test.tsx`
- `e2e/app-mobile.visual.spec.ts`

## Tasks

- [ ] Add or update test coverage that locked card actions remain inert.
- [ ] Keep card header actions aligned beside the title on mobile where space allows.
- [ ] Hide text labels visually for compact toolbar buttons while keeping accessible names.
- [ ] Remove or collapse decorative toolbar dividers on mobile.
- [ ] Run InspectorCard and SongControls tests.
- [ ] Run mobile progression tab visual snapshot.
- [ ] Commit with `fix(mobile): compact progression card actions`.

## Acceptance

- Progression card actions do not force a separate title/action row on `390x844`.
- Actions remain discoverable and tappable.
- Locked state still disables editing actions.

