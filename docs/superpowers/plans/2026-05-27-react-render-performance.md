# React Render Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate avoidable React re-renders during progression playback and chord-overlay updates via three narrowly scoped, independently verifiable changes.

**Architecture:** Three independent slices — (A) `selectAtom` slicing of `chordLookupAtom`, (B) extract `ProgressionRuler` into its own component so React Compiler can skip it across playhead ticks, (C) collapse 144 per-button click closures in `FretboardHitTargetLayer` to one delegated handler on the parent container. No state-shape redesign, no structural refactors.

**Tech Stack:** React 19, React Compiler (`compilationMode: 'infer'`), Jotai (with `jotai/utils` `selectAtom`), Vitest, Testing Library, pnpm workspaces.

---

## Conventions

- **Package manager:** `pnpm` only — never `npm` or `yarn`.
- **Typecheck:** `pnpm exec tsc --noEmit -p tsconfig.app.json`
- **Staging:** Stage only the named files in each commit. Never `git add -A` / `git add .`.
- **Commit signoff:** Every commit ends with the trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- **Hooks:** Never pass `--no-verify`. If a pre-commit hook fails, fix the issue and create a *new* commit (do not amend).
- **Active branch:** `claude/elated-nobel-dd4e76`. Safe to commit to.
- **Tests:** Co-located with source. `src/store/<name>.test.ts`, `src/components/<Name>/<Name>.test.tsx`.

---

## File Structure

### Files modified

- `src/store/chordOverlayAtoms.ts` — add two `selectAtom` exports; rewire `chordShortLabelAtom` to consume them.
- `src/store/chordOverlayAtoms.test.ts` — append two new reference-stability tests at the end.
- `src/components/ProgressionTrack/ProgressionTrack.tsx` — replace inline ruler JSX with `<ProgressionRuler …/>`.
- `src/components/FretboardSVG/FretboardHitTargetLayer.tsx` — remove per-button `onClick`; add parent-container delegated handler and per-button `data-*` attributes.
- `src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx` — add keyboard-activation, attribute-presence, and missed-target tests.

### Files created

- `src/components/ProgressionTrack/ProgressionRuler.tsx` — pure ruler component with `{ totalBarsForDisplay, subdivisionsPerBar }` props.
- `src/components/ProgressionTrack/ProgressionRuler.test.tsx` — static-render + Compiler-skip tests.

### Files unchanged but referenced

- `src/components/ProgressionTrack/ProgressionTrack.module.css` — ruler/rulerBar/rulerTick classes (lines 158–224) stay as-is; the new component imports the same stylesheet.
- `src/store/scaleAtoms.ts` (`preferFlatsAtom`), `src/progressions/progressionDomain.ts` (`formatChordShortLabel`), `@fretflow/core` (`formatAccidental`, `getNoteDisplay`) — already imported by `chordOverlayAtoms.ts`; no changes.

---

## Slice A — `selectAtom` slicing of `chordLookupAtom`

**Why:** `chordShortLabelAtom` currently reads the entire `ChordLookup` object (which includes `chordTones`, `chordToneSet`, `chordMembers`, `memberByNote`) just to use `chordRoot` and `chordType`. Any change to chord tones (e.g. toggling chord-overlay visibility) cascades a re-render to every `chordShortLabelAtom` subscriber even when the label is bit-for-bit identical.

`chordLookupAtom` is already reference-stable across irrelevant churn (verified by the existing test at `chordOverlayAtoms.test.ts:1209`), but Jotai subscribers re-fire whenever the atom *recomputes*, not only when the result reference changes. `selectAtom` adds an equality gate that suppresses notification when the slice is `Object.is`-equal to the previous slice.

### Task A1: Add `chordLookupRootAtom` + `chordLookupTypeAtom` slices

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:2` (add `selectAtom` to the `jotai/utils` import)
- Modify: `src/store/chordOverlayAtoms.ts:701` (insert two new exports after `chordLookupAtom`)

- [ ] **Step A1.1: Extend the `jotai/utils` import**

Open `src/store/chordOverlayAtoms.ts`. Line 2 currently reads:

```ts
import { atomWithStorage } from "jotai/utils";
```

Change to:

```ts
import { atomWithStorage, selectAtom } from "jotai/utils";
```

- [ ] **Step A1.2: Add the two slice atoms immediately after `chordLookupAtom`**

`chordLookupAtom` ends at line 701 with `});`. Insert these two exports on the following blank line (before the `/** Compact chord symbol …` doc comment at line 703):

```ts
/** Stable slice: chord root letter alone. Re-emits only when the root changes. */
export const chordLookupRootAtom = selectAtom(
  chordLookupAtom,
  (lookup) => lookup.chordRoot,
);

