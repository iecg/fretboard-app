# Chord Transition Performance — Connector Layer

**Goal:** Eliminate the visual degradation (stuttering, sluggish fade) that occurs when many chord connectors are visible during a progression chord change.

**Architecture:** Three independent fixes: (1) swap `AnimatePresence mode="wait"` for a crossfade, (2) remove the redundant per-path CSS transition that fires on top of the group animation, (3) cache the O(N²) conflict-detection result so it doesn't re-run on geometry-only changes (zoom/scroll).

**Tech Stack:** TypeScript, Framer Motion (`motion/react`), CSS Modules, `useMemo`.

---

## Root Cause Analysis

### Problem 1 — `mode="wait"` doubles DOM element count during transitions

`FretboardConnectorLayer` wraps the connector group in `<AnimatePresence mode="wait">`. With `mode="wait"`, Framer Motion keeps the **exiting group mounted** until its exit animation completes (0.2 s), then mounts the entering group. During that 0.2 s window both groups are live in the DOM simultaneously.

Each voicing renders three `<path>` elements (halo + fill + outline). With N voicings, the transition peak is `2 × 3N` SVG paths — all with complex arc-heavy `d` strings — being composited at once. At N=10 that's 60 paths; at N=15 it's 90.

### Problem 2 — CSS `transition` fires on top of the Framer Motion group fade

```css
/* FretboardSVG.module.css */
.chord-connector-path {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

This class is applied to every `fill` and `outline` path. When Framer Motion animates the parent `<motion.g>` opacity from 0→1, the browser also triggers the CSS `opacity` transition on each child path individually. The result is a double-animation: the compositor runs both the group-level opacity ramp and per-element opacity transitions simultaneously. With many paths this saturates the compositor thread.

### Problem 3 — O(N²) conflict detection blocks the first animation frame

`assignConflictOffsets` (in `useChordConnectorPolylines.ts`) runs a full pairwise `polylineDistance` check between every pair of pending voicings. `polylineDistance` is O(edges_A × edges_B). A second O(N²) pass runs in `computeFinalConnectorRadii` after radius clamping.

Both passes run inside `useMemo` with `[fretCenterX, stringYAt, ...]` in the dependency array. `fretCenterX` and `stringYAt` are recreated on every zoom/scroll change, so the full O(N²) computation re-runs even when the chord hasn't changed — only the pixel coordinates shifted. This blocks the JS thread before the first animation frame, causing the transition to start late.

---

## Design

### Fix 1 — Switch to crossfade (`mode="sync"`)

Replace `mode="wait"` with `mode="sync"` in `FretboardConnectorLayer`. With `mode="sync"` the entering group fades in while the exiting group fades out — they overlap for 0.2 s but the total transition time is 0.2 s instead of 0.4 s, and the peak DOM element count is the same `2 × 3N` but only for the duration of the crossfade rather than the full exit + enter sequence.

```tsx
// Before
<AnimatePresence mode="wait">

