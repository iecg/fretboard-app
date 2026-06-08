# Fretboard Visual Language — Open Questions Cleanup

## Problem

`docs/design/fretboard-visual-language.md` §6 listed five open/deferred questions.
Four were purely in design-doc limbo — defined but with no decision, priority, or
implementation. This spec resolves or reprioritizes all five.

## Outcome per item

| # | Item | Resolution | Action |
|---|------|-----------|--------|
| 1 | **Modal characteristic-tone accent channel** | **Resolve next** — highest-impact open design decision. Recommended approach (Approach B from the brainstorming session): pick the visual cue (ring/notch/halo/salience) and implement. | Stay in §6 pending design; next implementation candidate. |
| 2 | **New pattern overlays** (diagonal boxes, etc.) | **Deferred** — future exploration, not in current scope. | Stay in §6 as-is. |
| 3 | **Neutral region-shade ladder** | **Deferred** — included in triage, lowest current priority. The single `--fb-region-tint` variable suffices; a ladder would be a nice-to-have polish pass. | Stay in §6. |
| 4 | **Non-voicing chord tones** | **Closed as YAGNI** — the connector polyline already groups the active voicing via Gestalt connectedness. Marker-level de-emphasis would over-encode and violates "redundant to reinforce, not extend." | Removed from §6; added to §5 (Anti-patterns). |
| 5 | **"Show all CAGED positions" overview** | **Dropped** — the single-shape invariant is enforced in storage (`collapseToSingleShape` in `fingeringAtoms.ts`), the 5-hue CAGED rainbow was already weakest-on-record from the original research, and no use case justifies re-introducing it. | Removed from §6; code comment in `FretboardShapeLayer.tsx` updated. |

## Files changed

- `docs/design/fretboard-visual-language.md` — §5 and §6 updated; §10 provenance added.
- `src/components/FretboardSVG/FretboardShapeLayer.tsx` — comment updated to no longer reference the dropped feature.
- This spec.

## Next step

Implement the modal characteristic-tone accent channel (item #1 above) — resolve
the visual cue (ring / notch / halo / salience elevation) and the degree-detection
mechanism, then build.
