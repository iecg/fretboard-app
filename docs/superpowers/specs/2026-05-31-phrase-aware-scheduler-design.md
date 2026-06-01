# Phrase-Aware Scheduler: Absolute-Bar Index + Drum Variation Gating

**Status:** Design — approved in brainstorming 2026-05-31.
**Date:** 2026-05-31
**Branch:** `slice2-phrase-aware-scheduler` (off `main`).
**Parent slice:** `2026-05-29-phrase-aware-multibar-variation-design.md` (Slice 2). This
spec implements **§3.1 (absolute-bar index portion)** and **§3.2 (drum variation
gating mechanism)** of that slice. The remaining Slice 2 objectives — the
`phraseLengthBars` input param, phrase-aware chord rhythm (§3.3), end-of-phrase
bass walk (§3.4), and the bossa overhaul (§3.5) — are explicitly **deferred** to
later specs.

---

## 1. Goal

Give `buildAllLayersAsync` a notion of *where in the progression a bar sits* (a
monotonic absolute bar index, never reset per step), and use it to gate drum
variations to specific bars via an interval+phase rule — **without changing any
existing genre's audible output**.

## 2. Why this scope (and what is deferred)

The parent Slice 2 spec bundles five subsystems. This spec carves out the
**minimal foundation that delivers a testable mechanism on its own**:

- **In scope:** the absolute-bar index, plus wiring the *already-existing but
  dead* `DrumVariation.barInterval` field into real per-bar gating.
- **Deferred — `phraseLengthBars` input param:** with the per-variation
  interval+phase model below, drum variations key off each variation's *own*
  `barInterval`, so a global `phraseLengthBars` is not needed here. It is only
  consumed by §3.3/§3.4 and will be introduced alongside its first real consumer
  (YAGNI — no dead plumbing this slice).
- **Deferred — genre-appropriate default variation sets:** assigning turnaround
  fills/accents to genres changes audible output and needs an ear audition. This
  slice ships the *mechanism* only; genre defaults are a fast follow-up once the
  mechanism is proven.

## 3. Current state (the bug this fixes)

`DrumVariation` already declares a `barInterval` field, but it is **dead code**.
In `buildAllLayersAsync`, assigned variations are flattened into a single
`variationHits` array (`buildAllLayers.ts:144-150`) and merged into the base
`drumHits` applied to **every bar of every step**. `barInterval` is never read,
and there is no absolute bar index — the per-step `bar` loop variable resets to 0
at each step. So today a "fill-every-4" variation, if assigned, would fire on
*every single bar*.

The only variation any genre currently uses is `open-hat-and-of-4` (`barInterval:
1`), assigned to pop/rock/funk. `fill-every-4` and `crash-bar-1` are defined but
unwired to any genre.

## 4. Design

### 4.1 Firing model — interval + phase

A drum variation fires on absolute bar *N* when:

```
N % barInterval === (barPhase ?? 0)
```

`barPhase` is a new **optional** field on `DrumVariation` (default 0), naming
which bar of the `barInterval` cycle the variation fires on. This model is fully
general: every existing case and the spec's canonical examples are expressible.

Rejected alternative: a single global `phraseLengthBars` clock that all
variations key off. It forces every variation onto one cycle and reintroduces the
param we deferred. Per-variation interval keeps each variation self-describing.

### 4.2 Absolute bar index

Introduce `let absoluteBar = 0;` before the step loop in `buildAllLayersAsync`.
It increments once per bar-iteration across the **whole progression**, never
reset per step.

- **Sub-bar steps** (duration measured in beats, not bars) count as **one** bar
  position — consistent with the existing loop, which treats them as
  `barsInStep === 1`.
- **Unavailable / null-root steps** (which `continue` before emitting events)
  **still advance** `absoluteBar` by their `barsInStep`, so a rest bar holds its
  phrase slot and does not slide later turnarounds earlier. This requires
  computing `barsInStep` *before* the early `continue`.

`absoluteBar` feeds **only** the gating decision — never the jitter seeds — so
base-pattern output is bit-for-bit unchanged.