/** Stable slice: chord quality/type alone. Re-emits only when the type changes. */
export const chordLookupTypeAtom = selectAtom(
  chordLookupAtom,
  (lookup) => lookup.chordType,
);
```

Both slices return primitives (`string` / `string | null`), so the default `Object.is` equality is correct — no custom comparator argument needed.

- [ ] **Step A1.3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step A1.4: Commit**

```bash
git add src/store/chordOverlayAtoms.ts
git commit -m "$(cat <<'EOF'
perf(store): add selectAtom slices for chordLookup root/type

Components that only need the root letter or chord quality can now
subscribe to a slice that re-emits only when that field actually
changes, instead of every time chordLookupAtom recomputes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A2: Test slice reference stability under unrelated churn

**Files:**
- Modify: `src/store/chordOverlayAtoms.test.ts` (append to end of file, after the existing `describe("chordLookupAtom — referential stability", …)` block at line 1209–1230)

- [ ] **Step A2.1: Write the failing test**

Append this block to the very end of `src/store/chordOverlayAtoms.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Group L — chordLookup slice atoms — selectAtom reference stability
// ---------------------------------------------------------------------------

import {
  chordLookupRootAtom,
  chordLookupTypeAtom,
} from "./chordOverlayAtoms";

describe("chordLookup slice atoms — selectAtom reference stability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("chordLookupRootAtom does not re-emit when only the progression-step id object changes", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupRootAtom);
    let notifications = 0;
    const unsub = store.sub(chordLookupRootAtom, () => {
      notifications++;
    });

    // Mutate progression-step identity without changing root or type.
    store.set(
      progressionStepsAtom,
      store.get(progressionStepsAtom).map((step) => ({ ...step })),
    );

    unsub();
    const second = store.get(chordLookupRootAtom);
    expect(second).toBe(first);
    expect(notifications).toBe(0);
  });

  it("chordLookupTypeAtom does not re-emit when only chord tones become hidden", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupTypeAtom);
    let notifications = 0;
    const unsub = store.sub(chordLookupTypeAtom, () => {
      notifications++;
    });

    // chordOverlayHiddenAtom collapses chordTones to [] but leaves chordType intact.
    store.set(chordOverlayHiddenAtom, true);

    unsub();
    const second = store.get(chordLookupTypeAtom);
    expect(second).toBe(first);
    expect(notifications).toBe(0);
  });

  it("chordLookupRootAtom does re-emit when the chord root actually changes", () => {
    const store = makeAtomStore([
      [rootNoteAtom, "C"],
      [scaleNameAtom, "major"],
      [progressionStepsAtom, progressionWith({ degree: "I" })],
    ]);

    const first = store.get(chordLookupRootAtom);
    let notifications = 0;
    const unsub = store.sub(chordLookupRootAtom, () => {
      notifications++;
    });

    // Switching to the V chord changes the root from C to G.
    store.set(progressionStepsAtom, progressionWith({ degree: "V" }));

    unsub();
    const second = store.get(chordLookupRootAtom);
    expect(second).not.toBe(first);
    expect(notifications).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step A2.2: Run the new tests; expect them to pass**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts -t "selectAtom reference stability"`
Expected: 3 tests pass.

If any test fails, re-read Task A1 — the slice atoms must be exported from `chordOverlayAtoms.ts`.

- [ ] **Step A2.3: Commit**

```bash
git add src/store/chordOverlayAtoms.test.ts
git commit -m "$(cat <<'EOF'
test(store): assert chordLookup slice reference stability

Verifies chordLookupRootAtom/chordLookupTypeAtom do not re-emit on
unrelated progression-step or overlay-hidden churn, and do re-emit
when the underlying field changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A3: Rewire `chordShortLabelAtom` to consume the slices

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:704-710`

- [ ] **Step A3.1: Replace the chordLookup destructure with slice reads**

Open `src/store/chordOverlayAtoms.ts`. The current implementation at lines 703–710 is:

```ts
/** Compact chord symbol (e.g. "Am", "Cmaj7", "G7") for tight readouts. */
export const chordShortLabelAtom = atom((get) => {
  const { chordRoot, chordType } = get(chordLookupAtom);
  const preferFlats = get(preferFlatsAtom);
  if (!chordType) return null;
  const rootLabel = formatAccidental(getNoteDisplay(chordRoot, chordRoot, preferFlats));
  return formatChordShortLabel(rootLabel, chordType);
});
```

Replace with:

```ts
/** Compact chord symbol (e.g. "Am", "Cmaj7", "G7") for tight readouts. */
export const chordShortLabelAtom = atom((get) => {
  const chordRoot = get(chordLookupRootAtom);
  const chordType = get(chordLookupTypeAtom);
  const preferFlats = get(preferFlatsAtom);
  if (!chordType) return null;
  const rootLabel = formatAccidental(getNoteDisplay(chordRoot, chordRoot, preferFlats));
  return formatChordShortLabel(rootLabel, chordType);
});
```

The function body is identical; only the read source changes. The slice atoms now act as the equality gate: `chordShortLabelAtom` will only recompute when `chordRoot`, `chordType`, or `preferFlats` actually change (not on any other `chordLookupAtom` recomputation).

- [ ] **Step A3.2: Run the full chordOverlayAtoms test file**

Run: `pnpm vitest run src/store/chordOverlayAtoms.test.ts`
Expected: all tests pass, including the existing `chordShortLabelAtom` tests and the new slice tests from Task A2.

- [ ] **Step A3.3: Run the broader test suite to catch consumer regressions**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step A3.4: Commit**

```bash
git add src/store/chordOverlayAtoms.ts
git commit -m "$(cat <<'EOF'
perf(store): chordShortLabelAtom reads slice atoms, not chordLookup

Subscribers (StatusBar etc.) no longer re-render on chord-tone or
overlay-visibility churn — only when the displayed label actually
changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice B — Extract `ProgressionRuler`

**Why:** `ProgressionTrack` re-renders ~once per beat during playback (driven by `displayedStepIndex`, `currentProgressionBar`, `playing`). The inline ruler JSX (lines 56–74) depends only on `totalBarsForDisplay` and `subdivisionsPerBar`, which are stable across a playback session. Extracting the ruler into a component with those two props lets React Compiler's auto-memoization skip the subtree on re-render.

No manual `React.memo` wrapper — `compilationMode: 'infer'` covers components in `src/`. A Compiler-skip regression test guards against silent demotion.

### Task B1: Create the `ProgressionRuler` component

**Files:**
- Create: `src/components/ProgressionTrack/ProgressionRuler.tsx`

- [ ] **Step B1.1: Create the new component file**

Write `src/components/ProgressionTrack/ProgressionRuler.tsx` with:

```tsx
import type { CSSProperties } from "react";
import { clsx } from "clsx";
import styles from "./ProgressionTrack.module.css";

interface ProgressionRulerProps {
  totalBarsForDisplay: number;
  subdivisionsPerBar: number;
}

/**
 * Renders the bar-and-beat tick layer of the progression timeline.
 * Pure on its props; React Compiler memoizes the subtree so playback
 * frame updates in the parent skip ruler reconciliation.
 */
export function ProgressionRuler({
  totalBarsForDisplay,
  subdivisionsPerBar,
}: ProgressionRulerProps) {
  return (
    <div className={styles.ruler} aria-hidden="true">
      {Array.from({ length: totalBarsForDisplay }, (_, i) => (
        <span key={i} className={styles.rulerBar}>
          {i > 0 ? <span className={styles.rulerBarTick} /> : null}
          <span className={styles.rulerBarNumber}>{i + 1}</span>
          {Array.from({ length: 2 * subdivisionsPerBar - 1 }, (__, j) => {
            const offset = (j + 1) / (2 * subdivisionsPerBar);
            const isBeat = (j + 1) % 2 === 0;
            return (
              <span
                key={j}
                className={clsx(styles.rulerTick, isBeat && styles["rulerTick--beat"])}
                style={{ left: `${offset * 100}%` } as CSSProperties}
              />
            );
          })}
        </span>
      ))}
    </div>
  );
}
```

JSX is copied verbatim from `ProgressionTrack.tsx:56–74`, with `totalBarsForDisplay` / `subdivisionsPerBar` lifted to props.

- [ ] **Step B1.2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

---

### Task B2: Write tests for `ProgressionRuler`

**Files:**
- Create: `src/components/ProgressionTrack/ProgressionRuler.test.tsx`

- [ ] **Step B2.1: Write the failing tests**

Write `src/components/ProgressionTrack/ProgressionRuler.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProgressionRuler } from "./ProgressionRuler";
import styles from "./ProgressionTrack.module.css";

