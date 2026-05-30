# Pattern Catalog — Targeted Idiomatic Pass (Slice 1)

**Status:** Design — approved in brainstorming, ready for implementation plan.
**Date:** 2026-05-29
**Supersedes (in part):** `2026-05-29-pattern-catalog-audit.md` (the audit criteria this slice acts on).
**Companion:** `2026-05-29-phrase-aware-multibar-variation-design.md` (Slice 2 — the deferred engine work).

---

## 1. Goal

Make four specifically-weak backing-track patterns musically authentic, add the
one data-structure capability they need (bass articulation), and re-tune the
genre wiring, mix levels, and sound patches those patterns touch. No new UI —
every chord/bass/drum pattern is already exposed in `BackingTrackControls.tsx`.

This is a **targeted pass**, not a full catalog rewrite. The larger engine work
from the DRAFT spec (phrase-aware chord delays, multi-bar variation/turnarounds,
bossa overhaul) is deliberately deferred to Slice 2.

## 2. Scope

**In scope**

1. New `articulation` field on bass hits, threaded end-to-end so bass notes can
   be staccato/legato (the engine already supports per-note `durationSec`; the
   pattern data and event types just don't carry it yet).
2. New `flat-seventh` bass note role (for idiomatic funk).
3. Overhaul of four patterns: bass `funk-syncopated`, bass `pedal`, drums
   `jazz-ride`, chord `jazz-comp`.
4. Genre wiring review (`genres.ts`) — including wiring `pedal` into rock.
5. Mix-level review (`genreMixPresets.ts`) — jazz and funk.
6. Sound-patch review (`instrumentPatches.ts`) — bass envelopes for staccato,
   jazz ride/hat voices.

**Out of scope (Slice 2)**

- Phrase-aware chord delays.
- Multi-bar (2/4-bar) variation, turnarounds, end-of-phrase bass walks.
- Bossa-nova drum overhaul (clave / cross-stick).
- New drum-variation UI (variations stay engine-internal).

## 3. Current State (verified)

- Patterns live in `src/progressions/audio/patterns.ts`.
- `CatalogBassHit` = `{ beat, velocity, note }` — **no articulation/duration.**
- `ChordHit` already has `style?: "staccato" | "sustained"` — threaded through
  `ChordStrumEvent.style` in `buildAllLayers.ts` and honored at playback.
- `scheduleBassNote` (`bass.ts:51`) already accepts `options.durationSec`
  (clamped 0.05–2.0s), but `BassEvent` (`buildAllLayers.ts:38`) carries only
  `{ note, velocity }`, and playback (`useProgressionAudioPlayback.ts:406`)
  passes only `velocity`. So duration is currently always the patch default.
- `resolveBassNoteForRole` (`progressionAudio.ts:78`) handles roles
  `root | third | fifth | octave | chromatic-approach`.
- `BassNoteRole` is declared in `patterns.ts:21`.
- All 7 chord / 6 bass / 7 drum patterns are exposed in the UI.

## 4. Design

### 4.1 Bass articulation (data-structure change)

Add an optional enum to bass hits and thread it to the existing `durationSec`:

```ts
// patterns.ts
export type BassArticulation = "staccato" | "legato" | "normal";

interface CatalogBassHit {
  beat: number;
  velocity: number;
  note: BassNoteRole;
  articulation?: BassArticulation; // default: undefined === "normal"
}
```

**Engine mapping** (`buildAllLayers.ts`, bass loop): translate articulation to a
beat-fraction duration and put it on the event.

```ts
function articulationToDurationSec(
  articulation: BassArticulation | undefined,
  secondsPerBeat: number,
): number | undefined {
  switch (articulation) {
    case "staccato": return 0.3 * secondsPerBeat; // short, punchy
    case "legato":   return 0.9 * secondsPerBeat; // near-connected, slight gap
    default:         return undefined;            // patch default (unchanged)
  }
}
```

```ts
// BassEvent gains an optional duration
export interface BassEvent {
  note: string;
  velocity: number;
  durationSec?: number;
}
```

Playback passes it straight through:

```ts
// useProgressionAudioPlayback.ts (bass part callback)
eng.scheduleBassNote(audio.layers.bass, freq, audioTime, {
  velocity: value.velocity,
  durationSec: value.durationSec, // NEW
  patch: bassPatch,
});
```

Patterns that omit `articulation` produce `durationSec: undefined` → identical
behavior to today. **Zero behavioral change for unmodified patterns.**

### 4.2 New `flat-seventh` bass role

Extend `BassNoteRole` and `resolveBassNoteForRole`:

```ts
// patterns.ts
export type BassNoteRole =
  | "root" | "third" | "fifth" | "octave"
  | "chromatic-approach" | "flat-seventh";
```

```ts
// progressionAudio.ts — new case in the switch
case "flat-seventh": {
  // Prefer a b7/7 chord member; otherwise a dominant b7 = root + 10 semitones.
  const seventh = definition?.members.find((m) => m.name === "b7" || m.name === "7");
  targetNoteName = toNoteName(rootAbsolute + (seventh ? seventh.semitone : 10));
  break;
}
```

### 4.3 Pattern overhauls

**Bass `funk-syncopated`** — root-anchored, octave pop, b7 color, ghost notes,
all staccato; locks with the funk kick (0, 0.5, 2.5):

| beat | note | vel | art |
|------|------|-----|-----|
| 0    | root          | 1.00 | staccato |
| 0.75 | root          | 0.45 | staccato | (ghost 16th)
| 1.5  | octave        | 0.80 | staccato | (octave pop, & of 2)
| 2    | fifth         | 0.60 | staccato |
| 2.75 | flat-seventh  | 0.50 | staccato | (b7 color)
| 3.5  | root          | 0.75 | staccato | (push, & of 4)

**Bass `pedal`** — driving staccato 8th pulse on root, musical accent contour
(replaces today's flat 1/0.8/0.6 alternation):

| beat | note | vel | art |
|------|------|-----|-----|
| 0   | root | 1.00 | staccato |
| 0.5 | root | 0.55 | staccato |
| 1   | root | 0.75 | staccato |
| 1.5 | root | 0.55 | staccato |
| 2   | root | 0.85 | staccato |
| 2.5 | root | 0.55 | staccato |
| 3   | root | 0.75 | staccato |
| 3.5 | root | 0.60 | staccato |

**Bass `walking`** — set `articulation: "legato"` on all four hits so the line
connects (currently rings on patch default). Note selection unchanged.

**Drums `jazz-ride`** — authentic spang-a-lang. The ride **rhythm is already
correct** (0, 1, 1.5, 2, 3, 3.5 = "1, 2, &, 3, 4, &" with swing pushing the
&s); the fix is dynamics + comping:

```
ride:   0 → 0.55 | 1 → 0.70 | 1.5 → 0.40 | 2 → 0.55 | 3 → 0.70 | 3.5 → 0.40
                   (accent musical beats 2 & 4; skip-notes softest)
kicks:  0 → 0.18 | 1 → 0.15 | 2 → 0.18 | 3 → 0.15   (feathered 4-on-the-floor)
hats:   1 → 0.50 | 3 → 0.50                          (foot-chick on 2 & 4)
snares: 2.5 → 0.20                                   (single soft ghost comp)
```

**Chord `jazz-comp`** — Charleston + anticipation push, sparse staccato stabs
(leaves space for bass/drums):

| beat | vel | style |
|------|-----|-------|
| 0   | 0.75 | staccato | (downbeat stab)
| 1.5 | 0.60 | staccato | (& of 2 — Charleston, swung)
| 3.5 | 0.70 | staccato | (& of 4 — anticipates next bar, swung)

### 4.4 Genre wiring (`genres.ts`)

- **rock:** change `bassPattern: "root-fifth"` → `"pedal"` (driving 8ths suit
  rock; `pedal` was previously orphaned — no genre referenced it).
- **jazz / funk:** already wired to the overhauled patterns — verify only.
- All other genres unchanged.

### 4.5 Mix levels (`genreMixPresets.ts`)

- **jazz:** the new ride is more present; rebalance so it sits without dominating.
  Lower the ride's contribution via the drum bus or lift chord/bass to match —
  target: ride audible as time-keeper, not front-of-mix. (Concrete dB deltas to
  be set during implementation against the rebuilt pattern.)
- **funk:** push bass slightly forward (it's the groove engine) and keep reverb
  tight (already `decay 0.9 / wet 0.06`). Verify bass `volumeDb` headroom.

### 4.6 Sound patches (`instrumentPatches.ts`)

- **bass envelopes (`bass-finger`, `bass-pick`):** with staccato now driving a
  short `durationSec`, confirm the amp envelope release (0.2s) reads punchy, not
  clicky, at funk/rock tempos. Adjust release only if an audible click appears.
- **`kit-jazz-brush`:** the kit has no `hihat` voice, so the foot-chick hats fall
  back to defaults. Add a soft closed-hihat voice and confirm the `ride` voice
  (`decay 1.2`) is not washing out under the new accent pattern.

## 5. Testing Strategy

- **Pure unit tests** (Vitest) for the data layer:
  - `articulationToDurationSec` mapping (staccato/legato/normal).
  - `resolveBassNoteForRole` returns the correct b7 for `flat-seventh` across a
    major triad (→ root+10) and a dominant-7 chord (→ chord member).
  - `buildAllLayersAsync` emits `BassEvent.durationSec` for staccato hits and
    `undefined` for normal hits.
- **Pattern shape tests:** each overhauled pattern has the expected hit count,
  beats, and velocity ordering (e.g. jazz-ride accents beats 1 & 3 louder than
  skip-notes 1.5 & 3.5).
- **No snapshot/audio assertions** — timbre is verified by ear during review.
  Document a manual audition checklist (play each affected genre, confirm groove).

## 6. Risks & Mitigations

- **Bass `durationSec` clamp** (0.05–2.0s): at very slow tempos legato `0.9 ×
  beat` could exceed... no — 0.9 beat at 60bpm = 0.9s, within range. At fast
  tempos staccato `0.3 × beat` at 200bpm = 0.09s, above the 0.05 floor. Safe.
- **Rock default change** (root-fifth → pedal) alters an existing preset's feel.
  Easily reverted; called out for reviewer ear-check.
- **Feathered jazz kick** can muddy at low quality tiers — velocities kept ≤0.18.
```
