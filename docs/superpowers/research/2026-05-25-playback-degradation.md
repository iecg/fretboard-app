# Playback Degradation + Chord-Transition Stutter — Investigation

**Date:** 2026-05-25
**Method:** Static analysis only (no browser repro available).
**Branch:** `claude/elated-nobel-dd4e76` at HEAD `8268ef39`.
**Top-of-stack relevant commits:** `ae8ecaaa` (RAF playhead), `3fa9ce59` (sync to audio clock), `54a406cd` (Tone.Draw test mock), `183caeb` (`getDraw().expiration = 5`).

The two symptoms are diagnosed against the post-P2 codebase. Symptom 1's leading hypothesis is a **per-pluck `Tone.PluckSynth` allocation** in `src/progressions/audio/string.ts:43-72` that has no pool. Symptom 2's leading hypothesis is that **`chordOverlayAtoms` returns a freshly-built `Set<string>` / voicings array on every chord change**, defeating both React Compiler auto-memoization and an anachronistic manual `memo()` wrapper on `FretboardSVG` (added pre-Compiler in PR #388, never removed in the Compiler adoption PR #456). The heavy SVG and its connector hooks reconcile in full on every chord boundary. **Recommended fix is upstream:** stabilize atom return values by value-fingerprint, then drop the now-redundant manual `memo()` to align with the project's "trust the Compiler" convention.

---

## Symptom 1: Audio degradation over many loops

### Reproduction (theoretical)
Press play with the default `strum` chord instrument and the `loopEnabled` toggle on. Let the progression run unattended for >2 minutes (~10+ loop wraps at default tempo). Listen for any of: late/dropped strum notes, increased buffer-underrun "crackle," progressively muddier ring-out, or a slow rise in CPU. The user did not specify the exact percept, so the candidate causes below cover all common degradation modes.

### Evidence gathered (code paths inspected)

1. **`src/progressions/audio/string.ts:42-73` — `pluckString`** allocates a brand new `Tone.PluckSynth` **every call**:
   ```ts
   const synth = new Tone.PluckSynth({ ... });
   synth.connect(dest);
   synth.volume.value = Tone.gainToDb(...);
   synth.triggerAttack(frequency, startTime);
   // ...
   setTimeout(() => synth.dispose(), DISPOSE_TAIL_MS); // DISPOSE_TAIL_MS = 1100
   ```
   There is no pool — `strumVoice` calls `pluckString` once per chord note per strum hit (`src/progressions/audio/instruments/strumVoice.ts:18-24`). At a typical 4-string voicing + 8th-note strum pattern + 120 BPM, that's ~64 PluckSynth construct/dispose cycles **per bar**, and the cleanup is scheduled via plain `setTimeout`, not via the Transport.
2. **`src/progressions/audio/bass.ts:32-47`, `drumKit.ts:81-137`, `instruments/createReusableChordVoice.ts:21-74`** — every other voice family **does** pool via `createReusableVoicePool` (or `createReusableChordVoice` for piano/organ). The strum path is the only outlier. This pattern was clearly intentional everywhere else; the strum path looks like a missed migration.
3. **`Tone.PluckSynth`** wraps a `LowpassCombFilter` + noise burst. Each instance allocates a feedback comb (delay + filter + gain), a `Noise` source, and a `Volume` node. None of these are cheap to construct/tear down at audio rate; sustained churn at 60+ Hz against the `AudioContext` graph is exactly the workload Web Audio is least happy with.
4. **`src/progressions/audio/bus.ts:48-71` — `ensureProgressionAudio`** caches the AudioContext + master GainNode in module-scope `ctx`, `bus`, `layers`. So the AudioContext itself is *not* recreated each loop, ruling out one common degradation source.
5. **`node_modules/tone/build/esm/core/util/Draw.js`** — `Draw._events` is a `Timeline` and `_drawLoop` calls `this._events.remove(event)` for every event it visits, whether expired or fired. Drained correctly, no leak.
6. **`node_modules/tone/build/esm/core/clock/Transport.js:86-94`** — Transport's `Clock` derives its time from `context.currentTime` (same `AudioContext`), so there is no separate JS clock to drift against. **Tone.Part stores events as ticks, not seconds**, so once a Part is built, looping is handled by the Tone scheduler against the audio clock; the JS layer does not re-queue events per loop.
7. **`src/hooks/useProgressionAudioPlayback.ts:206-416` Effect 1** is keyed on `playing, blocked, muted, buildKey` only. Tempo/swing/loop changes do NOT rebuild Parts. **A pure loop wrap (no atom change) does not re-run Effect 1**, so the four `Tone.Part`s and metronome `Loop` are constructed exactly once per playback session and reused for the whole loop life.
8. **Part backlog** — `Part._events` is a `Set`, populated only at `add()` time. Looping inside `Tone.Part` uses `scheduleRepeat` (`ToneEvent.js:_rescheduleEvents` ~line 80), which writes a single `event.id` into the Transport timeline and lets the clock fire it. **It does not accumulate per-loop entries.** This refutes H4.
9. **Voice pool growth** — `createReusableVoicePool` (`src/progressions/audio/createReusableVoicePool.ts:23`) uses a `WeakMap` keyed on the destination `AudioNode`. The destination here is one of four long-lived layer-bus GainNodes (constructed once in `buildLayerBuses`). **The WeakMap entry list grows only when `busyUntil` never frees an existing entry** at the moment a new lease is requested. `busyUntil` is set to `playbackStartTime + noteLen + RELEASE_TAIL_SEC` (for bass) or analogous values for drums. If two consecutive same-voice hits happen within `releaseTail`, the pool allocates a new entry. Over long playback the array stays bounded by the *peak* simultaneous busy count, not by total hits — so this is not a true unbounded growth, just a one-time ramp to a steady-state ceiling. Fine.
10. **`createReusableChordVoice.ts:88`** sets `entry.busyUntil = playbackStartTime + durationSec + config.releaseTailSec`. For organ in sustained mode, `durationFor` returns 1.5s + 0.6s releaseTail = 2.1s. With chord changes every 2s (one bar at 120 BPM), the same `dest` will accumulate ~1 entry per chord until the pool stabilizes — bounded, not a leak.

### Ranked hypotheses

**H1 — `pluckString` allocates a fresh `Tone.PluckSynth` per strum note. (HIGH likelihood)**
- **For:** All other voice families pool. `string.ts:43` does `new Tone.PluckSynth(...)` unconditionally inside the scheduling hot path. `DISPOSE_TAIL_MS = 1100`, so the construct/dispose churn lags the trigger by >1s — many bars of overlapping in-flight synths.
- **For:** Each `PluckSynth` carries a `LowpassCombFilter` + `Noise` + `Volume` node + per-voice `connect()` to the layer bus. WebAudio node churn at high rate is a known cause of progressive audio-thread degradation and eventual buffer underruns.
- **For:** The `setTimeout`-based dispose (line 65) is keyed on wall-clock, not on the audio clock — under a janky main thread the dispose can pile up, briefly inflating the active-node count.
- **Against:** None from static analysis. The smoking gun is the asymmetry with every other voice in the same package.
- **Specifically explains "after a few loops":** the first loop primes the dispose pipeline; degradation correlates with the number of un-disposed PluckSynths in flight, which grows linearly with elapsed time until the dispose-timeouts catch up at steady state. For users running `strum` (default instrument) this is the path that fires every loop.

**H2 — Slow leak of in-flight `setTimeout` dispose callbacks under main-thread stall. (MEDIUM, coupled to H1)**
- **For:** `string.ts:65`, `bass.ts:101`, `drumKit.ts:70` all use `setTimeout(() => lease.dispose(), tailMs)` for release-tail dispose. If the main thread stalls (e.g. during the chord-overlay render — see Symptom 2), the queued timeouts back up. When they finally fire, a burst of `dispose()` calls hits the audio graph in one frame, which itself can cause a click/dropout.
- **Against:** Bass/drums dispose timeouts are short (50ms–1.5s) and the `lease.dispose()` is idempotent. They don't keep the synth itself running — just the cleanup.
- **Refines H1:** The PluckSynth path is the worst case because (a) no pool, (b) longest tail (1100ms), (c) up to 4 calls per chord strum.

**H3 — AudioContext clock drift over many loops. (REJECTED)**
- **Against:** `Transport._clock` derives from `context.currentTime` directly (`Transport.js:86-94`). Tone.Part stores events as ticks (refer to `Part.js` `_state` and `_startNote` using `TicksClass`); on every loop wrap the same tick is reinterpreted against the live transport clock. There's no JS-side accumulator that could drift.

**H4 — `Tone.Part._events` accumulates entries over loops. (REJECTED)**
- **Against:** `Part._events` is populated only at `add()` time (called in `createProgressionPart` once at build). Looping is implemented by `ToneEvent._rescheduleEvents` setting `event.id = transport.scheduleRepeat(...)` with `interval = loopDuration`. The Transport handles re-firing; the `Set` doesn't grow.

**H5 — Voice pool entries grow without bound. (REJECTED for steady-state; possible for pathological pattern density)**
- **Against:** `createReusableVoicePool` reuses an entry whenever `busyUntil <= now`. Steady-state pool size = peak concurrent busy entries, not total hits.
- **Caveat:** `createReusableChordVoice` (piano/organ) reuses by `busyUntil` too; the `entry.leaseGeneration` bookkeeping prevents stale `cancel()` from interfering. Look acceptable.

**H6 — `entry.busyUntil` arithmetic off in one voice family. (LOW, ruled out by reading)**
- All call sites compute `busyUntil = max(now, time) + noteLen + releaseTail`, and `lease()` (line 47-48) reuses entries with `busyUntil <= now`. The `Tone.now()` argument is correct (audio clock). No obvious off-by-one.

### Recommended next step

**Static analysis points at H1 with high confidence — recommend instrumentation to confirm before fixing.**

Add this in `src/progressions/audio/string.ts` for one playthrough:
```ts
// At module scope:
let liveCount = 0;
let totalCreated = 0;
// In pluckString, after `const synth = new Tone.PluckSynth(...)`:
liveCount++; totalCreated++;
if (totalCreated % 32 === 0) {
  console.log(`[pluck] live=${liveCount} total=${totalCreated}`);
}
// In the setTimeout cleanup, before `synth.dispose()`:
liveCount--;
```

**Predicted output under H1:** `live` climbs through the first 1–2 seconds, plateaus around `(strums/sec × chord notes × 1.1s)` = roughly 8–30, then stays flat. `total` climbs linearly forever. If audio degradation correlates with sustained `live > ~20`, H1 confirmed.

**Recommended fix shape (no code):** Pool `Tone.PluckSynth` instances by destination, same pattern as `bass.ts`. Lease per voice, set `busyUntil = startTime + RELEASE + epsilon`, and have `cancel()` defer the *release-tail* not the *dispose*. Files: `src/progressions/audio/string.ts` (rewrite around `createReusableVoicePool`), no caller changes needed (preserve `PluckedVoiceHandle`).

---

## Symptom 2: Visual stutter on chord transition

### Reproduction (theoretical)
Enable Lock-to-scale (`chordSnapToScaleAtom = true`) with `voicing = "full"`. Start a 4-chord looped progression at 120 BPM with 1-bar steps so chord onsets fire every 2 seconds. Watch the playhead arrow during chord changes. Symptom: a visible pause / jump at the moment the chord overlay swaps.

### Evidence gathered

1. **`src/components/FretboardSVG/FretboardSVG.tsx:141`** wraps `FretboardSVG` in `memo(...)` with **no custom equality function**. So React uses `Object.is` per prop. **This `memo()` is anachronistic:** PR #388 (`1b06e9eb perf(fretboard): optimize animation performance`) added it in the pre-React-Compiler era; PR #456 (`41dba986 perf(react): adopt react-compiler app-wide`) later turned on the Compiler with `compilationMode: 'infer'` (`vite.config.ts`) but never removed the manual wrapper. Per `CLAUDE.md`'s React Compiler section: *"manual useMemo / useCallback / React.memo is rarely needed for render-perf and should be added only when profiling proves it"*. The wrapper now adds a shallow-comparison cost on every render with no payoff at chord boundaries (its props are reference-fresh — see points 2-4).
2. **`src/components/Fretboard/Fretboard.tsx:127-138`** passes `fullChordPositionKeys` (a `Set<string>`) and `fullChordVoicings` (an array of objects) to `FretboardSVG`. `fullChordPositionKeys` is sourced directly from `state.fullChordPositions` (line 127), which is the value of `chordHighlightPositionsAtom`.
3. **`src/store/chordOverlayAtoms.ts:545-583` — `chordHighlightPositionsAtom`** always returns a **new `Set<string>`** (`new Set(...)`, line 555-583). Jotai re-evaluates derived atoms whenever a dependency changes; the active chord root/quality change every onset, so the Set's reference identity flips on every chord change.
4. **`fullChordVoicings`** in `Fretboard.tsx:129-137` is a `useMemo` keyed on `state.fullChordMatches`. `fullChordMatches` flows from `voicingMatchesAtom` (`chordOverlayAtoms.ts:521`) which returns the array from `fullVoicingsAtom` / `closeCandidatesAtom`. Both rebuild the array on chord change.
5. **Net effect:** The `memo` barrier on `FretboardSVG` only fires when *neither* the highlight Set nor the voicings array reference changed. On chord onset, both change, so `FretboardSVG` reconciles its full tree (the SVG is ~606 lines, with `useNoteData`, `useChordConnectorPolylines`, `useIntervalConnectorPolylines`, and 6+ child layers).
6. **`src/hooks/useProgressionAudioPlayback.ts:286-293`** wraps the React write in `Draw.schedule`:
   ```ts
   if (event.isFirstBar) {
     getDraw().schedule(() => setActiveStepIndex(event.stepIndex), audioTime);
   }
   ```
   `Draw.schedule` defers to the next `requestAnimationFrame`. The Jotai write is synchronous inside that RAF. **The synchronous heavy commit happens during the same frame the playhead RAF is trying to run** — that frame's "write playhead position" callback (`ProgressionPlayhead.tsx:77-79`) runs either right before or right after the heavy commit, depending on RAF ordering.
7. **`ProgressionPlayhead.tsx:50-71`** writes only `el.style.left = ...%` — that's cheap. But if the chord-commit takes longer than one frame (16ms), the next RAF can't fire on time, so the playhead pauses for one frame (or several) until the commit finishes. That's the visible stutter.
8. **`useProgressionAudioPlayback.ts:279-285`** — `setActiveStep` (timeline state, not React) fires **on every bar**, not just every chord change (even for multi-bar steps). That's a non-React write to module-scope state. It's not a React render — refutes H6 as a stutter cause.
9. **`useNoteData`, `useChordConnectorPolylines`** (deep dependents of `chordTones`, `fullChordPositionKeys`) are React Compiler–memoized, but their inputs are *new Set / new array each chord*. The compiler memoization keys on referential identity, so the cache misses every chord change. Each hook re-runs its computation (geometry transforms, polyline builds, connector layouts) inline on the commit thread.

### Ranked hypotheses

**H5 — Reference-fresh Set / array props from `chordOverlayAtoms` defeat both the manual `memo` and React Compiler's auto-memoization; the heavy SVG commit overruns one frame and starves the playhead RAF. (HIGH)**
- **For:** Direct code evidence (FretboardSVG.tsx:141 + Fretboard.tsx:127 + chordOverlayAtoms.ts:545). The shallow-equality `memo` is a no-op for the props that actually change at chord boundaries (`new Set()` per atom evaluation → fresh reference).
- **For:** The same reference-freshness defeats React Compiler's downstream memoization too. The Compiler's `useMemoCache` keys on referential identity (per `useMemo` semantics); when atom-derived inputs flip ref every chord change, every downstream hook (`useNoteData`, `useChordConnectorPolylines`, `useIntervalConnectorPolylines`) re-runs its work. So the manual `memo()` and the Compiler are both deceived by the same upstream pattern; removing the manual wrapper without fixing the atom doesn't help, and fixing the atom while leaving the wrapper just makes the wrapper's shallow equality finally true. **The root fix is upstream stability, not the memo wrapper.**
- **For:** The commit work is non-trivial — six child layers, dozens of polygons/polylines, connector geometry recomputed against the new chord.
- **For:** Matches the symptom exactly — "still a visual stutter on chord transition" after Draw alignment, because Draw alignment puts the heavy commit *on the same frame* as the playhead write.

**H7 — `chordOverlayAtoms` derived atoms perform heavy compute (voicing generation) inline on every chord change. (HIGH, contributes to H5)**
- **For:** `closeCandidatesAtom`, `fullVoicingsAtom`, `chordHighlightPositionsAtom` all call `generateVoicings({ ..., maxFret: 24, voicingType: "full"/"close" })` (lines 333-339, 422-429, 488-492). `generateVoicings` is the CAGED engine; for a 24-fret window it can return dozens of voicings. Triggered synchronously inside Jotai's read phase, on the commit thread.
- **For:** Both `voicingMatchesAtom` and `chordHighlightPositionsAtom` consume `fullVoicingsAtom`. Jotai caches per atom-graph snapshot, so the heavy work should run once per chord — but it *does* run once per chord, blocking the commit phase.
- **Against:** No direct evidence of how long `generateVoicings` actually takes — could be sub-millisecond. Needs profiler measurement.

**H8 — React Compiler memoization inside hooks doesn't help because inputs are reference-fresh per render. (MEDIUM, structural to H5)**
- **For:** React Compiler keys its memoization on referential identity (per `useMemo` semantics it auto-emits). A `new Set()` per atom evaluation defeats this everywhere downstream.
- **Net:** Same root cause as H5 — fix is upstream stability in `chordOverlayAtoms.ts`, not local memo gymnastics. Once the atoms return stable references for value-equal chord state, the Compiler's auto-memoization Just Works and no manual `memo`/comparator is needed at the `FretboardSVG` boundary.

**H6 — `setActiveStep` fires every bar; spurious re-renders on multi-bar chords. (REJECTED as stutter source)**
- **Against:** `setActiveStep` writes to timeline.ts module state, not a Jotai atom. No React subscriber. The playhead reads via `getTimelinePosition()` in its RAF loop — no re-render triggered.

### Recommended fix shape

Three-step structural fix (no code yet), ordered most-to-least important:

1. **Stabilize the props at the source — fix the atom, not the consumer.** In `src/store/chordOverlayAtoms.ts:545-583`, make `chordHighlightPositionsAtom` cache its `Set` and return the previous reference when the underlying highlight set is value-equal. Easiest path: have the atom store both the computed `Set` and a "fingerprint" (sorted-keys join), and return the prior `Set` reference when the fingerprint matches. Apply the same pattern to `voicingMatchesAtom` / `fullVoicingsAtom` / `closeCandidatesAtom`. This single change benefits every downstream consumer — `FretboardSVG`, the connector hooks, and any future consumer — because it makes React Compiler's auto-memoization (and any explicit `useMemo`) actually short-circuit on equal chord state. **Highest leverage of the three.**

2. **Drop the manual `memo()` wrapper from `FretboardSVG`** (`FretboardSVG.tsx:141`). With React Compiler enabled app-wide (`compilationMode: 'infer'` per `vite.config.ts`), manual `memo()` violates the project's stated convention (`CLAUDE.md`: *"manual React.memo is rarely needed for render-perf and should be added only when profiling proves it"*). Replace `export const FretboardSVG = memo(function FretboardSVG(...) { ... })` with `export function FretboardSVG(...) { ... }` and drop the unused `memo` import. Once step 1 lands, the upstream stability makes the Compiler's internal memoization correct without the wrapper; the wrapper then becomes pure overhead (cost of shallow-eq, no payoff).
   - **Why not "keep the memo and give it a value-aware comparator" instead:** that's belt-and-suspenders against the Compiler's already-correct behavior — extra LOC, extra runtime cost, no measurable gain once step 1 is in place. The codebase's convention is "trust the Compiler"; deviating requires a profiling-proven justification, which we don't have.

3. **(Optional fallback)** **Defer the React commit off the audio-sync frame.** Even with steps 1+2 the chord-onset commit may be non-trivial on slow hardware. Consider scheduling `setActiveStepIndex` via `Tone.Draw` at `audioTime - oneFrameSec` (gives the commit ~16ms of headroom before the audible onset) **or** wrap the Jotai write in `startTransition` (was explicitly avoided per the comment at `useProgressionAudioPlayback.ts:113-114`; revisit that decision now that we understand it's the rendering cost that's the bottleneck, not the freshness of the write).

**Can't fully confirm without runtime data:** which of the three gives the biggest win. Step 1 is the structural fix and should land first. Step 2 is a small cleanup that aligns with project conventions. Step 3 is the fallback if value-stable memoization isn't enough.

---

## Instrumentation to add (for runtime confirmation)

**A. Confirm PluckSynth churn (H1):**
```ts
// src/progressions/audio/string.ts, module scope:
let pluckLive = 0; let pluckTotal = 0;
// Inside pluckString, after `const synth = new Tone.PluckSynth(...)`:
pluckLive++; pluckTotal++;
if (pluckTotal % 32 === 0) console.log(`[pluck] live=${pluckLive} total=${pluckTotal}`);
// Inside the setTimeout cleanup, before `synth.dispose()`:
pluckLive--;
```
Expected under H1: `live` plateaus around 8–30, `total` climbs linearly. Degradation onset correlates with sustained `live > ~20`.

**B. Confirm chord-commit cost (H5):**
```ts
// src/components/FretboardSVG/FretboardSVG.tsx, top of the function body:
const t0 = performance.now();
useEffect(() => {
  const dt = performance.now() - t0;
  if (dt > 8) console.log(`[FretboardSVG commit] ${dt.toFixed(1)}ms`);
});
```
Expected under H5: most commits log nothing; chord-boundary commits log 12–40ms (overruns the 16ms frame budget).

**C. Confirm prop reference-freshness at chord boundaries (H5).** This swaps a *diagnostic-only* comparator into the existing `memo()` to log which props change. **It is NOT the recommended fix** — revert after measurement. The recommended fix is upstream atom stability (see "Recommended fix shape" step 1).
```ts
// src/components/FretboardSVG/FretboardSVG.tsx — TEMPORARY DIAGNOSTIC ONLY
let renderCount = 0;
export const FretboardSVG = memo(function FretboardSVG(...) { ... }, (a, b) => {
  const eq = Object.keys(a).every(k => Object.is(a[k as keyof typeof a], b[k as keyof typeof b]));
  if (!eq) {
    renderCount++;
    const diffs = Object.keys(a).filter(k => !Object.is(a[k as keyof typeof a], b[k as keyof typeof b]));
    if (renderCount % 4 === 0) console.log(`[FretboardSVG] render #${renderCount} diffs:`, diffs);
  }
  return eq;
});
```
Expected under H5: `diffs` always includes `fullChordPositionKeys` and `fullChordVoicings` at chord boundaries → confirms the upstream atoms are returning fresh references on every chord change, which is what step 1 fixes.

**D. Confirm voicing engine cost (H7):**
```ts
// src/store/chordOverlayAtoms.ts, inside fullVoicingsAtom and closeCandidatesAtom getters:
const tStart = performance.now();
const all = generateVoicings({...});
const dt = performance.now() - tStart;
if (dt > 2) console.log(`[generateVoicings] ${dt.toFixed(1)}ms (${all.length} voicings)`);
```
Expected under H7: 1–5ms per chord on a modern laptop, more on slow hardware. If consistently >8ms, H7 is itself a meaningful contributor.

---

## Out of scope (orthogonal findings)

1. **`useProgressionAudioPlayback.ts:188-204`** — `buildInputsRef` is mirrored in a no-deps `useEffect` (runs after every render) but `Effect 1` (the heavy build) runs `buildInputsRef.current = ...` only AFTER its own commit; this means a re-render that mirrors fresh inputs into the ref will run AFTER Effect 1 reads them. The comment claims React commits no-deps effects before keyed effects "in the same render" — that's true within one render, but the ref is updated after Effect 1 has already read it for that render. For tempo/swing/beatsPerBar/loopEnabled, this is fine because dedicated live-update effects re-sync (Effects 2-5, 7), but the comment is misleading. Not a bug, but worth tightening.
2. **`bus.ts:65-70`** — `getDraw().expiration = 5` is set inside the `if (!ctx || !bus || !layers)` first-init branch. If the AudioContext ever needs to be recreated (it currently can't), the expiration would not re-apply. Defensive — set it on every successful `ensureProgressionAudio()` return.
3. **`chordHighlightPositionsAtom`** is invoked from multiple consumers — every consumer triggers Jotai to invalidate downstream atoms when the Set reference flips. Memoizing it (per the Symptom-2 fix) compounds wins across the whole UI tree, not just `FretboardSVG`.
4. **`createReusableChordVoice.ts:106-119`** — the `cancel()` path computes `cancelTime` from `Tone.now()` (audio clock) but compares against `time` and `entry.busyUntil` (which are also audio-clock). Internally consistent, but the comment at 117 ("Same release-tail pattern as metronome.ts") is referring to a cancel-from-future code path that uses `releaseAll(cancelTime)`. The `cancelTime < time` branch on line 107 disposes the synth instead of trying to release at a past time — looks correct but is the kind of thing easy to break in a refactor; worth a unit test specifically covering "cancel before scheduled start."