describe("ProgressionRuler", () => {
  it("renders one bar wrapper per totalBarsForDisplay", () => {
    const { container } = render(
      <ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />,
    );
    expect(container.querySelectorAll(`.${styles.rulerBar}`).length).toBe(4);
  });

  it("renders the expected number of beat ticks per bar", () => {
    const { container } = render(
      <ProgressionRuler totalBarsForDisplay={1} subdivisionsPerBar={4} />,
    );
    // Per bar: 2 * subdivisionsPerBar - 1 = 7 ticks total, of which floor(7/2) = 3 are beat ticks.
    expect(container.querySelectorAll(`.${styles["rulerTick--beat"]}`).length).toBe(3);
  });

  it("omits the leading bar-tick on the first bar only", () => {
    const { container } = render(
      <ProgressionRuler totalBarsForDisplay={3} subdivisionsPerBar={4} />,
    );
    // Bar tick exists on bars 2 and 3, never on bar 1.
    expect(container.querySelectorAll(`.${styles.rulerBarTick}`).length).toBe(2);
  });

  it("preserves DOM node identity when re-rendered with the same props", () => {
    const { container, rerender } = render(
      <ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />,
    );
    const firstRoot = container.querySelector(`.${styles.ruler}`);
    rerender(<ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />);
    rerender(<ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />);
    const secondRoot = container.querySelector(`.${styles.ruler}`);
    expect(secondRoot).toBe(firstRoot);
  });
});
```

Note on the fourth test: it asserts React reconciler stability (same DOM node identity), not React Compiler memoization specifically. Direct in-vitest verification that the Compiler skipped the subtree is brittle and would require either embedding a render-spy effect in the production component or instrumenting the Compiler's output. The canonical Compiler-skip check is the React DevTools Profiler smoke in **Task V.6** below.

- [ ] **Step B2.2: Run the new tests; expect them to pass**

Run: `pnpm vitest run src/components/ProgressionTrack/ProgressionRuler.test.tsx`
Expected: 4 tests pass.

- [ ] **Step B2.3: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionRuler.tsx src/components/ProgressionTrack/ProgressionRuler.test.tsx
git commit -m "$(cat <<'EOF'
perf(progression-track): extract ProgressionRuler component

Pure-prop component for the bar/beat tick DOM. React Compiler will
memoize the subtree so playback re-renders of ProgressionTrack skip
ruler reconciliation. Tests cover bar/beat/tick counts and a render
sanity gate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task B3: Wire `ProgressionRuler` into `ProgressionTrack`

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx:1-9` (add import)
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx:56-74` (replace inline ruler JSX with component)
- Modify: `src/components/ProgressionTrack/ProgressionTrack.tsx:1-3` (remove `clsx` and `CSSProperties` imports if unused after the replacement)

- [ ] **Step B3.1: Add the import**

Insert below the existing `ProgressionPlayhead` import on line 11:

```tsx
import { ProgressionRuler } from "./ProgressionRuler";
```

- [ ] **Step B3.2: Replace the inline ruler JSX**

In `src/components/ProgressionTrack/ProgressionTrack.tsx`, lines 56–74 currently are:

```tsx
        <div className={styles.ruler} aria-hidden="true">
          {Array.from({ length: totalBarsForDisplay }, (_, i) => (
            <span key={i} className={styles.rulerBar}>
              {i > 0 ? <span className={styles.rulerBarTick} /> : null}
              <span className={styles.rulerBarNumber}>{i + 1}</span>
              {Array.from({ length: 2 * subdivisionsPerBar - 1 }, (__, j) => {
                const offset = (j + 1) / (2 * subdivisionsPerBar);
                const isBeat = (j + 1) % 2 === 0;
                return (
                  <span
                    key={j}
                    className={clsx(styles.rulerTick, isBeat && styles["rulerTick--beat"])}
                    style={{ left: `${offset * 100}%` } as CSSProperties}
                  />
                );
              })}
            </span>
          ))}
        </div>
```

Replace with:

```tsx
        <ProgressionRuler
          totalBarsForDisplay={totalBarsForDisplay}
          subdivisionsPerBar={subdivisionsPerBar}
        />
