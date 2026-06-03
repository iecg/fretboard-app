# Voice-Leading Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During the lead-in window before a chord change, make each *moving* voice's incoming ghost ring **slide** from its current fret to the next chord's nearest tone, so the transition reads as voice movement instead of a static cross-dissolve.

**Architecture:** A pure pairing helper (`computeVoiceLeadingMoves`) resolves which incoming note arrives from which departing/held note (nearest-distance, capped, region-gated). `buildRenderedFretboardNotes` runs it once per step (inside the existing memo) and stamps a `voiceLeadOffset` on each paired target. `FretboardNote` writes that offset as `--vl-dx`/`--vl-dy` CSS custom properties, and the existing `note-incoming-ramp` keyframe gains a `translate(...)` term. All continuous motion stays on the compositor (transform/opacity); no new SVG nodes, no per-frame React.

**Tech Stack:** React 19 + TypeScript, Jotai, CSS Modules, Vitest + Testing Library, Playwright (visual regression), pnpm workspace, React Compiler.

**Spec:** `docs/superpowers/specs/2026-06-01-voice-leading-motion-design.md`

---

## Prerequisites

- This builds on PR #511's lead-in/transition-role machinery. **Implement on a branch based on `main` after #511 has merged** (so `practiceLensAtoms`, `semantics.ts` `TransitionRole`, the lead-in CSS, and the `note-incoming-ramp` keyframe are present). If #511 is not yet merged, base the branch on `claude/crazy-montalcini-cad5eb` instead.
- Create an isolated worktree via the `superpowers:using-git-worktrees` skill before starting.
- All line references below match the post-#511 / post-dead-code-cleanup state of the files.

## File Structure

- **Create** `src/components/FretboardSVG/utils/voiceLeading.ts` — pure pairing logic, types (`VoiceLeadingNote`, `VoiceLeadingMove`), constants (`MAX_VOICE_LEADING_MOVES`, `MIN_VOICE_LEADING_TRAVEL_PX`). One responsibility: turn positioned notes into source→target moves.
- **Create** `src/components/FretboardSVG/utils/voiceLeading.test.ts` — unit tests for the helper.
- **Modify** `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — add `voiceLeadOffset` to `RenderedFretboardNote`; integrate the helper into `buildRenderedFretboardNotes`; add the offset to `renderedNoteSignature`.
- **Modify** `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts` — integration test (offset stamped on the right note) + per-frame no-recompute perf guard.
- **Modify** `src/components/FretboardSVG/FretboardNote.tsx` — destructure `voiceLeadOffset`; emit `--vl-dx`/`--vl-dy`.
- **Modify** `src/components/FretboardSVG/FretboardNote.test.tsx` — component test for the CSS vars.
- **Modify** `src/components/FretboardSVG/FretboardSVG.module.css` — extend the `note-incoming-ramp` keyframe with a `translate(...)` term.

---

### Task 1: Pure voice-leading pairing helper

**Files:**
- Create: `src/components/FretboardSVG/utils/voiceLeading.ts`
- Test: `src/components/FretboardSVG/utils/voiceLeading.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/FretboardSVG/utils/voiceLeading.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeVoiceLeadingMoves,
  MAX_VOICE_LEADING_MOVES,
  MIN_VOICE_LEADING_TRAVEL_PX,
  type VoiceLeadingNote,
} from "./voiceLeading";

function note(o: Partial<VoiceLeadingNote> & Pick<VoiceLeadingNote, "stringIndex" | "fretIndex" | "cx" | "cy">): VoiceLeadingNote {
  return { isInRegion: true, transitionRole: undefined, ...o };
}

afterEach(() => vi.restoreAllMocks());