// After
<AnimatePresence mode="sync">
```

This is a one-line change. The `motionKey` logic is unchanged — a new key still triggers exit + enter, just concurrently.

### Fix 2 — Remove the redundant per-path CSS transition

The `.chord-connector-path` CSS transition is redundant: the group-level Framer Motion animation already handles the opacity ramp for the entire connector layer. Individual paths don't need their own opacity transition.

Remove the transition declaration from `.chord-connector-path`:

```css
/* Before */
.chord-connector-path {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

/* After — remove the rule entirely (or keep only transform if needed elsewhere) */
```

If a `transform` transition is needed for some other feature, keep only that:

```css
.chord-connector-path {
  transition: transform 0.2s ease;
}
```

Otherwise delete the rule. The `halo` layer already has no class and is unaffected.

### Fix 3 — Separate musical data from pixel geometry in the conflict-detection memo

The O(N²) conflict detection only needs to re-run when the **set of voicings** changes (chord change, position change). It does not need to re-run when only pixel coordinates change (zoom, scroll, resize).

Split `useChordConnectorPolylines` into two memos:

**Memo A — voicing topology** (depends on `noteData`, `chordToneNames`, `explicitVoicings`):
Runs `buildChordConnectorPolylines` up to and including the conflict-offset assignment. Produces a stable list of `{ canonicalKey, rawVerticesNormalized, paletteIndex, shape, offsetPx }` where `rawVerticesNormalized` stores fret/string indices rather than pixel coordinates.

**Memo B — pixel paths** (depends on Memo A output + `fretCenterX`, `stringYAt`, `stringRowPx`, `yBounds`):
Maps the normalized vertices to pixel space and calls `offsetOpenPolylinePath`. This is cheap (one path-string computation per voicing) and is the only part that needs to re-run on zoom/scroll.

This way, a zoom change only re-runs Memo B (O(N) path generation), not the O(N²) conflict detection in Memo A.

**Concrete change in `useChordConnectorPolylines.ts`:**

Refactor `buildChordConnectorPolylines` to return an intermediate type:

```ts
interface PendingVoicing {
  canonicalKey: string;
  voicingKey: string;
  /** Fret/string indices — geometry-independent. */
  noteCoords: Array<{ stringIndex: number; fretIndex: number }>;
  paletteIndex: number;
  shape?: CagedShape;
  /** Conflict offset in px — assigned once, stable across zoom. */
  offsetPx: number;
}
```

The hook then has two `useMemo` calls:

```ts
// Memo A: topology + conflict offsets — only re-runs on chord/voicing changes
const pendingVoicings = useMemo(
  () => buildPendingVoicings(noteData, chordToneNames, explicitVoicings, voicingSourceActive),
  [noteData, chordToneNames, explicitVoicings, voicingSourceActive],
);

// Memo B: pixel paths — re-runs on zoom/scroll but is O(N) cheap
return useMemo(
  () => buildPixelPaths(pendingVoicings, fretCenterX, stringYAt, stringRowPx, yBounds),
  [pendingVoicings, fretCenterX, stringYAt, stringRowPx, yBounds],
);
```

The `assignConflictOffsets` call moves into `buildPendingVoicings`. The `computeFinalConnectorRadii` call (which needs pixel coordinates for the post-clamp collision fix) stays in `buildPixelPaths` but only runs the O(N²) post-clamp pass, not the full conflict-graph construction.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/FretboardSVG/FretboardConnectorLayer.tsx` | `mode="wait"` → `mode="sync"` |
| `src/components/FretboardSVG/FretboardSVG.module.css` | Remove `transition: opacity 0.2s ease` from `.chord-connector-path` |
| `src/components/FretboardSVG/hooks/useChordConnectorPolylines.ts` | Split into two memos; extract `buildPendingVoicings` (topology + conflict offsets) and `buildPixelPaths` (pixel path generation) |

---

## What Stays the Same

- `ChordConnectorVoicing` return type — callers are unchanged
- `motionKey` construction in `FretboardConnectorLayer` — key still changes on chord transitions
- `ANIMATION_DURATION_FAST` value — transition duration unchanged
- `assignConflictOffsets` algorithm — same O(N²) graph, just called less often
- `offsetOpenPolylinePath` — path geometry unchanged
- All existing tests for `buildChordConnectorPolylines` — the public function signature and output are unchanged; the internal split is an implementation detail

---

## Testing Strategy

- **`FretboardConnectorLayer.test.tsx`:** Verify `AnimatePresence` receives `mode="sync"` (or no `mode="wait"`). Existing snapshot/render tests should pass unchanged.
- **`useChordConnectorPolylines.test.ts`:** Add a test that calls the hook twice with the same `noteData`/`chordToneNames` but different `fretCenterX` functions (simulating a zoom change) and asserts that the `pendingVoicings` memo reference is stable (same object identity) across the two renders.
- **CSS:** Visual regression — connector fade should be visually identical to before but smoother. No functional test needed for the CSS change.

---

## Non-Goals

- No change to the `polylineDistance` algorithm itself — the O(N²) complexity is acceptable when it only runs on chord changes, not on every frame.
- No change to the three-pass render (halo/fill/outline) — the DOM element count per voicing stays at 3.
- No change to the `motionKey` construction — the crossfade still triggers on every chord change.
- No cap on the number of voicings rendered — this spec does not address pathological cases with 20+ connectors.