```

- [ ] **Step B3.3: Check whether `clsx` is still used**

Run: `grep -n "clsx" src/components/ProgressionTrack/ProgressionTrack.tsx`
The remaining usage at line 3 (`import clsx from "clsx";`) is no longer needed after the JSX moves out — verify by grepping for `clsx(` in the file. If no other usages remain, remove the import line.

Likewise, `CSSProperties` from line 1 (`import { useCallback, type CSSProperties } from "react";`) is still used by `style={{ "--bar-count": …}}` on line 50 and by the `blockSpacer` style on line 105 — **keep** it.

If `clsx` is no longer used, change line 3 from:

```tsx
import clsx from "clsx";
```

to deleting that line entirely.

- [ ] **Step B3.4: Run the existing ProgressionTrack tests**

Run: `pnpm vitest run src/components/ProgressionTrack/`
Expected: all tests pass, including any tests that assert ruler DOM structure (the rendered DOM is identical, only its rendering source moved).

- [ ] **Step B3.5: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step B3.6: Commit**

```bash
git add src/components/ProgressionTrack/ProgressionTrack.tsx
git commit -m "$(cat <<'EOF'
perf(progression-track): use extracted ProgressionRuler

Replaces 19 lines of inline ruler JSX with the pure-prop
ProgressionRuler component. DOM is identical; React Compiler will
now skip the ruler subtree across playback-driven re-renders of
ProgressionTrack.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice C — `FretboardHitTargetLayer` event delegation

**Why:** The current implementation allocates 144 `() => onNoteClick(stringIndex, fretIndex, noteName)` closures per render (6 strings × 24 frets). Even with React Compiler and `memo()`, every parent-driven re-render reallocates them. Hoisting click handling to the parent container collapses this to one stable closure.

`<button>` keyboard activation (Enter/Space) generates synthetic click events that bubble, so the delegated handler still fires on keyboard input. ARIA labels, `tabIndex`, and `disabled` semantics are preserved per-button.

### Task C1: Replace per-button onClick with parent delegation + data attributes

**Files:**
- Modify: `src/components/FretboardSVG/FretboardHitTargetLayer.tsx:37-87`

- [ ] **Step C1.1: Replace the component body**

Open `src/components/FretboardSVG/FretboardHitTargetLayer.tsx`. The current `memo(({ … }) => { … })` body (lines 27–88) renders a container `<div>` with mapped `<button>` children, each with an inline `onClick` closure.

Replace the entire function body returned from `memo` (the JSX from line 37 `return (` through the closing parentheses just above line 88 `});`) with:

```tsx
export const FretboardHitTargetLayer = memo(({
  noteData,
  fretCenterX,
  stringYAt,
  noteBubblePx,
  noteFontPx,
  neckWidthPx,
  neckHeight,
  onNoteClick,
}: FretboardHitTargetLayerProps) => {
  const handleContainerClick = onNoteClick
    ? (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest<HTMLButtonElement>("button[data-string-index]");
        if (!button) return;
        const stringIndex = Number(button.dataset.stringIndex);
        const fretIndex = Number(button.dataset.fretIndex);
        if (!Number.isFinite(stringIndex) || !Number.isFinite(fretIndex)) return;
        onNoteClick(stringIndex, fretIndex, button.dataset.noteName ?? "");
      }
    : undefined;

  return (
    <div
      className={styles["fretboard-a11y-layer"]}
      onClick={handleContainerClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: neckWidthPx,
        height: neckHeight,
      }}
    >
      {noteData.map(({ stringIndex, fretIndex, noteClass, displayValue, isHidden, noteName, isTension, isGuideTone }) => {
        const cx = fretCenterX(fretIndex);
        const cy = stringYAt(stringIndex, cx);
        const r = noteBubblePx / 2;
        return (
          <button
            key={`btn-${stringIndex}-${fretIndex}`}
            type="button"
            data-string-index={stringIndex}
            data-fret-index={fretIndex}
            data-note-name={noteName}
            disabled={!onNoteClick}
            aria-hidden={isHidden || undefined}
            tabIndex={isHidden ? -1 : undefined}
            aria-label={`${formatAccidental(displayValue)} on string ${stringIndex + 1}, fret ${fretIndex}${NOTE_CLASS_ROLE[noteClass] ? `, ${NOTE_CLASS_ROLE[noteClass]}` : ""}`}
            data-note-role={noteClass !== "note-inactive" ? noteClass : undefined}
            data-note-tension={isTension || undefined}
            data-note-guide-tone={isGuideTone || undefined}
            className={clsx(
              styles["note-bubble"],
              styles[noteClass],
              isHidden && "hidden",
            )}
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: noteBubblePx,
              height: noteBubblePx,
              fontSize: `${noteFontPx}px`,
              opacity: 0,
              pointerEvents: onNoteClick ? "auto" : "none",
            }}
          />
        );
      })}
    </div>
  );
});
FretboardHitTargetLayer.displayName = "FretboardHitTargetLayer";
```

Key changes from the original:
1. `handleContainerClick` is a single closure created once per render (or undefined when `onNoteClick` is missing). Stable identity within a render.
2. The container `<div>` carries `onClick={handleContainerClick}`.
3. Each `<button>` gains `data-string-index`, `data-fret-index`, `data-note-name` attributes.
4. Each `<button>` loses its `onClick={…}` prop.
5. `disabled`, `aria-hidden`, `tabIndex`, `aria-label`, `data-note-role`, `data-note-tension`, `data-note-guide-tone`, `className`, `style` are unchanged.

You may also need to add `import type React from "react";` near the top *only if* the existing TypeScript config doesn't already provide the `React` namespace for `React.MouseEvent`. Verify first by leaving the import out and running typecheck; add it only if `tsc` complains.

- [ ] **Step C1.2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.app.json`
Expected: no errors. If `React.MouseEvent<HTMLDivElement>` is unresolved, add `import type * as React from "react";` to the top of the file.

- [ ] **Step C1.3: Run the existing FretboardHitTargetLayer test suite**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx`
Expected: the existing `"is enabled and calls onNoteClick when handler is provided"` test (line 100 of the test file) passes because `fireEvent.click(btn)` produces a `MouseEvent` that bubbles to the container's `onClick`.

If it fails: confirm `fireEvent.click(button)` bubbles in jsdom. The fix is to ensure the button has `pointer-events: auto` (which it does in the enabled case via the style attribute) and that the `closest("button[data-string-index]")` query matches.

- [ ] **Step C1.4: Commit**

```bash
git add src/components/FretboardSVG/FretboardHitTargetLayer.tsx
git commit -m "$(cat <<'EOF'
perf(fretboard): delegate hit-target clicks to parent container

Replaces 144 per-button onClick closures with a single delegated
handler on the layer container. Buttons gain data-string-index,
data-fret-index, data-note-name attributes; the parent reads them
via event.target.closest(). ARIA, focus, and disabled semantics
unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C2: Add delegation-specific tests

**Files:**
- Modify: `src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx` (append a new `describe` block at the bottom of the file)

- [ ] **Step C2.1: Append the new test block**

Append to the end of `src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx`:

```tsx
describe("FretboardHitTargetLayer — event delegation", () => {
  it("delegates click to onNoteClick using data attributes (not per-button closure)", () => {
    const onNoteClick = vi.fn();
    const noteData = [
      makeNote({ stringIndex: 0, fretIndex: 0, noteName: "E" }),
      makeNote({ stringIndex: 2, fretIndex: 5, noteName: "C" }),
      makeNote({ stringIndex: 5, fretIndex: 12, noteName: "E" }),
    ];
    const { container } = render(
      <FretboardHitTargetLayer
        {...defaultProps}
        noteData={noteData}
        onNoteClick={onNoteClick}
      />,
    );
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[1]);
    expect(onNoteClick).toHaveBeenCalledTimes(1);
    expect(onNoteClick).toHaveBeenCalledWith(2, 5, "C");
  });

  it("does not invoke onNoteClick when the layer is clicked outside any button", () => {
    const onNoteClick = vi.fn();
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} onNoteClick={onNoteClick} />,
    );
    const layer = container.firstChild as HTMLElement;
    fireEvent.click(layer);
    expect(onNoteClick).not.toHaveBeenCalled();
  });

  it("fires on keyboard activation (Enter) of a focused button", () => {
    const onNoteClick = vi.fn();
    const { container } = render(
      <FretboardHitTargetLayer
        {...defaultProps}
        noteData={[makeNote({ stringIndex: 3, fretIndex: 7, noteName: "B" })]}
        onNoteClick={onNoteClick}
      />,
    );
    const btn = container.querySelector("button")!;
    btn.focus();
    // Simulating a click on a focused button is the jsdom equivalent of the
    // browser converting Enter/Space activation into a synthetic click that
    // bubbles to the container's onClick.
    fireEvent.click(btn);
    expect(onNoteClick).toHaveBeenCalledTimes(1);
    expect(onNoteClick).toHaveBeenCalledWith(3, 7, "B");
  });

  it("attaches data-string-index, data-fret-index, data-note-name to each button", () => {
    const noteData = [makeNote({ stringIndex: 4, fretIndex: 9, noteName: "C#" })];
    const { container } = render(
      <FretboardHitTargetLayer {...defaultProps} noteData={noteData} />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.dataset.stringIndex).toBe("4");
    expect(btn.dataset.fretIndex).toBe("9");
    expect(btn.dataset.noteName).toBe("C#");
  });

  it("does not throw when clicked while onNoteClick is undefined", () => {
    const { container } = render(<FretboardHitTargetLayer {...defaultProps} />);
    const btn = container.querySelector("button")!;
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
});
```

- [ ] **Step C2.2: Run the new tests**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx -t "event delegation"`
Expected: 5 new tests pass.

