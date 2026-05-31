# Funk Comp v3 — Root Anchor, Pluck Timbre, Tighter Strum

**Date:** 2026-05-31
**Status:** Approved (design)
**Extends:** `2026-05-31-funk-chord-stabs-spice-design.md` (PR #489)

## Problem

After the stabs+spice pass (PR #489), the funk comp still has gaps on audition:

1. **The "one" is a strummed chord, not an anchor.** It should be **just the root
   note** (a single-note anchor, Jimmy-Nolen style), not a strummed voicing.
2. **Too many colored stabs.** There should be **one plain stab**, then **two
   syncopated upbeat stabs with color** — not three identical spicy stabs.
3. **The stab sounds like a piano, not a guitar.** The `Tone.Synth` (oscillator
   + ADSR, `sustain: 0.22`) reads sustained/keyboard-ish.
4. **The strum is too loose.** The 0.018s per-note stagger spreads the chord; a
   funk stab should be tight (near-simultaneous).

## Research grounding

Funk rhythm-guitar comping (Jimmy Nolen / James Brown chicken-scratch):

- 16th-note grid "1 e & a 2 e & a …"; strict alternating picking — **down** on
  the numbers and "&", **up** on "e" and "a".
- Idiomatic bar (Fundamental Changes lesson): root/anchor + ringing stab early,
  ringing 16th stabs mid-bar, **muted dead strokes** filling the rest. The muted
  ghost 16ths (quick release) are the *defining* chicken-scratch texture, not
  optional decoration.
- Harmony: dominant-9 voicings (often no 3rd); single-note anchors built from
  root / 3rd / b7 / octave.
- Syncopation comes from **offbeat upstroke** stabs.

Sources: Fundamental Changes "Play Funk Guitar – Lesson One"; Guitar World "11
ways to invigorate your funk rhythm chops"; Stringjoy "Funk Guitar"; Tone.js
`PluckSynth` docs.

## Decisions (from brainstorming)

- Rhythm researched, not guessed: root anchor on the one, one plain stab, two
  syncopated upstroke color-stabs later, muted ghost 16ths as connective texture.
- Timbre: switch the funk stab to a **Karplus-Strong `Tone.PluckSynth`** for
  genuine plucked-guitar realism (not just retuning the existing synth).

## Design

### 1. Articulation model (rhythm layer)

Expand `ChordArticulation` in `patterns.ts` from `"muted" | "stab"` to
**`"muted" | "root" | "stab" | "color-stab"`**:

| articulation  | what plays                    | ring          | voicing                |
|---------------|-------------------------------|---------------|------------------------|
| `root`        | single root note (not strummed) | short (~0.12s) | `[rootNote]`           |
| `stab`        | full chord, plain             | rings (~0.4s) | plain triad/7th        |
| `color-stab`  | full chord, spicy             | rings (~0.4s) | extended (9/13)        |
| `muted`       | choked chord scratch          | ~0.06s choke  | plain                  |

This splits the old single "stab" into **plain** (`stab`) vs **colored**
(`color-stab`), so only the two syncopated upbeats get extensions.

### 2. New `funk-scratch` rhythm

16th grid (down ↓ / up ↑):

| beat | 0 | 0.5 | 0.75 | 1.0 | 1.5 | 1.75 | 2.25 | 2.5 | 2.75 | 3.25 | 3.5 | 3.75 |
|------|---|-----|------|-----|-----|------|------|-----|------|------|-----|------|
| pos  | 1 | &1 | a1 | 2 | &2 | a2 | e3 | &3 | a3 | e4 | &4 | a4 |
| type | **ROOT ↓** | ghost ↓ | ghost ↑ | **STAB ↓** | ghost ↓ | ghost ↑ | ghost ↑ | **COLOR ↑** | ghost ↑ | ghost ↑ | **COLOR ↑** | ghost ↑ |
| vel  | .90 | .24 | .22 | .85 | .24 | .22 | .20 | .80 | .22 | .20 | .82 | .20 |

- Root on the one (single-note anchor, down).
- One plain stab on beat 2 (down).
- Two syncopated color upstrokes on the **& of 3** (2.5) and **& of 4** (3.5).
- Muted ghost 16ths weave between for the chicken-scratch texture.

### 3. Pluck timbre (Karplus-Strong)

Add an optional `pluck` spec to `StrumSpec`; make `oscillator`/`envelope`
optional (defaulted in `string.ts`):

```ts
export interface PluckSpec {
  attackNoise: number; // pick noise at attack (~0.1..20)
  dampening: number;   // comb lowpass freq, brightness (Hz)
  resonance: number;   // 0..1 sustain/ring
  release: number;     // resonance ramp-down (s)
}
export interface StrumSpec {
  oscillator?: { type: "custom"; partials: number[] };
  envelope?: EnvelopeSpec;
  pluck?: PluckSpec;
  noteDurationSec: number;
  releaseTailSec: number;
  strumLagSec?: number; // per-spec strum stagger override (§4)
}
```

**Velocity gotcha (verified against Tone 15.1.22 source):**
`Tone.PluckSynth.triggerAttack(note, time)` **ignores velocity** — it fires a
fixed-amplitude noise burst through a comb filter. Calling
`triggerAttackRelease(freq, dur, time, velocity)` silently drops the velocity, so
every hit would play at identical loudness — fatal for funk dynamics (ghost ≈
0.2 vs stab ≈ 0.85 vs root ≈ 0.9). The pluck voice must therefore scale velocity
itself via a per-voice **gain stage**: `PluckSynth → Tone.Gain → dest`, with the
gain set to the hit's velocity at trigger time.

`string.ts` voice factory: if `spec.pluck` present → build a small **pluck voice
wrapper** (a `Tone.PluckSynth` feeding a `Tone.Gain`) that implements the pool's
voice shape (`connect(dest)`, `dispose()`, `triggerAttackRelease(freq, dur, time,
velocity)`); the wrapper sets `gain.gain.setValueAtTime(velocity, time)` then
calls `synth.triggerAttackRelease(freq, dur, time)`. Else the existing
`Tone.Synth` with `spec.oscillator?.partials ?? DEFAULT_PARTIALS` and
`spec.envelope ?? defaults`. Either way `durationSec` is the note hold, so the
short muted hold still ramps the pluck resonance down (choke) while the longer
stab hold rings.

The pool is generalized over a common voice interface
(`StrumPlayableVoice = { connect; dispose; triggerAttackRelease }`) that both
`Tone.Synth` and the pluck wrapper satisfy.

Funk pluck tuning ≈ `{ attackNoise: 1.2, dampening: 4500, resonance: 0.55,
release: 0.12 }` — bright pick attack, moderate ring, no bloom; ghost choke
tightness is a by-ear tuning of `release`. The funk patch drops
`oscillator`/`envelope` and provides `pluck`. Rock/pop strum patches are
unchanged (no `pluck`).

### 4. Tighter strum spread

`STRUM_LAG_SECONDS = 0.018` in `strumVoice.ts` stays the default. Add
`StrumSpec.strumLagSec`; `createStrumVoice(spec)` uses
`spec?.strumLagSec ?? STRUM_LAG_SECONDS`. The funk patch sets `strumLagSec:
0.007` so the chord reads as a tight single stab. Other genres keep 0.018.

### 5. Data flow

`patterns.ts` (`hit.articulation`) → `buildAllLayers`:
- voicing: `root` → `[resolveChordVoicing(root, quality)[0]]` (single root note);
  `color-stab` → `extendFunkVoicing(plainVoicing,…)`; `stab`/`muted` → plain
  voicing (voice-led for non-stab).
- duration: `root` → `ROOT_STRUM_DURATION_SEC` (~0.12); `muted` →
  `MUTED_STRUM_DURATION_SEC` (0.06); `stab`/`color-stab` →
  `STAB_STRUM_DURATION_SEC` (0.4).

→ `createStrumVoice` (pluck synth + tight `strumLagSec`) → `pluckString`
(routes to `PluckSynth` when `spec.pluck`).

The register-safe spicy base (non-voice-led plain voicing) from PR #489 is
preserved for `color-stab`.

### 6. Testing / guards

- **Comp shape:** beat-0 is `root`; exactly one `stab`; exactly two `color-stab`,
  both on offbeats (& positions); the rest `muted`.
- **Voicing selection:** `root` hit emits a 1-note voicing (the chord root);
  `color-stab` emits the extended voicing; `stab` emits the plain voicing.
- **Duration mapping:** `root` < `stab` ring; `muted` choke unchanged; margin
  guards retained (`STAB > MUTED * 4`).
- **Pluck routing (root-cause guard):** a `StrumSpec` with `pluck` builds the
  pluck wrapper (Karplus-Strong `Tone.PluckSynth` + gain); a spec without `pluck`
  builds a `Tone.Synth`. The funk chord patch has a `pluck` spec.
- **Pluck velocity (root-cause guard):** the pluck wrapper sets its gain to the
  hit velocity at trigger time, so distinct velocities yield distinct gains
  (guards the "PluckSynth ignores velocity" trap — without the gain stage all
  hits would be equally loud).
- **Strum-lag override:** resolves to the funk value when set; default unchanged
  otherwise.

## Out of scope

- Bass / drum changes (tune by ear only).
- Non-funk genres' strum timbre or lag.
- Making `StrumSpec` a fully discriminated union (optional `pluck` is the YAGNI
  choice; revisit only if a second pluck patch appears).
