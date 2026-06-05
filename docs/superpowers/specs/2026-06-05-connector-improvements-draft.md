# Connector Improvements — Draft

Date: 2026-06-05
Status: **DRAFT** — scope captured, not yet designed. Needs a full brainstorm before planning.
Builds on: the chord-connector color + dash disambiguation work (PR #535).

## Purpose

A follow-up pass to keep improving the chord-connector rendering. Captured here as a single spec (per product decision) covering four related concerns. Each section below is a placeholder to be fleshed out into an actual design.

## Background

- Connectors now render as **line-only spines** through voicing note centers (the ribbon fill was retired). Overlapping voicings are disambiguated by per-voicing **color + dash** (PR #535).
- The neck is drawn with a **taper**: strings converge toward the nut (`taperYLeft` in `FretboardBackground` / the `stringYAt(s, x)` geometry). So near the start of the neck the vertical string spacing is compressed.
- Connector geometry lives in `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` (spine path) and `src/components/FretboardSVG/utils/pathGeometry.ts`. Rendering is `FretboardConnectorLayer.tsx`; styling is `FretboardSVG.module.css`.

## Scope (four concerns, one spec)

### 1. Cramped nut voicings (routing geometry)

**Problem.** Voicings near the nut stack into a tight near-vertical knot because the taper compresses string spacing. Example (live, C+ chord): the spine `M 20.5 37 L 84.5 65 L 84.5 94` — E at the nut, then C and G# stacked at fret 1 only ~29px apart — reads as a cramped zigzag that crowds the note bubbles.

**Candidate directions (to explore):**
- Smooth/curved spine through the note centers so it reads as one gesture instead of a jagged knot.
- Bow the spine to one side to clear the stacked bubbles.
- Route to bubble rims (edge-to-edge) rather than centers.
- A distinct representation (e.g. a bracket/bar) for near-vertical voicings.

**Open questions:** which direction; does it apply only below a fret threshold / only when segment angle exceeds X; interaction with the taper.

### 2. Marker occlusion / spine routing

**Problem.** How the spine meets the note bubbles — entry/exit points, overlap, whether it should curve around or attach to rims. Overlaps with §1 (same geometry domain).

**Open questions:** route through centers vs rims; should the spine pass under or visibly connect to bubbles; consistency with §1's chosen routing.

### 3. Color / dash tuning

**Problem.** Refine the color + dash shipped in PR #535 — palette choices, dash legibility, contrast on wood (both themes), and overall "busyness."

**Open questions:** is the current `CONNECTOR_PALETTE_ROTATION = [0,5,3,6,1,4]` the right set/order; dash pattern (`7px 5px`) legibility; whether dash should scale with zoom; any palette entries that read poorly on wood.

### 4. Crossing-heavy readability / focus

**Problem.** A behavior layer beyond color + dash for when many voicings cross at once — emphasis, focus-on-hover/selection, or layering so the active grip stands out and the rest recede.

**Open questions:** static importance vs interaction-driven focus; what defines the "active" voicing; how it composes with §1–§3.

## Non-goals

- CAGED shape **boundary** delineation (separate scale-domain problem, tracked separately).
- Re-introducing the ribbon/tube fill or the radius-offset machinery.

## Next steps

Run a full brainstorm (visual companion) to turn each section into a concrete design with chosen approaches, then write an implementation plan. Likely sequencing if it grows too large for one plan: routing/geometry (§1–§2) first as the foundation, then tuning (§3) and focus (§4).