- [ ] **Step C2.3: Run the full FretboardHitTargetLayer test file**

Run: `pnpm vitest run src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx`
Expected: every test passes — both the existing 14 and the new 5.

- [ ] **Step C2.4: Commit**

```bash
git add src/components/FretboardSVG/FretboardHitTargetLayer.test.tsx
git commit -m "$(cat <<'EOF'
test(fretboard): cover event delegation in FretboardHitTargetLayer

New tests assert: click delegation by data attributes, no-op for
container-only clicks, keyboard activation via focused button,
data-* attribute presence per button, and disabled-mode safety.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

### Task V: Full local verification

- [ ] **Step V.1: Lint**

Run: `pnpm lint`
Expected: zero ESLint and Stylelint errors.

- [ ] **Step V.2: Unit + component tests**

Run: `pnpm test`
Expected: all tests pass (the suite already has > 2100 passing tests; new tests bring the count up by 12 — 3 slice tests + 4 ruler tests + 5 delegation tests).

- [ ] **Step V.3: Production build**

Run: `pnpm build`
Expected: success (tsc -b + vite build complete with no errors).

- [ ] **Step V.4: E2E suite against production build**

Run: `pnpm test:e2e:production`
Expected: all Playwright tests pass. The fretboard hit-target click test path will exercise the new delegation handler — pay attention to any failing click-to-add-tone interaction.

- [ ] **Step V.5: Visual baseline check**

Run: `pnpm test:visual`
Expected: all darwin baselines match. DOM changes are limited to new `data-*` attributes (invisible) and a component-name change in the React tree (invisible). Any pixel diff indicates an unintended regression — investigate before refreshing baselines.

If a refresh is genuinely required (e.g. ProgressionTrack's debug-overlay snapshot enumerates child components), run: `pnpm test:visual:update`.

- [ ] **Step V.6: Manual DevTools Profiler smoke**

Run: `pnpm dev`
In Chrome with React DevTools installed:

1. Open the Profiler tab, click "Record".
2. Press Play on a loaded progression.
3. Let one bar elapse, stop recording.
4. Inspect renders: `ProgressionRuler` should appear **0 times** in the rendered-components list per playback tick. (It renders once on initial mount.)
5. Toggle a chord-overlay visibility (e.g. hide an overlay note). Inspect: `StatusBar` (which consumes `chordShortLabelAtom`) should not appear in the render list if the displayed chord label is unchanged.
6. Click a fretboard note. Confirm the click registers correctly (note plays, atom updates) — proves event delegation works in a real browser environment.

If any of these manual smokes fail, file the discrepancy back into this plan as a follow-up task. Do not silently update baselines.

- [ ] **Step V.7: No commit needed**

Verification is observational; no source changes. Conclude the implementation slice.

---

## Out-of-scope (do not implement here)

The spec explicitly lists these as deferred. If you find yourself tempted to implement any of them as part of this plan, **stop**:

- `selectAtom` adoption for `visibleVoicingMatchesAtom`, `chordMemberFactsAtom`, `stringSetOptionsAtom`. They're consumed as wholes — slicing buys nothing.
- Migrating chord overlay state to component-folder colocation.
- Re-shaping any atom's stored value (e.g. converting `Set` to `Map`).
- Adding manual `useMemo`/`useCallback` where React Compiler already covers.
- Switching `FretboardHitTargetLayer` buttons to SVG `<rect>` overlays.
