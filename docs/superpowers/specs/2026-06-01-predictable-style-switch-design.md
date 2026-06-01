# Predictable Style-Switch with Explicit Restart

**Date:** 2026-06-01
**Status:** Approved design, pending implementation plan

## Problem

Switching the backing-track style mid-playback (e.g. jazz → bossa nova) behaves
unpredictably. Users report that sometimes the sound changes immediately,
sometimes on the next bar, sometimes it skips chords, and sometimes it restarts
from zero.

There is also no visible loading state. A spinner on the play/stop button
existed previously but was removed because it flashed during fast operations.

### Root cause

Commit `f5080d8b` ("eliminate playback lag and loading flashes during backing
track updates") deliberately made restart-triggering changes *seamless and
invisible*:

- Old audio keeps playing while new layers compile in the background
  (make-before-break).
- When the async build finishes — at an arbitrary wall-clock moment, **not** a
  musical boundary — the new parts swap in.
- New parts always start at offset `0`, i.e. the progression restarts from
  chord 0 at that arbitrary instant.

Because the swap lands wherever the async build happens to complete:

- Fast build near a bar line → reads as "switched right away".
- Build finishes mid-bar → reads as "skipped chords".
- The restart-to-chord-0 is always present but only noticeable sometimes →
  reads as "starts from zero".

The behavior is not actually random — it is unquantized and position-resetting,
which *reads* as random.

See `src/hooks/useProgressionAudioPlayback.ts` Effect 2 (≈ lines 291–521),
specifically the deferred disposal at lines 400–402 and the part starts at
lines 421–478.

## Goals

- Consistent, predictable behavior when changing what the backing track plays.
- A clear, non-flashing loading state on the play/stop button.
- Interactions that recompile the timeline reset the playhead, show a spinner,
  and restart cleanly from the top.

## Non-goals

- Changing how live parameter updates (tempo, swing, layer toggles, volume,
  mix/quality) behave. They already update instantly and stay that way.
- Quantizing the swap to a bar boundary while keeping old audio playing
  (this approach was considered and rejected in favor of an explicit restart).

## Design

### Core principle: two tiers

Every interaction falls into exactly one tier with one rule each.

**Live tier** — applied instantly, never interrupts playback. *Unchanged from
today.*

- Tempo
- Swing
- Layer on/off toggles (chord, bass, drums, metronome)
- Mute
- Master volume
- Sound mix / audio quality

These never recompile the note timeline, so they continue to update in place
mid-bar.

**Restart tier** — recompiles the note timeline. Always: **reset to bar 1 →
spinner → restart from the top.**

- Style / genre switch (jazz → bossa nova, etc.)
- Individual pattern change (drum, bass, or chord pattern — which also flips the
  picker to "Custom")
- Chord-progression edits (add/remove/change a chord step or its duration)
- Drum variations
- Time signature (beats-per-bar)

The principle: **if it needs a rebuild, it restarts cleanly.** One rule,
regardless of how long the build takes.

> **Decision — time signature:** moved from the live path to the restart tier.
> Beats-per-bar changes the bar structure, so a clean restart is more coherent
> than a live mid-bar shift.

### Philosophy change vs. today

For the restart tier only, we reverse the `f5080d8b` philosophy: instead of a
seamless invisible swap, the load becomes **explicit** and the restart becomes
**clean and deterministic**. The make-before-break crossfade is removed for
restart-tier changes. Live-tier changes are untouched.

### State machine (play/stop button)

```
stopped   → play icon, idle
playing   → stop icon, audio running
loading   → spinner icon, clickable (cancel)
blocked   → disabled (no valid steps)
```

Transitions:

| From    | Event                       | To       | Effect                                                        |
|---------|-----------------------------|----------|---------------------------------------------------------------|
| stopped | press play                  | loading  | reset to bar 1, compile, then play from top                   |
| playing | restart-tier change         | loading  | stop audio immediately, snap playhead + fretboard highlight to bar 1, compile, then play from top |
| loading | press button (cancel)       | stopped  | abort build (bump `genRef`), stop, stay at bar 1              |
| playing | live-tier change            | playing  | no interruption                                               |
| playing | press stop                  | stopped  | stop, reset playhead                                          |
| any     | no valid steps              | blocked  | button disabled                                               |

### Spinner behavior

- The spinner **replaces** the play/stop icon on the button (re-introduces the
  element removed earlier).
- Keep the **150ms debounce**: the spinner only appears if the build exceeds
  150ms. Cache-hit rebuilds restart near-instantly with no flash, but still
  cleanly from bar 1.
- The playhead / visual reset to bar 1 happens **immediately** on the change
  (this is what signals "restarting"), independent of the spinner delay.
- The button stays clickable during loading; clicking it cancels the build and
  returns to `stopped` at bar 1.

### Mechanism

In `src/hooks/useProgressionAudioPlayback.ts`, Effect 2:

- Drop the deferred make-before-break disposal (current lines 400–402). On a
  restart-tier rebuild, dispose old parts and `clearTimeline()` **up front**,
  reset the transport position to 0, then compile.
- Keep the `genRef` generation guard for invalidating superseded or cancelled
  builds.
- New parts already start at offset `0`; starting from a fresh transport makes
  "from bar 1" the natural result once the old transport is no longer carried
  forward.
- Keep the idle background pre-compiler (Effect 1) so changes made *while
  stopped* are cache-warm — pressing play is then an instant cache hit with no
  spinner.

`TransportBar.tsx` renders the spinner when the loading state is active and
keeps the button interactive so the cancel transition works.

### Cancel semantics

Pressing the button while `loading`:

- Bumps `genRef` so the in-flight `getEngine().then(...)` build bails instead of
  starting parts.
- Sets `playing` to false.
- Leaves the playhead at bar 1 (already reset on the change).
- Returns the button to `stopped`.

## Testing

- Update the `TransportBar` tests that currently assert
  `transport-play-spinner` does **not** exist — the element now exists during
  loading.
- New tests:
  - A restart-tier change resets the playhead to bar 1.
  - A live-tier change does not interrupt playback.
  - Cancel-during-load returns to `stopped` at bar 1 and aborts the build.
  - The spinner respects the 150ms debounce (no spinner for fast/cache-hit
    rebuilds; spinner for slow rebuilds).
- Run `pnpm run lint`, `pnpm run test`, and `pnpm run build` before PR.

## Affected files

- `src/hooks/useProgressionAudioPlayback.ts` — restart-tier rebuild path,
  up-front disposal, transport reset, cancel.
- `src/components/TransportBar/TransportBar.tsx` — spinner element, interactive
  loading state.
- `src/components/TransportBar/TransportBar.test.tsx` — spinner assertions.
- `src/store/progressionAtoms.ts` — confirm restart-tier vs live-tier wiring
  (genre/pattern/time-signature triggers).
- Time-signature update path — move from live effect to the restart-tier rebuild
  trigger.
- New/updated tests in `src/hooks/` for restart-tier vs live-tier behavior.