### 4.3 Type + helper changes (`patterns.ts`)

Add the optional field:

```ts
export interface DrumVariation {
  id: string;
  label: string;
  barInterval: number;
  barPhase?: number; // which bar of the interval cycle it fires on; default 0
  pattern: CatalogDrumPattern;
}
```

Add a pure, total helper (guards non-positive intervals against divide-by-zero /
nonsense rather than throwing):

```ts
export function variationFiresOnBar(
  variation: DrumVariation,
  absoluteBar: number,
): boolean {
  if (variation.barInterval <= 0) return false;
  return absoluteBar % variation.barInterval === (variation.barPhase ?? 0);
}
```

Correct the two **unused** variation definitions so their labels become truthful
and provide real test fixtures (neither is wired to a genre → zero audible
change):

- `fill-every-4`: `barInterval: 4` → add `barPhase: 3` (fires on the **4th** bar
  — the turnaround, matching the parent spec's `bar % 4 === 3` example).
- `crash-bar-1`: `barInterval: 1` → `barInterval: 4, barPhase: 0` (fires on the
  **1st** bar of each 4-bar group — what "Crash on Bar 1" promises).
- `open-hat-and-of-4`: **unchanged** (`barInterval: 1`, phase 0 → every bar).
  This is the only variation any genre uses; leaving it preserves byte-identical
  output.

### 4.4 Scheduler restructure (`buildAllLayers.ts`)

- Resolve assigned variations to `DrumVariation` objects **once** before the loop
  (`input.drumVariations.map(getDrumVariation).filter(Boolean)`), instead of
  pre-flattening their hits.
- Keep the base `drumPattern` hit collection and **all jitter seeds exactly as
  they are** (still keyed on the per-step `bar`).
- Inside the per-bar loop, build the bar's drum hits as: **base pattern hits +
  the hits of each resolved variation where `variationFiresOnBar(v, absoluteBar)`
  is true**.
- Increment `absoluteBar` at the end of each bar-iteration; also advance it by
  `barsInStep` for skipped (`unavailable`/null) steps.

### 4.5 Data flow

```
genre → drumVariations (ids)
      → resolve to DrumVariation[]   (once, before loop)
      → per bar: variationFiresOnBar(v, absoluteBar)?  → include v's hits
      → merge with base pattern hits → applyJitter (unchanged seeds) → DrumEvent[]
```

## 5. Backwards-compat & determinism

- `open-hat-and-of-4` (interval 1, phase 0) fires every bar → **identical**.
- No genre uses `fill-every-4`/`crash-bar-1` → correcting their defs changes no
  audible output.
- `absoluteBar` only feeds gating, not seeds → base output unchanged.
- A genre with empty `drumVariations` is byte-identical to today.
- Pure function of step order + bar counts; jitter is seeded (no
  `Date.now`/`Math.random`) → same input → identical event stream across runs.

## 6. Testing strategy

1. **`variationFiresOnBar` truth table** — (1,0)→every bar; (4,3)→bars 3,7,11;
   (4,0)→bars 0,4,8; `barInterval` 0 or negative → never fires.
2. **Absolute-bar index across multi-step mixed-duration progression** — e.g.
   `[2-bar C, 2-bar F]` with `fill-every-4` (4,3): assert the fill lands on the
   4th *overall* bar (the 2nd bar of F, where per-step `bar` = 1), proving the
   gate keys off absolute, not per-step, position.
3. **Backwards-compat regression** — a genre using `open-hat-and-of-4` (pop)
   produces a drum stream identical to a captured pre-change baseline.
4. **No-op** — a genre with empty `drumVariations` is byte-identical to today.
5. **Determinism** — same input built twice → identical event streams.

This satisfies the parent spec's §6 testing requirements (absolute-bar
computation, modulo selection, no-phrase-data identity, determinism).

## 7. Out of scope

- `phraseLengthBars` input param (deferred to §3.3/§3.4 slice).
- Genre default variation sets (fast follow-up, needs audition).
- Phrase-aware chord rhythm (§3.3), end-of-phrase bass walk (§3.4), bossa
  overhaul (§3.5).
