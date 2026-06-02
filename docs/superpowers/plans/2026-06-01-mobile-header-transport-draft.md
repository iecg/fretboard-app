# Mobile Header Transport Draft Plan

> **SUPERSEDED** — Transport layout is fully covered by Tasks 3 and 4 of the detailed plan:
> `docs/superpowers/plans/2026-06-01-mobile-header-transport.md`
>
> Use that plan for execution. This draft is kept for reference only.

**Goal:** Make mobile transport controls, position, tempo, and scale readouts readable and tappable without making the header too tall.

**Related detailed plan:** `docs/superpowers/plans/2026-06-01-mobile-header-transport.md`

## Scope

- Touch the second mobile header row only.
- Preserve existing playback state and transport behavior.
- Avoid changing desktop density unless required by shared CSS.

## Likely Files

- `src/components/HeaderTransportCluster/HeaderTransportCluster.module.css`
- `src/components/HeaderTransportCluster/HeaderTransportCluster.test.tsx`
- `src/components/TransportBar/TransportBar.module.css`
- `src/components/TransportBar/TransportBar.test.tsx`
- `e2e/app-mobile.visual.spec.ts`
- `e2e/responsive.spec.ts`

## Tasks

- [ ] Add a mobile geometry test for transport row width and total header height.
- [ ] Increase play/stop and adjacent transport buttons to mobile touch target size.
- [ ] Make tempo and scale readouts compact with ellipsis where needed.
- [ ] Keep position readout legible without forcing excessive row height.
- [ ] Run HeaderTransportCluster and TransportBar tests.
- [ ] Run mobile app visual snapshots.
- [ ] Commit with `fix(mobile): improve header transport layout`.

## Acceptance

- Transport controls are touch-sized on `390x844`.
- Tempo and scale remain legible on `375x667`.
- The header does not dominate the first viewport.

