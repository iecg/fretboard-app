# Performance Improvement Plan — Design

**Status:** Brainstorm spec. Produced 2026-05-22 from a trace-led audit of startup, fretboard render, and progression audio scheduling.

**Date:** 2026-05-22

**Scope:** Improve production-first performance for `http://localhost:5173/fretboard-app/` while still benefiting local dev responsiveness. Focus on the current LCP render delay and the click-path INP hotspot without changing the musical model or visible fretboard behavior.

**Non-goals:** No sound-design expansion, no new drum samples, no `Tone.Part` scheduler rewrite in this pass, no route-level app restructuring, and no unrelated fretboard refactors.

---

## 1. Background

The provided trace shows two distinct classes of work:

1. **Startup / LCP**
   - LCP is `709 ms`, with only `7 ms` in TTFB and `702 ms` in render delay.
   - The startup path is therefore dominated by main-thread work, not network latency.

2. **Interaction / INP**
   - The longest interaction is a `click` at `329 ms`.
   - `293 ms` of that is processing time, not input delay.
   - The hottest stack is React passive-effect flush work that reaches the progression audio scheduler and Tone.js constructors.

The code audit maps those findings to concrete sources:

- `src/App.tsx` imports `synth` from `src/core/audio.ts` at module scope.
- `src/components/Fretboard/Fretboard.tsx` also imports the same eager synth path.
- `src/core/audio.ts` imports `tone` at module scope and constructs Tone nodes on demand behind a singleton API.
- `src/components/Fretboard/Fretboard.tsx` hides the fretboard until a layout read / `ResizeObserver` pass sets `containerWidth`.
- `src/hooks/useProgressionAudioPlayback.ts` rebuilds active segments in a React effect when playback state changes.
- `src/progressions/audio/scheduler.ts` schedules many individual hits per step.
- `src/progressions/audio/instruments/pianoVoice.ts`, `organVoice.ts`, `src/progressions/audio/bass.ts`, `src/progressions/audio/drumKit.ts`, and `src/progressions/audio/metronome.ts` allocate fresh Tone synth graphs per scheduled hit.

The existing `docs/superpowers/specs/2026-05-21-backing-track-tonal-audit.md` already identified per-hit Tone allocation as a structural issue. This design turns that audit into a performance-first implementation direction.

---

## 2. Core insight

The app has **two independent hot paths** and they should be treated separately:

1. **The startup path is paying for audio and measurement work too early.**
   The initial render should not have to import the guitar synth runtime or wait for fretboard measurement before the main visual content becomes visible.

2. **The click path is paying for construction instead of scheduling.**
   Playback interactions should mostly enqueue work onto already-live audio primitives. They should not allocate `PolySynth`, `MonoSynth`, `MetalSynth`, `Synth`, filters, oscillators, and disposal timers inside the same effect flush that responds to the user's click.

The chosen approach is therefore **phase the hot spots**:

- first move work off the critical startup path,
- then reuse audio voices without rewriting the full scheduler model,
- and preserve the existing progression, swing, and rendering semantics while doing so.

---

## 3. Chosen approach

Three approaches were considered:

- **A — Phase the hot spots (chosen).**
  Address startup, first paint, and click-path allocation directly while keeping the current progression and pattern architecture intact.
- **B — Audio-engine refactor first.**
  Rewrite scheduling around longer-lived Tone constructs such as `Tone.Part` and broader Transport ownership. Rejected for this pass because it is higher risk and not required to remove the traced bottleneck.
- **C — Render-and-bundle first.**
  Focus on LCP only and leave most playback behavior unchanged. Rejected because it would leave the measured click-path stall mostly intact.

Approach A is the right balance for the user’s stated goal: **both production and dev should improve, but production is the priority**.

---

## 4. Workstream 1 — Startup path / LCP

### Goal

Make the first meaningful paint independent of the audio runtime and avoid gating fretboard visibility on the initial measurement pass.

### Design

#### 4a. Remove eager audio imports from the startup graph

- `src/App.tsx` and `src/components/Fretboard/Fretboard.tsx` should stop importing the audio singleton directly at module scope.
- The guitar-synth path should move behind a lazy audio facade that is only loaded when the user performs an audio-relevant action:
  - first fret click,
  - first mute/unmute interaction that truly needs audio,
  - first explicit resume/play action.

This aligns `src/core/audio.ts` with the existing lazy pattern already present in `src/progressions/audio/bus.ts`.

#### 4b. Keep autoplay correctness

- `src/core/toneInit.ts` and the existing first-gesture resume behavior remain conceptually intact.
- Lazy loading must not fire Tone startup outside a valid user gesture.
- The change is about **when the code is loaded**, not about weakening the autoplay protections.

#### 4c. Stop hiding the fretboard until measurement completes

`src/components/Fretboard/Fretboard.tsx` currently renders the scroll container with:

- `containerWidth === null ? "hidden" : "visible"`,
- immediate `clientWidth` reads in `useLayoutEffect`,
- follow-up `ResizeObserver` logic.

That means a layout read decides whether the main fretboard can appear at all. The redesign is:

- render immediately with a stable fallback width/zoom assumption,
- allow the first paint to occur,
- refine width, overflow, and cursor behavior after paint,
- keep `ResizeObserver` for steady-state resizing.

The fretboard can still settle into its measured layout, but initial visibility is no longer blocked on that settlement.

### Expected effect

- Better production LCP and perceived first paint.
- Less main-thread work on the critical render path.
- Smaller chance of forced reflow around initial fretboard reveal.

---

## 5. Workstream 2 — Click-path / INP

### Goal

Turn playback interactions back into scheduling work instead of allocation work.

### Design

#### 5a. Keep the current scheduler contract

`src/progressions/audio/scheduler.ts` remains the central dispatcher for:

- chord hits,
- bass hits,
- drum lanes,
- metronome clicks,
- swing application in beat space.

This pass does **not** rewrite the progression model or the pattern catalog. It preserves the existing timing semantics and audible behavior.

#### 5b. Replace per-hit voice construction with reusable voices or small pools

The current hot path constructs fresh Tone nodes per hit in:

- `src/progressions/audio/instruments/pianoVoice.ts`
- `src/progressions/audio/instruments/organVoice.ts`
- `src/progressions/audio/bass.ts`
- `src/progressions/audio/drumKit.ts`
- `src/progressions/audio/metronome.ts`

The redesign is:

- chord voices use one reusable `PolySynth` or a tiny stable pool,
- bass uses a reusable mono/pool strategy that still handles overlapping releases,
- drums and metronome use lane-specific reusable instances or small pools sized for overlap,
- cancellation shifts away from “dispose a just-created synth later” toward “release or recycle an already-owned voice.”

This keeps the public scheduling surface stable while removing the expensive constructors from the interaction path.

#### 5c. Keep the shared audio clock binding intact

`src/progressions/audio/toneBus.ts` correctly binds Tone to the shared progression `AudioContext`. That behavior is load-bearing and must remain unchanged.

### Expected effect

- Material INP improvement on play/toggle interactions.
- Less GC pressure from bursty Tone allocation.
- Fewer long passive-effect flushes in React when playback state changes.

---

## 6. Workstream 3 — Render-path guardrails

### Goal

Improve performance without changing the app’s musical or visual contract.

### Guardrails

- Preserve current progression timing and audio-clock ownership.
- Preserve current pattern IDs, swing behavior, and progression step semantics.
- Preserve current fretboard layout behavior after the initial paint settles.
- Avoid unrelated refactors inside `FretboardSVG.tsx` unless a change is directly required for the first-render plan.

### Notes

The trace came from localhost dev mode, so React StrictMode and dev-tooling overhead likely inflate the raw timings. That does **not** invalidate the root causes:

- eager audio imports still hurt production startup,
- per-hit Tone allocation still hurts production interactions.

This plan therefore treats dev-mode noise as measurement noise, not as the target architecture.

---

## 7. Phasing

This work should be implemented in three shippable phases.

### Phase 1 — Startup path

- Introduce the lazy audio facade for the guitar synth path.
- Remove eager startup imports from `App.tsx` and `Fretboard.tsx`.
- Change `Fretboard.tsx` so initial visibility does not depend on `containerWidth` being measured.

**Primary win:** LCP / startup render delay.

### Phase 2 — Voice reuse

- Refactor piano, organ, bass, drums, and metronome helpers to reuse stable Tone resources.
- Preserve the `schedule*` API surface so `scheduler.ts` changes remain minimal.

**Primary win:** INP / click-path processing time.

### Phase 3 — Follow-up hardening

- Trim any leftover layout thrash in fretboard overflow/cursor logic.
- Add focused regression tests and confirm the startup and interaction traces improved.
- Reassess whether a larger scheduler rewrite is still needed after the cheaper wins land.

**Primary win:** stability and evidence.

---

## 8. Testing and verification

Use the repo’s existing test/build shape:

- `pnpm run lint`
- `pnpm run test`
- `pnpm run build`

Add or update focused tests where coverage is thin:

- lazy audio facade behavior,
- first-interaction audio resume behavior,
- reusable voice lifecycle / cancellation,
- fretboard initial render behavior when width is not yet measured.

Performance verification should include:

- production bundle inspection,
- a fresh production-oriented trace,
- confirmation that playback clicks no longer spend most of their time constructing Tone synth graphs.

---

## 9. Acceptance criteria

- Tone-backed guitar audio is no longer part of the critical startup graph unless the user actually engages audio.
- The fretboard can paint on initial load without waiting for the first measurement pass to flip visibility.
- Playback-related clicks no longer allocate fresh Tone synth graphs per scheduled hit on the hot path.
- Existing playback timing, swing, and progression behavior remain intact.
- `pnpm run lint`, `pnpm run test`, and `pnpm run build` pass after implementation.

---

## 10. Out of scope for this pass

These remain valid future work, but are intentionally not part of this design:

- `Tone.Part` / Transport lane rewrite of the full scheduler,
- drum samples via `Tone.Players`,
- effects-chain/sound-design upgrades,
- large `FretboardSVG.tsx` render-graph simplification,
- broader route/component chunking beyond the audio path.
