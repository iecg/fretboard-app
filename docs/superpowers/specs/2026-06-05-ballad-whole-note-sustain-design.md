# Ballad "Whole Notes" — bar-aware chord sustain

## Problem

The "Ballad Whole Notes" backing-track chord pattern (`ballad-whole`,
`src/progressions/audio/patterns.ts`) does not ring for a whole note. It rings
for roughly a half note (or less), so the label is wrong and the comp sounds
clipped at typical ballad tempos.

### Root cause

`ballad-whole` emits a single chord hit at beat 0 with `style: "sustained"`.
The ballad genre uses `chordInstrument: "piano"`
(`src/progressions/audio/genres.ts`), so the hit is rendered by
`createReusableChordVoice`. That voice rings the chord for a **fixed** duration —
the patch's `sustainedDurationSec` (Grand Piano = `1.4s`,
`src/progressions/audio/sound/instrumentPatches.ts`).

The fixed duration is neither tempo-aware nor bar-aware:

- At ~70 BPM a beat is ~0.857s, so a whole note (4 beats in 4/4) is ~3.43s.
- A fixed 1.4s ring is ~1.6 beats — about a half note.

Compounding the issue, `createReusableChordVoice` **ignores**
`ChordVoiceOptions.durationSec` entirely; only the strum voice honors it. So even
if `buildAllLayers` passed a real per-hit duration, the piano voice would drop
it.

## Goal

A "whole note" chord pattern rings for the full bar at any tempo, via a
tempo-aware, bar-aware sustain duration. Behavior for all other patterns and
genres is unchanged.

## Approach

Bar-aware sustain duration computed in the scheduler, honored by the chord voice.

`ballad-whole` is currently the only pattern using `style: "sustained"`, so the
change is tightly scoped to the piano path. Strum-based genres (rock, funk) never
route a sustained hit through this code.

### Change 1 — compute bar-aware sustain in `buildAllLayers.ts`

In the chord-hit loop, for a `style: "sustained"` hit, set:

```text
durationSec = (nextHitBeat - hit.beat) * secondsPerBeat
```

where `nextHitBeat` is the next hit's beat within the bar, or `eventBeats` (bar
end) when the sustained hit is the last hit in the bar. For `ballad-whole` this
is `4 * secondsPerBeat` — a full bar in 4/4, scaling correctly with tempo and
meter.

Existing articulation-based durations (`muted`, `root`, `stab`, `color-stab`)
keep their current fixed values. Non-sustained, non-articulation hits stay
`undefined` (patch default), preserving today's behavior.

### Change 2 — honor `options.durationSec` in `createReusableChordVoice.ts`

```ts
const durationFor = (o: ChordVoiceOptions) =>
  o.durationSec ?? (o.style === "sustained" ? spec.sustainedDurationSec : spec.shortDurationSec);
```

The explicit per-hit duration wins; the patch default remains the fallback when
no override is supplied. Update the now-stale doc comment on
`ChordVoiceOptions.durationSec` in `instruments/types.ts` (it currently states
piano/organ voices ignore the field).

## Edge cases

- **Multi-hit sustained patterns** (none exist today): each sustained hit rings
  hit-to-hit, with the final hit ringing to the bar end.
- **Release tail**: `releaseTailSec` still applies on top of the computed
  duration, giving a natural decay past the bar boundary — acceptable and
  desirable for a ballad.
- **Bar/cell slicing and turnaround logic**: unchanged. The duration is derived
  from the already-resolved per-bar `hits` array, so cell-sliced patterns get a
  correct per-bar sustain automatically.

## Testing

- `buildAllLayers` test: the `ballad-whole` chord strum event's `durationSec`
  equals the full bar (`beatsPerBar * secondsPerBeat`) at a given tempo, and
  scales when the tempo changes.
- `createReusableChordVoice` test: an explicit `options.durationSec` overrides
  the patch's `sustainedDurationSec`; absent an override, the patch default is
  used.
- Existing strum-voice tests remain green (no sustained hits route through the
  strum voice).

## Out of scope

- Tuning the ballad genre's tempo, voicing, bass, or drum patterns.
- Changing patch `sustainedDurationSec` defaults for non-ballad usage.
- Adding new sustained patterns.
