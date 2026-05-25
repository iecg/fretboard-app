# Fix Progression Stutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate visual playhead stutter at chord boundaries by synchronizing state updates to the exact audio clock with Tone.js `Draw`, yielding React's heavy render via `startTransition`, and upgrading the playhead interval to `requestAnimationFrame`.

**Architecture:** We decouple the React UI update from Tone's look-ahead audio scheduling tick by wrapping `advanceProgressionPlayback` in `Tone.Draw.schedule`. We wrap the Jotai state dispatch in `startTransition` so the heavy reconciliation of Fretboard/Progression blocks doesn't starve the browser's animation frame. Finally, we convert `ProgressionPlayhead` from `setInterval` to `requestAnimationFrame` for perfect vsync.

**Tech Stack:** React 18, Tone.js, Jotai, Vitest

---

### Task 1: Update Tone Mocks in Tests

**Files:**
- Modify: `src/hooks/useProgressionPlaybackLoop.test.tsx`

- [ ] **Step 1: Add Tone.Draw mock to `toneMocks`**

Find the `toneMocks` definition. Add the `Draw` object mock that synchronously executes callbacks for testing.

```typescript
// Replace lines around 70-75 (inside toneMocks = vi.hoisted(() => { ... }))
  const getContext = vi.fn(() => ({ now: () => contextNowRef.fn() }));
  const now = vi.fn(() => contextNowRef.fn());

  const Draw = {
    schedule: vi.fn((cb: () => void) => {
      cb();
      return Draw;
    }),
  };

  const _resetEvents = () => {
```

- [ ] **Step 2: Export Tone.Draw in the `vi.mock("tone")` call**

```typescript
vi.mock("tone", () => ({
  setContext: toneMocks.setContext,
  getContext: toneMocks.getContext,
  getTransport: toneMocks.getTransport,
  now: toneMocks.now,
  Draw: toneMocks.Draw,
}));
```

- [ ] **Step 3: Run the tests to verify they still pass**

Run: `npx vitest run src/hooks/useProgressionPlaybackLoop.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/hooks/useProgressionPlaybackLoop.test.tsx
git commit -m "test: mock Tone.Draw in progression loop tests"
```

### Task 2: Synchronize State Updates with Audio Clock

**Files:**
- Modify: `src/hooks/useProgressionPlaybackLoop.ts`

- [ ] **Step 1: Import `startTransition` and `Draw`**

```typescript
// Replace lines 1-3:
import { useEffect, startTransition } from "react";
import { useAtomValue } from "jotai";
import { getTransport, Draw } from "tone";
```

- [ ] **Step 2: Update `scheduleOnce` callback**

```typescript
        // Replace lines around 85-87:
        transportEventId = getTransport().scheduleOnce((time) => {
          Draw.schedule(() => {
            startTransition(() => {
              advanceProgressionPlayback();
            });
          }, time);
        }, `+${remainingSec}`) as unknown as number;
```

- [ ] **Step 3: Run the loop tests**

Run: `npx vitest run src/hooks/useProgressionPlaybackLoop.test.tsx`
Expected: PASS (Our synchronous `Draw.schedule` mock ensures the state update still happens during the test's tick).

- [ ] **Step 4: Commit**
```bash
git add src/hooks/useProgressionPlaybackLoop.ts
git commit -m "fix(audio): sync progression state to audio clock and defer render"
```

### Task 3: Upgrade Playhead to `requestAnimationFrame`

**Files:**
- Modify: `src/components/ProgressionTrack/ProgressionPlayhead.tsx`

- [ ] **Step 1: Remove unused TICK_MS constant**

```typescript
// Delete lines 17-20:
/** ~60 Hz position write interval. Keeping this interval alive while playing
 * lets the playhead recover when playback starts before the audio timeline is
 * armed by the sibling audio effect. */
const TICK_MS = 16;
```

- [ ] **Step 2: Replace `setInterval` with `requestAnimationFrame`**

```typescript
// Replace lines around 77-81 in ProgressionPlayhead.tsx:
    write();

    if (!playing) return;
    let frameId: number;
    const loop = () => {
      write();
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [playing]);
```

- [ ] **Step 3: Run playhead tests**

Run: `npx vitest run src/components/ProgressionTrack/ProgressionPlayhead.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/components/ProgressionTrack/ProgressionPlayhead.tsx
git commit -m "fix(ui): use requestAnimationFrame for progression playhead"
```
