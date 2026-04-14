# Phase 2: Minimum Width Containers & Root Scroll -- Context

Gathered: 2026-04-12
Calibration: architect

## Phase Boundary
Establish root-level horizontal and vertical scroll strategy. Set explicit min-width and min-height on layout containers. Remove reactive JS/CSS patches that shrink controls to fit narrow viewports. Unify spacing tokens across all viewport sizes for consistent padding/gap.

## Decisions Made

### Min-Width Values Per Container
- Min-width values determined empirically per container by measuring content at narrowest usable state
- Controls-panel: widest control group (tuning selector or fret range) sets the floor
- Tablet-portrait-panel: settings-col + cof-col min-widths combined
- Fretboard wrapper: 5 frets minimum × fret width
- Exact pixel values computed during research/planning phase, not pre-decided

### Reactive Patch Removal Strategy
- Keep: `layoutMode` checks that switch structural layout (mobile tabs vs expanded panel vs tablet-portrait grid) -- these change WHAT renders
- Remove: JS `viewportWidth` checks that shrink controls to fit narrow viewports -- these change HOW BIG things render
- Remove: CSS media queries that override component sizes specifically for small phones
- Distinction: structural layout switches stay, sizing-only patches go

### Spacing Token Unification
- Unify padding/gap tokens across all viewport sizes in Phase 02 (not deferred to Phase 07)
- Rationale: already touching all layout containers for min-width, avoids doing the same CSS pass twice
- Goal: same content sections use identical spacing regardless of viewport size

### Fretboard Minimum Visible Range
- 5 frets minimum at full size before root horizontal scroll kicks in
- Rationale: minimum for one CAGED shape position -- below this, shapes become unreadable
- This value anchors the fretboard wrapper min-width calculation

### Min-Height Strategy
- Root min-height with vertical scroll -- symmetric with horizontal strategy
- Set min-height on root element so content never collapses vertically
- Viewport scrolls vertically when too short, same as horizontal scroll for narrow viewports
- Per-section min-height IS REQUIRED -- Phase 05 UAT-01 (2026-04-13) discovered that inner
  containers (controls-panel, summary-area, fretboard-wrapper) must have explicit min-heights
  to prevent squishing controls off-screen at short viewport heights (<1056px). Root-level
  min-height alone cannot protect inner containers from flex collapse. See R01-PLAN.md for
  the fix.

### Open (Claude's discretion)
- Specific pixel values for each container's min-width (research phase)
- Root min-height value (derived from header + controls + fretboard min heights)
- Which specific media queries qualify as "small-phone sizing patches" vs structural

## Deferred Ideas
- Per-section min-height: implemented in Phase 05 UAT-01 remediation (R01-PLAN.md).
  Original rejection at line 38 was incorrect -- see amendment above.

## Phase 02 Assumption Corrections

### Correction 2 — body overflow:hidden is unsafe once #root has min-height (Phase 05 R03, 2026-04-13)

**Original assumption:** Phase 02 chose "root is the scroll surface" and added
`body { overflow: hidden }` in `src/index.css` to suppress a window-level scrollbar when `#root` was
a fixed `100vh` container. This was valid under that constraint.

**Disproved by:** Phase 05 R01 introduced `#root { min-height: 720px }` and R02 raised it to 880px.
Once `#root`'s computed height exceeded viewport, body's overflow:hidden silently clipped the overflow
before `#root`'s own `overflow-y: auto` could engage a scrollbar. UAT-01-R02-a, UAT-02-R02 (mobile
license badge), and the unreachable-content reports at 1200x720, 375x667, and 390x844 all trace to this
chain.

**Resolution:** Phase 05 R03 removed the `overflow: hidden` declaration from the body rule (kept
`min-height: 100vh`). Window scrollbar now surfaces when content exceeds viewport. The Fretboard
drag-scroll on `.fretboard-wrapper` is unaffected (operates on a child `div` ref, not body/window).

**Lesson:** The "root scroll surface" pattern is only safe when root is sized exactly to the viewport.
Any later change that gives root a min-height greater than the viewport invalidates `body { overflow: hidden }`.
Future phases that revisit the scroll architecture should treat body-level overflow as part of the
contract, not an isolated styling choice.

**Backlink:** `.vbw-planning/phases/05-whitespace-fluid-flanking-removal/remediation/uat/round-03/R03-PLAN.md`