describe("computeVoiceLeadingMoves", () => {
  it("returns [] when there are no incoming targets", () => {
    const notes = [note({ stringIndex: 1, fretIndex: 5, cx: 100, cy: 0, transitionRole: "departing" })];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("returns [] when there are no departing/held sources", () => {
    const notes = [note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" })];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("pairs each incoming target to its nearest source (one source per target)", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 0, fretIndex: 10, cx: 200, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 1, fretIndex: 5, cx: 110, cy: 0, transitionRole: "departing" }),
      note({ stringIndex: 1, fretIndex: 9, cx: 190, cy: 0, transitionRole: "held" }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(2);
    expect(moves.map((m) => m.targetKey).sort()).toEqual(["0-10", "0-5"]);
    const a = moves.find((m) => m.targetKey === "0-5")!;
    expect(a.sourceKey).toBe("1-5");
    expect(a.dx).toBe(10); // source.cx(110) - target.cx(100)
    expect(a.dy).toBe(0);
    const b = moves.find((m) => m.targetKey === "0-10")!;
    expect(b.sourceKey).toBe("1-9");
    expect(b.dx).toBe(-10); // 190 - 200
  });

  it("does not claim the same source for two targets", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 0, fretIndex: 6, cx: 101, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 1, fretIndex: 5, cx: 100, cy: 50, transitionRole: "departing" }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(1);
    expect(moves[0].targetKey).toBe("0-5"); // processed first, claims the only source
  });

  it("drops pairings whose travel is below the threshold", () => {
    expect(MIN_VOICE_LEADING_TRAVEL_PX).toBe(8);
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming" }),
      note({ stringIndex: 1, fretIndex: 5, cx: 104, cy: 0, transitionRole: "departing" }), // dist 4 < 8
    ];
    expect(computeVoiceLeadingMoves(notes)).toEqual([]);
  });

  it("ignores out-of-region targets and sources", () => {
    const notes = [
      note({ stringIndex: 0, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming", isInRegion: false }),
      note({ stringIndex: 1, fretIndex: 5, cx: 130, cy: 0, transitionRole: "departing", isInRegion: false }),
      note({ stringIndex: 2, fretIndex: 5, cx: 100, cy: 0, transitionRole: "incoming", isInRegion: true }),
      note({ stringIndex: 3, fretIndex: 5, cx: 140, cy: 0, transitionRole: "departing", isInRegion: true }),
    ];
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(1);
    expect(moves[0].targetKey).toBe("2-5");
    expect(moves[0].sourceKey).toBe("3-5");
  });

  it("caps at MAX_VOICE_LEADING_MOVES, keeping the longest travels, and logs the drop", () => {
    expect(MAX_VOICE_LEADING_MOVES).toBe(4);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const notes: VoiceLeadingNote[] = [];
    // 5 target/source pairs with increasing distances (20,40,60,80,100).
    for (let i = 1; i <= 5; i++) {
      notes.push(note({ stringIndex: 0, fretIndex: i, cx: i * 10, cy: 0, transitionRole: "incoming" }));
      notes.push(note({ stringIndex: 1, fretIndex: i, cx: i * 10 + i * 20, cy: 0, transitionRole: "departing" }));
    }
    const moves = computeVoiceLeadingMoves(notes);
    expect(moves).toHaveLength(MAX_VOICE_LEADING_MOVES);
    // The shortest-travel pair (target "0-1", dist 20) is dropped.
    expect(moves.map((m) => m.targetKey)).not.toContain("0-1");
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toContain("dropped 1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/voiceLeading.test.ts`
Expected: FAIL — `Cannot find module './voiceLeading'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/FretboardSVG/utils/voiceLeading.ts`:

```ts
import type { TransitionRole } from "./semantics";

/** Most simultaneous move cues shown in one transition (keeps it legible). */
export const MAX_VOICE_LEADING_MOVES = 4;
/** Minimum source→target distance (SVG user units) for a cue; below this the
 *  ghost just fades in place — no visible slide, so don't add jitter. */
export const MIN_VOICE_LEADING_TRAVEL_PX = 8;

/** Minimal positioned-note shape the pairing needs. `RenderedFretboardNote`
 *  satisfies this structurally. */
export interface VoiceLeadingNote {
  stringIndex: number;
  fretIndex: number;
  cx: number;
  cy: number;
  isInRegion: boolean;
  transitionRole?: TransitionRole;
}

export interface VoiceLeadingMove {
  /** `"${stringIndex}-${fretIndex}"` of the arriving (incoming) note. */
  targetKey: string;
  /** `"${stringIndex}-${fretIndex}"` of the paired source note. */
  sourceKey: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** source − target: the translate the ghost animates FROM, in user units. */
  dx: number;
  dy: number;
}

const keyOf = (n: { stringIndex: number; fretIndex: number }): string =>
  `${n.stringIndex}-${n.fretIndex}`;

/**
 * Pair each in-region incoming note to its nearest in-region departing/held
 * source (greedy, one source per target). Drops near-zero travels, caps at
 * {@link MAX_VOICE_LEADING_MOVES} keeping the longest travels, and logs any
 * drop (no silent truncation). Returns [] outside the lead-in window because
 * there are no `incoming`-role notes then.
 */
export function computeVoiceLeadingMoves(
  notes: VoiceLeadingNote[],
): VoiceLeadingMove[] {
  const inRegion = notes.filter((n) => n.isInRegion);
  const targets = inRegion
    .filter((n) => n.transitionRole === "incoming")
    .sort((a, b) => a.stringIndex - b.stringIndex || a.fretIndex - b.fretIndex);
  const sources = inRegion.filter(
    (n) => n.transitionRole === "departing" || n.transitionRole === "held",
  );
  if (targets.length === 0 || sources.length === 0) return [];

  const usedSourceKeys = new Set<string>();
  const candidates: Array<VoiceLeadingMove & { dist: number }> = [];

  for (const target of targets) {
    let best: VoiceLeadingNote | null = null;
    let bestDist = Infinity;
    for (const source of sources) {
      if (usedSourceKeys.has(keyOf(source))) continue;
      const d = Math.hypot(source.cx - target.cx, source.cy - target.cy);
      if (d < bestDist) {
        bestDist = d;
        best = source;
      }
    }
    if (!best) break; // every source already claimed
    if (bestDist < MIN_VOICE_LEADING_TRAVEL_PX) continue; // fade in place
    usedSourceKeys.add(keyOf(best));
    candidates.push({
      targetKey: keyOf(target),
      sourceKey: keyOf(best),
      fromX: best.cx,
      fromY: best.cy,
      toX: target.cx,
      toY: target.cy,
      dx: best.cx - target.cx,
      dy: best.cy - target.cy,
      dist: bestDist,
    });
  }

  if (candidates.length <= MAX_VOICE_LEADING_MOVES) {
    return candidates.map(stripDist);
  }

  const kept = [...candidates]
    .sort((a, b) => b.dist - a.dist)
    .slice(0, MAX_VOICE_LEADING_MOVES);
  console.debug(
    `[voiceLeading] capped ${candidates.length} moves to ${MAX_VOICE_LEADING_MOVES} (dropped ${candidates.length - kept.length})`,
  );
  kept.sort((a, b) => a.targetKey.localeCompare(b.targetKey));
  return kept.map(stripDist);
}

function stripDist(m: VoiceLeadingMove & { dist: number }): VoiceLeadingMove {
  const { dist: _dist, ...move } = m;
  return move;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/utils/voiceLeading.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/utils/voiceLeading.ts src/components/FretboardSVG/utils/voiceLeading.test.ts
git commit -m "feat(fretboard): pure voice-leading move pairing helper"
```

---

### Task 2: Wire the offset into the rendered notes

**Files:**
- Modify: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts:7-10` (interface), `:96-123` (signature), `:125-162` (builder)
- Test: `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`. First, add this import near the existing imports at the top:

```ts
import type { NoteData } from "./useNoteData";
```

(If `NoteData` is already imported, skip that line.) Then append these describe blocks at the end of the file:

```ts
describe("buildRenderedFretboardNotes — voice-leading offsets", () => {
  function makeNoteData(
    o: Partial<NoteData> & Pick<NoteData, "stringIndex" | "fretIndex">,
  ): NoteData {
    return {
      noteName: "C",
      octave: 4,
      noteClass: "chord-tone-in-scale",
      displayName: "C",
      displayValue: "C",
      applyDimOpacity: false,
      applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1 },
      isInRegion: true,
      isHidden: false,
      isTension: false,
      isGuideTone: false,
      ...o,
    };
  }

  it("stamps voiceLeadOffset on a paired incoming target, not on the source", () => {
    const noteData = [
      makeNoteData({ stringIndex: 0, fretIndex: 10, transitionRole: "incoming" }),
      makeNoteData({ stringIndex: 1, fretIndex: 11, transitionRole: "departing" }),
    ];
    // fretCenterX = fret*10, stringYAt = string*20 (module consts):
    //   target  string0 fret10 -> cx 100, cy 0
    //   source  string1 fret11 -> cx 110, cy 20  (dist hypot(10,20) ≈ 22.4 ≥ 8)
    const rendered = buildRenderedFretboardNotes({ noteData, fretCenterX, stringYAt });
    const target = rendered.find((n) => n.stringIndex === 0 && n.fretIndex === 10)!;
    const source = rendered.find((n) => n.stringIndex === 1 && n.fretIndex === 11)!;
    expect(target.voiceLeadOffset).toEqual({ dx: 10, dy: 20 });
    expect(source.voiceLeadOffset).toBeUndefined();
  });

  it("leaves voiceLeadOffset undefined when no transition roles are present", () => {
    const noteData = [
      makeNoteData({ stringIndex: 0, fretIndex: 3 }),
      makeNoteData({ stringIndex: 1, fretIndex: 4 }),
    ];
    const rendered = buildRenderedFretboardNotes({ noteData, fretCenterX, stringYAt });
    expect(rendered.every((n) => n.voiceLeadOffset === undefined)).toBe(true);
  });
});

describe("useAnimatedFretboardView — no per-frame recompute", () => {
  it("does not re-run when the visual frame advances within the same step", () => {
    const store = makePlayingStore(0.6); // already inside the lead-in window
    const wrapper = makeWrapper(store);
    let renders = 0;
    renderHook(
      () => {
        renders++;
        const topology = useStaticFretboardTopology(TOPOLOGY_PROPS);
        return useAnimatedFretboardView({
          topology,
          hasChordOverlay: true,
          fretCenterX,
          stringYAt,
        });
      },
      { wrapper },
    );
    const before = renders;
    // Advance the per-frame clock WITHIN the same step (still past threshold).
    act(() => {
      store.set(progressionVisualFrameAtom, {
        stepIndex: 0,
        globalFraction: 0.35,
        localFraction: 0.7,
        paused: false,
      });
    });
    expect(renders).toBe(before); // leadInActive unchanged -> no React re-render
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: FAIL — `voiceLeadOffset` does not exist on `RenderedFretboardNote` (type error) / `target.voiceLeadOffset` is `undefined`.

- [ ] **Step 3: Add the `voiceLeadOffset` field to the interface**

In `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`, replace lines 7-10:

```ts
export interface RenderedFretboardNote extends NoteData {
  cx: number;
  cy: number;
}
```

with:

```ts
export interface RenderedFretboardNote extends NoteData {
  cx: number;
  cy: number;
  /**
   * During the lead-in window, the (source − target) translate the incoming
   * ghost animates FROM, in SVG user units. Present only on paired moving
   * voices; absent notes fade/scale in place as before.
   */
  voiceLeadOffset?: { dx: number; dy: number };
}
```

- [ ] **Step 4: Add the import for the helper**

In the same file, add to the import block at the top (after the line `import { useEmphasisContext, type EmphasisContext } from "./useEmphasisContext";`):

```ts
import { computeVoiceLeadingMoves } from "../utils/voiceLeading";
```

- [ ] **Step 5: Add the offset to the signature**

In `renderedNoteSignature` (the array returned around lines 100-122), add one element at the end of the array, immediately after `note.isInRegion,`:

```ts
    note.isInRegion,
    note.voiceLeadOffset ? `${note.voiceLeadOffset.dx},${note.voiceLeadOffset.dy}` : "",
```

- [ ] **Step 6: Integrate the helper into the builder**

Replace the entire body of `buildRenderedFretboardNotes` (lines 125-162) with:

```ts
export function buildRenderedFretboardNotes({
  noteData,
  fretCenterX,
  stringYAt,
}: BuildRenderedFretboardNotesProps): RenderedFretboardNote[] {
  const prevCache = renderedNoteCache;
  // Fresh map seeded from the previous pass; only keys touched this pass are
  // retained, so removed/reconfigured positions cannot accumulate.
  const nextCache = new Map<
    string,
    { sig: string; result: RenderedFretboardNote }
  >();

  // Pass 1: position every note (cx/cy) — needed before voice-leading pairing.
  const positioned: RenderedFretboardNote[] = noteData.map((note) => {
    const cx = fretCenterX(note.fretIndex);
    return { ...note, cx, cy: stringYAt(note.stringIndex, cx) };
  });

  // Pass 2: pair moving voices (incoming target ← nearest departing/held
  // source). Empty outside the lead-in window (no incoming roles), so it costs
  // a couple of filters then bails — no per-frame work.
  const offsetByKey = new Map<string, { dx: number; dy: number }>();
  for (const move of computeVoiceLeadingMoves(positioned)) {
    offsetByKey.set(move.targetKey, { dx: move.dx, dy: move.dy });
  }

  // Pass 3: attach offsets, then cache by signature for stable references.
  const result = positioned.map((candidate) => {
    const key = `${candidate.stringIndex}-${candidate.fretIndex}`;
    const offset = offsetByKey.get(key);
    const withOffset = offset
      ? { ...candidate, voiceLeadOffset: offset }
      : candidate;
    const sig = renderedNoteSignature(withOffset);
    const prev = prevCache.get(key);

    if (prev && prev.sig === sig) {
      // Cache hit — reuse the stable object reference.
      nextCache.set(key, prev);
      return prev.result;
    }

    nextCache.set(key, { sig, result: withOffset });
    return withOffset;
  });

  renderedNoteCache = nextCache;
  return result;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 8: Typecheck**

Run: `pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts src/components/FretboardSVG/hooks/useAnimatedFretboardView.test.ts
git commit -m "feat(fretboard): stamp voice-leading offset on incoming notes"
```

---

### Task 3: Emit the offset as CSS custom properties in FretboardNote

**Files:**
- Modify: `src/components/FretboardSVG/FretboardNote.tsx:59-78` (destructure), `:192-203` (style)
- Test: `src/components/FretboardSVG/FretboardNote.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/FretboardSVG/FretboardNote.test.tsx`:

```ts
describe("FretboardNote — voice-leading offset CSS vars", () => {
  it("emits --vl-dx/--vl-dy on the <g> when voiceLeadOffset is present", () => {
    const glowColor = "var(--note-incoming)" as `var(--${string})`;
    const { container } = renderNote(
      makeNote({
        transitionRole: "incoming",
        voiceLeadOffset: { dx: -30, dy: 20 },
        applyLensEmphasis: { radiusBoost: 1, opacityBoost: 1, glowColor },
      }),
    );
    const g = container.querySelector("g[data-note-shape]") as SVGGElement;
    expect(g.style.getPropertyValue("--vl-dx")).toBe("-30");
    expect(g.style.getPropertyValue("--vl-dy")).toBe("20");
  });

  it("omits --vl-dx/--vl-dy when there is no voiceLeadOffset", () => {
    const { container } = renderNote(makeNote({}));
    const g = container.querySelector("g[data-note-shape]") as SVGGElement;
    expect(g.style.getPropertyValue("--vl-dx")).toBe("");
    expect(g.style.getPropertyValue("--vl-dy")).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: FAIL — `--vl-dx` is `""` in the first test (offset not yet emitted).

- [ ] **Step 3: Destructure `voiceLeadOffset`**

In `src/components/FretboardSVG/FretboardNote.tsx`, in the destructure block (lines 59-78), add `voiceLeadOffset` after `transitionRole,`:

```ts
    transitionRole,
    voiceLeadOffset,
  } = note;
```

- [ ] **Step 4: Emit the CSS vars**

In the `<g>` `style={{ ... }}` object (lines 192-203), add the offset spread immediately after the `transform: "scale(var(--emph-scale, 1))",` line:

```ts
        transform: "scale(var(--emph-scale, 1))",
        ...(voiceLeadOffset
          ? { "--vl-dx": voiceLeadOffset.dx, "--vl-dy": voiceLeadOffset.dy }
          : undefined),
        opacity: finalOpacity !== 1 ? finalOpacity : undefined,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/FretboardSVG/FretboardNote.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FretboardSVG/FretboardNote.tsx src/components/FretboardSVG/FretboardNote.test.tsx
git commit -m "feat(fretboard): emit voice-leading offset vars on note group"
```

---

### Task 4: Add the slide to the incoming-ghost keyframe

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.module.css:436-439`

This is a CSS-only change; correctness is verified by the build, by the existing reduced-motion rules (already present at lines 462-474), and by the visual suite in Task 5. There is no unit test for a keyframe.

- [ ] **Step 1: Extend the keyframe**

In `src/components/FretboardSVG/FretboardSVG.module.css`, replace the `note-incoming-ramp` keyframe (lines 436-439):

```css
@keyframes note-incoming-ramp {
  from { opacity: 0;   transform: scale(0.8); }
  to   { opacity: 0.7; transform: scale(1); }
}
```

with:

```css
/* The incoming ghost ramps opacity/scale AND slides in from its paired source
   note's position. --vl-dx/--vl-dy (SVG user units, set inline by FretboardNote)
   default to 0, so unpaired ghosts simply fade/scale in place. Transform-only
   slide stays on the compositor; reduced-motion disables this animation below. */
@keyframes note-incoming-ramp {
  from {
    opacity: 0;
    transform: translate(calc(var(--vl-dx, 0) * 1px), calc(var(--vl-dy, 0) * 1px)) scale(0.8);
  }
  to {
    opacity: 0.7;
    transform: translate(0, 0) scale(1);
  }
}
```

- [ ] **Step 2: Verify lint and existing tests still pass**

Run: `pnpm run lint`
Expected: 0 errors (a pre-existing `react-hooks/exhaustive-deps` warning in `useFretboardTopologyModel.ts` is unrelated and acceptable).

Run: `pnpm exec vitest run src/components/FretboardSVG/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.module.css
git commit -m "feat(fretboard): slide the incoming ghost in from its source"
```

---

### Task 5: Full gate suite + visual regression

**Files:** none (verification + snapshot refresh only)

- [ ] **Step 1: Run the full unit/component suite**

Run: `pnpm run test`
Expected: all pass (the new `voiceLeading`, `useAnimatedFretboardView`, and `FretboardNote` tests included).

- [ ] **Step 2: Typecheck and build**

Run: `pnpm exec tsc -b && pnpm run build`
Expected: clean tsc, successful build.

- [ ] **Step 3: Run the visual regression suite**

Run: `pnpm run test:visual`
Expected: The lead-in motion is mid-animation, so static full-page snapshots that do not capture a lead-in frame should be unaffected. If any committed snapshot shifts because of the keyframe change, inspect the diff to confirm it is the expected ghost position, then refresh:

Run (only if diffs are confirmed-correct): `pnpm run test:visual:update`
Then re-run `pnpm run test:visual` and confirm green. Commit any updated snapshots.

> **Note on coverage:** the *motion* itself (a transform over `--lead-in-duration`) is intentionally NOT asserted by a pixel snapshot — mid-animation captures are timing-dependent and flaky. The behavioral guarantees (offset computed for the right note, CSS vars emitted, no per-frame React) are covered by the unit/component tests in Tasks 1-3. The keyframe wiring is covered by build + reduced-motion rules.

- [ ] **Step 4: Commit any snapshot updates**

```bash
git add -A
git commit -m "test(fretboard): refresh visual snapshots for voice-leading slide" --allow-empty
```

(Use `--allow-empty` only if there were no snapshot changes, to keep a clean checkpoint; otherwise drop it.)

---

## Self-Review

**Spec coverage:**
- "moving voices only / restraint" → Task 1 (incoming targets only, threshold drop, cap-at-K, region gating). ✅
- "ghost slides in via transform" → Task 4 keyframe + Task 3 CSS vars. ✅
- "computed once per step, memoized, no per-frame React" → Task 2 builder integration + the per-frame no-recompute test. ✅
- "no new SVG nodes" → reuses the existing underlay; no new elements added. ✅
- "reduced motion falls back to fade-in-place" → existing rules at module.css:462-474 disable the animation; `translate` only lives in the (disabled) keyframe. ✅
- "≤2 renders/step; no new subscriptions" → builder adds no hooks; per-frame no-recompute test guards it. ✅
- "testing: unit/component/integration/perf/visual" → Tasks 1, 2, 3, 5. ✅
- "cue reuses --note-incoming, no new colors" → no color tokens touched. ✅

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `VoiceLeadingNote`/`VoiceLeadingMove` defined in Task 1 and consumed structurally by `RenderedFretboardNote` in Task 2; `voiceLeadOffset: { dx, dy }` shape is identical across the interface (Task 2), the signature string (Task 2), the inline style (Task 3), and the move output (`m.dx`/`m.dy`, Task 1). `computeVoiceLeadingMoves` signature matches its call site. `--vl-dx`/`--vl-dy` names match between Task 3 (emit) and Task 4 (consume).
