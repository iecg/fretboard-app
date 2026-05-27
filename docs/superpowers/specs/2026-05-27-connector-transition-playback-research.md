# Connector Transition Playback Research

**Date:** 2026-05-27  
**Topic:** Why chord connector transitions work during manual chord toggling but not during progression playback  
**Method:** Systematic debugging (Phase 1: Root Cause Investigation)  
**Status:** Investigation complete, no code changes

## Problem

When user manually changes a chord (via chord type/root selectors), the chord connector polylines fade smoothly between old and new voicings. When the chord changes during progression playback, connectors snap instantly with no transition.

## Investigation Method

Traced data flow from trigger (user click vs. audio clock) through state → motion policy → connector layer rendering for both paths.

## Data Flow

### Manual chord toggle
```
User clicks chord selector
  → setProgressionStepRootAtom / updateProgressionStepQualityAtom
    → activeResolvedProgressionStepAtom recomputes
      → songStateAtoms.activeChordRootAtom / activeChordQualityAtom
        → chordOverlayAtoms.chordRootAtom / chordTypeAtom / chordTonesAtom
          → voicingMatchesAtom → visibleVoicingMatchesAtom
            → fullChordVoicings prop → explicitVoicings input
              → useChordConnectorPolylines recomputes
                → FretboardConnectorLayer receives new chordPolylines
```

### Playback-triggered chord change
```
Audio clock crosses chord boundary
  → Tone.Part fires chordOnsetPart.onEvent
    → eng.setActiveStep() writes to timeline.ts module state
    → Tone.Draw schedules setActiveStepIndex() → Jotai write

RAF loop (visualClock.ts) polls getTimelinePosition() every frame:
  → displayedStepIndexPrimitiveAtom written when stepIndex changes
    → displayedProgressionStepIndexAtom
      → activeResolvedProgressionStepAtom
        → (same chain as manual from here)
```

Both paths converge to the same atom chain. The divergence is in the **motion policy**.

## Root Cause

### Single commit: `b1abff24`

**Author:** Isaac Cocar  
**Date:** Wed May 27 11:41:06 2026 -0400 (today, ~1 hour ago)  
**Message:** `perf(transitions): disable hot-path group fades`

### What it changed

**`motionPolicy.ts:28-29`** — added a `playbackActive` guard:
```ts
if (input.playbackActive) {
  return { noteMode: "css", shapeMode: "none", connectorMode: "none" };
}
```

**`FretboardSVG.tsx:482-487`** — wired `playbackSnapshot?.playing` into the motion policy:
```ts
const playbackActive = !!playbackSnapshot?.playing;
const motionPolicy = useMemo(
  () => resolveFretboardMotionPolicy({ prefersReducedMotion, playbackActive }),
  [playbackActive, prefersReducedMotion],
);
```

### How it disables transitions

The `connectorMode` return value determines rendering in **`FretboardConnectorLayer.tsx:116-119`**:

| `connectorMode` | Branch | Result |
|---|---|---|
| `"group"` | `renderAnimatedChordConnectorGroup()` | `<motion.g>` with `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}` wrapped in `AnimatePresence` → smooth cross-fade |
| `"none"` | `renderStaticChordConnectorGroup()` | Plain `<g>` → React reconciles keys → paths swap instantly |

- **Manual toggling:** `playbackActive = false` → `connectorMode = "group"` → animated group fade works
- **Playback:** `playbackActive = true` → `connectorMode = "none"` → static group, no fade

### Why the CSS transition doesn't help

**`FretboardSVG.module.css:460-462`:**
```css
.chord-connector-path {
  transition: transform 0.2s ease;
}
```

This is non-functional for chord changes because `<path>` elements are **re-keyed** (keys = `{layer}-{voicingKey}`, voicingKey changes per voicing). React unmounts old paths and mounts new ones. CSS transitions fire only when **attributes change on a persistent DOM element**, not across mount/unmount. This transition would only apply if the same path changed its `transform` attribute.

### Compounding history

| Commit | Time | Change |
|---|---|---|
| `b391707c` | Yesterday 11:00 AM | Removed `opacity` from per-path CSS transition (`opacity 0.2s, transform 0.2s` → `transform 0.2s`) |
| `b1abff24` | Today 11:41 AM | Disabled group-level `<motion.g>` fade entirely during playback |

Before yesterday: per-path opacity + group fade during playback (most animated, highest cost).
After yesterday: group fade only (per-path opacity removed).
After today: no animation during playback at all (group fade disabled).

## The Underlying Tradeoff

The commit message ("disable hot-path group fades") reveals the intent: during playback, the fretboard re-renders on every animation frame (RAF-driven visual clock). The `<motion.g>` fade is a React/Motion animation that triggers additional rendering work — a "hot path" cost. The commit opted to suppress it during playback entirely.

**Cost of the tradeoff:** Zero visual transition at chord boundaries during playback. Notes snap to new roles instantly (via cheap CSS transition), but connectors have no animation path at all.

## Recovery Options

Without modifying code, the possible strategies to restore playback connector transitions:

1. **Re-enable group fades during playback** — restore pre-`b1abff24` behavior. Most straightforward. Risk: reintroduces the perf cost the commit was trying to avoid.

2. **Key connector paths by chord identity, not voicing** — if paths kept the same DOM keys and only their `d` attribute changed, the `transition: transform 0.2s` CSS rule would fire. But `d` attribute transitions aren't well-supported for complex `M...L...Z` path strings.

3. **Use per-path CSS opacity transition** — restore the `opacity` in the CSS transition (reverse `b391707c`). Each path would fade in/out independently even when re-mounted, because CSS `opacity` transitions do work across mount/unmount in most browsers. But this was removed for perf reasons yesterday.

4. **Connector group uses CSS `opacity` + `key` + `AnimatePresence`** — instead of `<motion.g>` (JS animation), use a CSS transition on the `<g>` opacity. AnimatePresence still handles mount/unmount but the animation is GPU-composited via CSS. Cheaper than `<motion.g>`.

5. **Scope policy to chord-step changes, not playback boolean** — detect whether the re-render is a chord-step boundary vs. a frame-tick and only animate boundaries. Highest engineering cost but most precise.

## Key Files

| File | Role |
|---|---|
| `src/components/FretboardSVG/motionPolicy.ts` | Policy resolver — the root cause lives here (line 28) |
| `src/components/FretboardSVG/FretboardSVG.tsx` | Wires `playbackSnapshot` to policy (line 483) |
| `src/components/FretboardSVG/FretboardConnectorLayer.tsx` | Renders animated vs static group based on `connectorMode` (line 116) |
| `src/components/FretboardSVG/FretboardSVG.module.css` | `.chord-connector-path` with `transition: transform 0.2s` (line 460) — non-functional for re-keyed paths |
| `src/progressions/audio/visualClock.ts` | RAF loop that writes step index during playback |
| `src/progressions/audio/timeline.ts` | Audio-clock-anchored timeline state |
| `src/store/progressionAtoms.ts` | Jotai atoms for step index, resolved steps |
| `src/store/chordOverlayAtoms.ts` | Chord root/type/voicing atoms consumed by connectors |
