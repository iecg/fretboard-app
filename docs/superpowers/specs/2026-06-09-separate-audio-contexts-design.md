# Separate the guitar and progression onto two independent AudioContexts

> Status: approved design, pending implementation plan.
> Date: 2026-06-09.

## Problem

Every guitar-audio bug investigated this session traces back to a single
architectural flaw: **the guitar synth and the progression engine share Tone's
one global `AudioContext`, and the progression hijacks it.**

Current arrangement:

- **Guitar** (`src/core/audio.ts`) builds a `Tone.PolySynth` with **no explicit
  context**, so it binds to Tone's auto-created **global/default** context.
- **Progression** (`src/progressions/audio/bus.ts`) creates its **own**
  `new AudioContext()`, then `bindToneToProgressionContext()`
  (`src/progressions/audio/toneBus.ts`) calls `Tone.setContext(progressionCtx)`.
  This is a **process-wide** mutation so that Tone's sequencer, `Transport`,
  `Draw`, and `Tone.now()` clock-sync with the progression's context — which the
  progression genuinely needs.

The flaw: `Tone.setContext()` swaps (and, per its `disposeOld` argument, can
dispose) the **global** context out from under the guitar's already-constructed
nodes. After a progression plays, the guitar is orphaned on a stale context.
Observed symptoms across the session: a fixed ~100ms per-tap lookahead delay,
post-progression fretboard silence, a clock mismatch between the synth's context
and the global one, and a "sticky progression role" workaround in
`audioIdleSuspend.ts` that exists only to paper over the shared-key collision.

## Goal

Give the guitar an `AudioContext` it **owns** and that `Tone.setContext()` can
**never touch**, leaving the global Tone context entirely to the progression.
Two genuinely independent contexts, neither aware of the other.

## Chosen approach: guitar off Tone entirely (raw Web Audio)

The guitar is a fire-and-forget, tap-to-play instrument: an oscillator, an
amplitude envelope, a lowpass filter, `start`/`stop`. It needs none of Tone's
sequencing/transport machinery. We reimplement its voice in **raw Web Audio on
its own dedicated context**. The progression keeps Tone and the global context,
unchanged.

This was preferred over the lower-risk alternative (keep the existing
`Tone.PolySynth` but bind it to a dedicated `Tone.Context` via the per-node
`{ context }` option) because it is the better end-state regardless of risk:

1. **The guitar does not need Tone.** Tone is a sequencing framework; the
   guitar is a one-shot instrument that uses Tone only for voice allocation and
   pays for it with global-context coupling.
2. **It deletes the bug class rather than containing it.** With no shared global
   context, the orphaning, lookahead delay, `setContext` hijack, sticky-role
   hack, and post-progression silence cannot recur — there is no global to fight
   over.
3. **It is the right tool, and a return rather than an invention.** The guitar
   was hand-rolled Web Audio before the Tone migration; raw Web Audio is the
   lower-latency, fewer-moving-parts path for a tap instrument.

The one real cost — reproducing the timbre — is bounded because the recipe is
exact (see below), not guesswork.

## Architecture

| | Guitar | Progression |
|---|---|---|
| Context | own `AudioContext`, created + owned by `audio.ts` | own `AudioContext` (`bus.ts`), unchanged |
| Framework | none — raw Web Audio | Tone.js (global context, unchanged) |
| `Tone.setContext` | never touches it | still binds the progression context globally |
| Scheduling | `ctx.currentTime` (zero lookahead) | Tone lookahead (unchanged) |

`audio.ts`'s public API stays byte-identical — `init()`, `resume()`,
`setMute()`, `playNote()`, `onError`, `onOutputWedged` — so `lazyGuitarAudio.ts`,
`App.tsx`, and every caller are untouched. Only the internals change.

## Voice engine (inside `audio.ts`)

Persistent (shared) nodes built once in `init()`; transient (per-note) nodes
created per tap.

Signal graph:

```
[per-note] OscillatorNode(periodicWave) -> GainNode(envelope)
                                              |
[shared]   -----------------------------------+--> BiquadFilter(lowpass) -> GainNode(master) -> ctx.destination
```

Shared nodes (built once):

- `masterGain`: `.gain = 0.5` (the old `MASTER_GAIN`). Mute ramps the gain to `0`
  / `0.5` over `0.02s`.
- `filter`: `BiquadFilterNode`, lowpass, `frequency 10000`, `Q 0.1`.
- `wave`: `ctx.createPeriodicWave(real, imag)` once, where
  `imag = [0, 1, 0.8, 0.45, 0.22, 0.12, 0.05]` and `real` is the same-length zero
  array. DC term (index 0) is `0`; the partials become the sine-harmonic
  amplitudes, matching Tone's `oscillator.type = "custom"` semantics.

Per-note (`playNote(f)`): an `OscillatorNode` with `setPeriodicWave(wave)`,
`frequency = f` at `t0 = ctx.currentTime` (zero lookahead → instant tap),
feeding a fresh envelope `GainNode`. ADSR scheduled to match Tone's `Synth`
envelope:

- attack: `0 -> 1` over `0.006s`
- decay: `1 -> 0.02` (sustain level) over `0.55s`
- release: at `t0 + 0.5` (NOTE_DURATION), ramp toward `0` over `0.3s`
- `osc.stop(t0 + 0.5 + 0.3 + epsilon)`; `onended` disconnects both transient
  nodes.

Polyphony: an active-voice counter capped at **12** (the old `MAX_POLYPHONY`).
At the cap, skip the new note and `console.warn` — matching today's behavior
where `PolySynth` throws past `maxPolyphony` and we swallow it.

Lifecycle (public API preserved):

- `init()`: lazily build the guitar `AudioContext` (`AudioContext ??
  webkitAudioContext`) plus the shared nodes and wave, then
  `registerAudioContext(guitarCtx, "guitar")`. Set `unsupported = true` on
  failure.
- `resume()`: `init()` then `guitarCtx.resume()` — its own context, no
  `Tone.start()`.
- `playNote(f)`: if `ctx.state !== "running"`, `await ctx.resume()` first (this
  only pays latency when returning from idle-suspend; active tapping keeps the
  context running via `markAudioActivity()`), then schedule. Keep
  `markAudioActivity()` and `checkOutputAfterPlay()`.
- `setMute(mute)`: ramp the master gain; keep the `audioContextUnlocked()` gate
  on the opportunistic resume so a mount-time `setMute(false)` does not try to
  resume before a user gesture.

Timbre note: the partial and envelope numbers are exact, but Tone's default
decay/release *curves* are exponential. Match by ear in `preview:prod` against
deployed v2.6.4 and adjust the curve type (linear vs. exponential ramp) if it is
audibly off. This is the one by-ear step in the implementation.

## File-by-file changes

Core:

- `src/core/audio.ts` — replace the Tone-based internals with the raw Web Audio
  voice engine above. Remove `import * as Tone` and the `ensureToneStarted`
  import. Add the private `ctx`, shared nodes, and per-note scheduler. Keep the
  `registerAudioContext` / `markAudioActivity` / `checkOutputAfterPlay` calls.
  `audioContextUnlocked()` now reads the guitar context's state.

Knock-on simplifications (net deletions):

- `src/core/audioIdleSuspend.ts` — delete the "sticky progression role" branch
  in `registerAudioContext` (it returns early when the existing role is
  `"progression"`); replace with a plain `contexts.set(ctx, role)`. With two
  distinct context keys, role collision is impossible. Update the comment.
- `src/core/audioOutputHealth.ts` — `probeOutputHealth(ctx?: AudioContext)`:
  default to the Tone global (progression) context; the guitar passes its own
  context so its wedge check probes its actual output.

Unchanged: `src/progressions/audio/bus.ts`, `src/progressions/audio/toneBus.ts`,
`src/core/toneInit.ts` (progression keeps the global Tone context),
`src/store/audioAtoms.ts`, `src/App.tsx`, `src/core/lazyGuitarAudio.ts`.

Tests:

- `src/core/audio.test.ts` — substantial rewrite. Drop `vi.mock("tone")` and
  `vi.mock("./toneInit")`. Add a small fake `AudioContext` (jsdom has none)
  exposing `createOscillator`, `createGain`, `createBiquadFilter`,
  `createPeriodicWave`, `destination`, `currentTime`, `state`, `resume`. Assert:
  shared-node construction; `createPeriodicWave` imag equals
  `[0, 1, 0.8, 0.45, 0.22, 0.12, 0.05]`; per-tap oscillator gets the wave +
  frequency + `start`/`stop`; envelope ramps; graph wiring; mute ramp; the
  12-voice cap skips; the unsupported path; `resume()` calls `ctx.resume()`.
- `src/core/audioIdleSuspend.test.ts` — remove the now-obsolete
  sticky-progression test; keep the role and `IDLE_SUSPEND_MS` tests.
- `src/core/audioOutputHealth.test.ts` — add an explicit-context case; keep the
  default-global case.
- `src/App.test.tsx` and `src/integration.test.tsx` — unchanged; they mock
  `./core/lazyGuitarAudio` and never touch `audio.ts` internals.

## Verification

1. `pnpm run lint`, `pnpm run test`, `pnpm run build` all green.
2. `preview:prod`, by ear:
   - A/B the guitar timbre against deployed v2.6.4 (tune the envelope curve if
     needed).
   - Core regression: play a progression, then tap the fretboard — sound
     recovers (this is the bug the split fixes).
   - Idle 30s, then tap — the guitar context resumes and plays.
   - Mute / unmute behaves as before.
3. Remove any temporary instrumentation before finishing.

## Non-goals

- No change to the progression engine, its context, or its Tone usage.
- No change to the guitar's public API or to any caller.
- No new AudioContext-recreation "recovery" logic (the existing Safari
  wedge-detection banner work is separate and unaffected).
