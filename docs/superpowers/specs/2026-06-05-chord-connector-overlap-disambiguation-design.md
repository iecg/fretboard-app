# Chord-Connector Overlap Disambiguation — Design

Date: 2026-06-05
Status: Approved for planning
Scope: Chord-connector layer only (`useChordConnectorPolylines` + `FretboardConnectorLayer` + connector CSS). The CAGED shape-boundary delineation problem is explicitly **out of scope** and tracked as a separate follow-up design.

## Problem

When the tube/ribbon fill was removed, chord connectors became **line-only spines** drawn through the voicing's note centers. Every voicing renders with `V2_PALETTE_INDEX = 0`, so all spines share one accent color (`--fb-connector-accent`). When several voicings are visible and their spines overlap — Pattern = None, dense chords, or CAGED with multiple shapes — the identically-colored lines cross and merge, and the user can no longer tell **which spine belongs to which grip**. The single channel that used to disambiguate voicings (the filled, colored ribbon) is gone.

Two pieces of machinery are now dead weight:

- `OFFSET_BUCKET` + `offsetPx` + `assignConflictOffsets` + the radius post-clamp collision pass in `computeFinalConnectorRadii`. These nudged each voicing's *Minkowski radius* so overlapping **ribbon fills** stayed distinct. With line-only rendering, radius only affects `paths.fill`/`paths.outline`, which `FretboardConnectorLayer` no longer renders (it draws only `spinePath`). So the radius-offset system has no visible effect.
- The blanket CSS override `.chord-connectors path[data-layer] { color: var(--fb-connector-accent); }` (FretboardSVG.module.css) forces every spine to the single accent color, defeating the per-voicing `data-palette-index` that is already wired onto each path.

## Goals

- Make overlapping voicings visually distinguishable, so each grip reads as its own shape.
- Keep **every** voicing — no culling, no dropping (an explicit user decision; this is an edge case and hiding data is the wrong trade).
- Reuse the existing collision detection rather than discard it.
- Remove the dead `OFFSET_BUCKET` / radius-offset machinery.

## Non-goals

- CAGED shape-boundary delineation (separate domain, separate spec).
- Perpendicular spatial offset of spines (researched and rejected — see "Rejected: offset").
- Any change to interval connectors (`useIntervalConnectorPolylines`), which already encode per-pair color and are not affected.

## Approach

Distinguish overlapping voicings by **color** (primary) plus **dash** (redundant second cue), assigned by greedy-coloring a conflict graph. No spine is moved; no voicing is dropped.

This is the research-backed combination: color is the strongest distinguisher and works through shared note-dots; a dash pattern is an established redundant channel for color-blind users and for lines that genuinely overlap. Pairing the two (rather than relying on either alone) is the recommended practice, and dashing is held to a single binary (solid vs dashed) because >2 dash styles become distracting.

### 1. Conflict graph (reuse the collision detection)

Build an undirected conflict graph over the pending voicings. Two voicings conflict if **either**:

- they **share a note** — an identical `(stringIndex, fretIndex)` coordinate (the existing `assignConflictOffsets` test); or
- their **spines cross or pass within a small threshold** — computed with the existing pure geometry helpers (`segmentDistance` / `pointToSegmentDistance` / `polylineDistance`).

The conflict graph is computed in **normalized `(fretIndex, stringIndex)` space**, not pixels. Both axes map monotonically to pixels (`fretCenterX`, `stringYAt`), so spine **crossings are preserved** under that mapping, and the proximity threshold is expressed in fret/string units. This keeps the graph **screen-independent**: colors stay stable across resize, and the work stays in the topology stage (`buildPendingChordConnectorVoicings`) where it only re-runs on musical change — preserving the existing topology/pixel memo split. The geometry helpers are coordinate-agnostic and are **kept**, fed `noteCoords` instead of pixel vertices.

### 2. Encoding assignment (replaces `assignConflictOffsets`)

Greedy graph-coloring, deterministically ordered (e.g. by leftmost fret then `canonicalKey`, matching the existing deterministic ordering):

- For each voicing, pick the smallest color slot not used by any already-assigned conflicting neighbor.
- `paletteIndex` ← `CONNECTOR_PALETTE_ROTATION[colorSlot % rotation.length]`.
- `dashed` ← `colorSlot` is odd (binary solid/dashed redundant cue; yields the solid/dashed interleave between adjacent voicings).

A voicing with no conflicts gets slot 0 → first rotation color, solid — so the common single-voicing case is unchanged (orange, solid). In practice overlaps are local; the demo over the worst real case (Am, Pattern None, Full — 10 voicings) needed only **2 slots**.

`CONNECTOR_PALETTE_ROTATION` is an ordered list of `--chord-connector-color-N` slots chosen for contrast **on wood in both themes**. Because CAGED region shading is now a single neutral tint (`--fb-region-tint`; per-CAGED colors are no longer painted), connectors no longer need to avoid clashing with saturated CAGED backgrounds — the old orange/vermillion-only restriction is lifted and **the full palette is available**. Proposed rotation: `[1, 6, 4, 7, 2, 5]` (orange, blue, green, purple, vermillion, sky), excluding slot 8 (yellow) and slot 3 (gray) for low contrast on light wood. (If the future CAGED-delineation work reintroduces saturated per-shape tints, this rotation must be revisited — noted as a coupling, not a current constraint.)

`PendingChordConnectorVoicing.offsetPx` is replaced by `paletteIndex` (already on the type) and a new `dashed: boolean`. `V2_PALETTE_INDEX` is removed.

### 3. Render (`FretboardConnectorLayer`)

- The spine path already emits `data-palette-index`; it now carries the **assigned** index instead of a constant.
- Add `data-dash={voicing.dashed ? "true" : undefined}` to the spine path.
- The halo path stays neutral and **solid** (continuous legibility underlay beneath the colored, possibly-dashed spine).

### 4. CSS (`FretboardSVG.module.css`)

- **Remove** the blanket `.chord-connectors path[data-layer] { color: var(--fb-connector-accent); }` override so `data-palette-index` drives the spine color via `currentColor`.
- **Remove** the `.chord-connectors path[data-caged-shape="…"]` color rules — connector color now comes from the conflict-assigned palette index (chord domain), not from CAGED shape identity (scale domain). This keeps the domains independent per CLAUDE.md.
- Keep the `[data-palette-index="1".."8"]` color rules (now actually used by spines).
- Add a dash rule: `.chord-connectors path[data-layer="spine"][data-dash="true"] { stroke-dasharray: 7px 5px; }` (starting value; tune during visual QA — the dash should read clearly against the solid halo underlay).
- Halo rule unchanged.

### 5. Removals

- `OFFSET_BUCKET`, `offsetPx`, `assignConflictOffsets` (replaced by the encoding assigner), and the radius post-clamp collision pass / `CONNECTOR_CONFLICT_GAP_PX` usage in `computeFinalConnectorRadii` that existed solely to keep overlapping radii distinct.
- `V2_PALETTE_INDEX`.

Deferred / optional cleanup (not required for this change, flagged for a reviewer): the rendered output uses only `spinePath`, so `paths.fill` / `paths.outline`, the per-voicing radius computation, and `offsetOpenPolylinePath` for chord connectors are also dead. Removing them is a larger diff touching the exported `ChordConnectorVoicing` interface and several tests; keep it as a separate cleanup so this change stays focused and reviewable.

## Rejected: offset

A small perpendicular offset to separate spines was considered and rejected. Offset is the metro-map technique for lines sharing a **corridor** (a long collinear run) and it carries an ordering problem (which line on which side, or you create new crossings — "metro-line crossing minimization"). It solves **superposition**, whereas color+dash solves **identification** — and the overlaps here are almost all point-crossings and shared end-dots, not collinear runs, so identification is the real need. Two concrete costs sealed it: (1) a sub-threshold nudge reads as the spine being **misaligned with its note dots** rather than as intentional separation; (2) any offset **detaches the spine from the note centers**, which are the point of the connector. Offset stays on the shelf as a future enhancement only if genuinely collinear shared-corridor runs prove to be a real problem.

## Affected files

- `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` — conflict graph + encoding assigner; remove offset machinery; add `dashed` to the pending/output types.
- `src/components/FretboardSVG/FretboardConnectorLayer.tsx` — emit `data-dash`; use assigned `data-palette-index`.
- `src/components/FretboardSVG/FretboardSVG.module.css` — remove blanket accent override + caged-shape color rules; add dash rule.
- Connector color rotation constant (new) in the hook (or a small shared module).

## Testing

- **Unit** (`useChordConnectorPolylines.test.ts`): conflict-graph construction (shared-vertex and crossing cases); greedy coloring is deterministic and assigns different slots to conflicting neighbors; dash parity follows the color slot; single non-conflicting voicing → slot 0, solid, first rotation color; screen-independence (same assignment under a scaled coordinate mapping). Update/remove tests asserting `offsetPx` / `OFFSET_BUCKET`.
- **Component** (`FretboardConnectorLayer.test.tsx` / `FretboardSVG.test.tsx`): spine paths carry distinct `data-palette-index` values and `data-dash` when voicings conflict.
- **Visual regression**: refresh the connector snapshots (`fretboard-svg`, `app-overlays`) to capture the multi-color/dash output.
- Run `pnpm run lint`, `pnpm run test`, `pnpm run build` before PR (per CLAUDE.md).

## Open coupling to track (not in this scope)

If the separate CAGED boundary-delineation work reintroduces **saturated per-shape region tints**, the connector palette rotation chosen here must be re-checked for contrast against those tints. With the current neutral region tint, the full palette is safe.
