# Lens Consolidation — Design

**Status:** Approved. Implementation is the **unblocker** for the Chord Voicings Card UX spec (group A); should land before A.

**Goal:** Delete the practice-lens picker control and collapse the two-lens model down to always-Lead. Reclaim the row space, simplify state, and stop asking the user to pick between two modes that behave almost identically.

**In scope:** item 6 from the 2026-05-27 grab-bag brainstorm.

**Out of scope:** the "too subtle highlight" fix flagged with item 6 — that's a requirement carried into the Theming spec (items 3 + 8). This spec is purely about removing the control and the lens-switching logic.

---

## Context

### Current model

`packages/core/src/theory.ts` exports `LENS_REGISTRY` with two entries:

- **`tones`** — fretboard: guide-tone (3rd/7th) glow + scale-only dim. Practice cues: `Land on` + `Guide tones`.
- **`lead`** — fretboard: progression-aware emphasis stack (anticipation → hold → departing → tones-base fallback). Practice cues: `Land on` + `Tension`.

`src/components/FretboardSVG/utils/semantics.ts#getLensEmphasis` branches on the active lens. Crucially, the Lead branch already falls back to `applyTonesBase` when (a) no progression context is supplied or (b) the per-emphasis priority order doesn't match — so Lead is structurally a superset of Tones.

Visible surfaces today:

- `ChordOverlayControls.tsx` row 1: `Voicing (span 3) | Lens (span 5) | String set (span 2)`.
- `StatusBar.tsx` shows the active lens label.
- `HelpModal` lists both lens names (test guards `LENS_REGISTRY` label parity).
- `chordOverlayAtoms.ts` exports `practiceLensAtom` (`atomWithStorage<PracticeLens>` keyed `"fretflow:practiceLens"`), plus `practiceLensStorage` migration glue that reads the legacy `viewMode` key.

### Why this matters

- The control adds cognitive load for a distinction users don't perceive ("very little difference between tones and lead").
- The picker occupies span 5 in the chord-voicings card, blocking a clean single-row layout for group A's string-set toggle bar.
- The two-cue practice bar split (Guide tones vs. Tension) hides chord-tension information from Tones-lens users and hides guide-tone emphasis from Lead-lens users.

---

## Design

### B1 — Remove the lens picker UI

- Delete the `Lens` `Prop` cell and `lensOptions`/`lensAvailability` glue from `src/components/ChordOverlayControls/ChordOverlayControls.tsx`.
- Delete the `lensHelp` paragraph that explains the two lenses.
- Delete the auto-exit `useEffect` that snaps unavailable lenses to `"tones"`.
- The row 1 result (interim, before group A lands) is `Voicing (span 3) | String set (span 2)`. After group A lands, String set grows to `span 9`.
- Delete the lens label readout in `src/components/StatusBar/StatusBar.tsx` (the `LENS_SHORT_LABELS`/`LENS_REGISTRY.find` block). Status bar emits one fewer chip.

### B2 — Collapse the lens model to always-Lead

- Delete `practiceLensAtom`, `practiceLensStorage`, and `PRACTICE_LENS_VALUES` from `src/store/chordOverlayAtoms.ts`.
- Delete `lensAvailabilityContextAtom`, `lensAvailabilityAtom`, `guideTonesCuesAtom`, and the `switch (practiceLens)` body in `practiceCuesAtom` (in `src/store/practiceLensAtoms.ts`). `practiceCuesAtom` becomes an alias for the (renamed-for-clarity) `tensionCuesAtom`:
  ```ts
  export const practiceCuesAtom = atom((get) => {
    const base = get(cueBaseInputsAtom);
    if (!base) return [] as PracticeCue[];
    // ... same body as today's tensionCuesAtom ...
  });
  ```
  Inline `tensionCuesAtom`'s body into `practiceCuesAtom` and delete the now-empty `tensionCuesAtom` export. `guideTonesCuesAtom` and the `GUIDE_TONE_FORMATTED` set used only by it are deleted (note: `GUIDE_TONE_RAW` is still referenced by `noteSemanticMapAtom` and stays).
- Delete the `PracticeLens` union type from `packages/core/src/theory.ts` (or shrink to a single-value type as a transitional courtesy — but the type has only two consumers besides the registry, so a clean delete is preferred). Also delete `LENS_REGISTRY`, `LensRegistryEntry`, and `LensAvailabilityContext`. Re-export removals propagate through `packages/core/src/index.ts`.

### B3 — Simplify `getLensEmphasis` to always-Lead

- In `src/components/FretboardSVG/utils/semantics.ts`, drop the `practiceLens` parameter and the `switch (practiceLens)` wrapper. Rename `getLensEmphasis` → `getEmphasis` (smaller surface, no lens concept).
- The function body becomes the current Lead branch verbatim: anticipation → hold → departing → `applyTonesBase` fallback. `applyTonesBase` stays as the no-leadContext / no-priority-match fallback.
- Update all call sites to drop the `practiceLens` argument:
  - `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts`
  - `src/hooks/useFretboardTopologyModel.ts` — drop the `useAtomValue(practiceLensAtom)` subscription
  - Any other call site found by grep

### B4 — Storage cleanup (folded into existing v2 migration)

The v2 redesign migration is already shipping in this PR via `src/store/v2RedesignMigration.ts`. Extend its `KEYS_TO_RETIRE` list with the lens key:

```ts
const KEYS_TO_RETIRE = [
  // ... existing entries ...
  k("practiceLens"),
];
```

Update `v2RedesignMigration.ts` JSDoc retired-keys list accordingly. No new storage version bump needed — this rides the v2 one.

### B5 — Help / docs

- Remove the lens entries from any help-modal copy (find via the `HelpModal.test.tsx` registry-parity test — that test gets deleted or rewritten to assert lens-related content is *absent*).
- `CLAUDE.md`'s "Lens & Note Roles" section currently names the lenses; tighten the wording to describe the single emphasis model. (Minor doc update, not a placeholder.)

---

## Practice bar behavior

Cues remain "Land on" + "Tension" (current Lead behavior, per your call). No additional cue kinds added. The `GUIDE_TONE_FORMATTED` set and `guide-tones` cue kind are deleted; `PracticeCueKind` shrinks accordingly:

```ts
// before
export type PracticeCueKind = "land-on" | "guide-tones" | "color-note" | "tension";
// after
export type PracticeCueKind = "land-on" | "color-note" | "tension";
```

`"color-note"` stays — it's referenced elsewhere as a potential future cue kind even though no atom emits it today (already true in current code). If a sweep confirms zero call sites, also drop it — that's a small follow-up, not a blocker.

---

## Carry-over to the Theming spec (items 3 + 8)

This spec leaves the "too subtle highlight" problem unsolved on purpose. The theming spec MUST address:

1. The Lead lens's anticipation glow currently uses `glowColor: "orange"`, which collides with chord-tone-ring + non-CAGED-connector orange (the item-2 conflict). After the CAGED-E recolor (item 2) ships, the chord-tone-ring orange remains. Anticipation needs a different signal color.
2. The Lead lens's hold glow (`cyan`) and the guide-tone fallback glow (`cyan`) overlap. With the consolidated emphasis stack, hold is the dominant case — cyan should be visually unambiguous.
3. The radius/opacity values (`1.15×`, `1.2×`, `0.85×`, `0.6× opacity`) are tuned for the legacy two-lens system. They may need re-tuning for the new always-on stack.

These are listed in the theming spec's "Inputs from other specs" section when that spec is written.

---

## Tests

### Atom contracts

- **`practiceCuesAtom`:** no active chord → `[]`. Active chord with all-in-scale members → `[Land on]` only. Active chord with outside members → `[Land on, Tension]`. The `kind: "guide-tones"` branch is gone — regression-guard test asserts no cue has `kind: "guide-tones"`.
- **`noteSemanticMapAtom`:** unchanged. `isGuideTone` semantic still computed (used by the now-always-on Tones-base fallback in `getEmphasis`).
- **Storage:** after v2 migration runs, `localStorage.getItem("fretflow:practiceLens")` is `null`.

### Component contracts

- **`ChordOverlayControls`:** snapshot has no Lens `Prop`, no lens help paragraph. Row 1 has `Voicing` and (when voicing === close) `String set`, nothing else.
- **`StatusBar`:** snapshot has no lens label chip.
- **`HelpModal`:** registry-parity test deleted; new test asserts the modal has no mention of "Tones" or "Lead" as lens names.

### Fretboard rendering

- **`getEmphasis` (renamed from `getLensEmphasis`):** smoke tests covering anticipation, hold, departing, and tones-base fallback paths — same coverage as today's Lead-branch tests, with the lens-switch wrapper removed. Tones-branch-only tests deleted.

### Visual / e2e

- Visual snapshot refresh for `e2e/app-overlays` (chord-voicings card row 1 shrinks), `e2e/app-components/StatusBar` (lens chip absent).
- E2e smoke: load a progression in 4/4 at 120 BPM, press Play. On the last beat of each step, anticipation glow appears on next chord's guide tones. (Same scaffolding as existing lead-lens e2e.)

---

## Files to touch

**Modify:**
- `packages/core/src/theory.ts` — delete `LENS_REGISTRY`, `LensRegistryEntry`, `LensAvailabilityContext`, `PracticeLens` (and drop `"guide-tones"` from `PracticeCueKind`).
- `packages/core/src/index.ts` — remove deleted exports.
- `src/store/chordOverlayAtoms.ts` — delete `practiceLensAtom`, `practiceLensStorage`, `PRACTICE_LENS_VALUES`, the imports they need.
- `src/store/practiceLensAtoms.ts` — delete `lensAvailabilityContextAtom`, `lensAvailabilityAtom`, `guideTonesCuesAtom`, `GUIDE_TONE_FORMATTED`, the switch in `practiceCuesAtom`; inline tension-cues body into `practiceCuesAtom`; delete the now-dead `tensionCuesAtom` export.
- `src/store/actions.ts` — drop `set(practiceLensAtom, RESET)` from the reset action.
- `src/store/v2RedesignMigration.ts` — append `k("practiceLens")` to `KEYS_TO_RETIRE`; update JSDoc.
- `src/store/v2RedesignMigration.test.ts` — assert `localStorage.getItem(k("practiceLens"))` is null after migration.
- `src/components/ChordOverlayControls/ChordOverlayControls.tsx` — delete Lens `Prop`, `lensOptions`/`lensAvailability` glue, help paragraph, auto-exit effect, `LENS_SHORT_LABELS`.
- `src/components/ChordOverlayControls/ChordOverlayControls.test.tsx` — drop lens cases.
- `src/components/StatusBar/StatusBar.tsx` — delete lens label readout + `LENS_SHORT_LABELS`.
- `src/components/StatusBar/StatusBar.test.tsx` — drop lens cases.
- `src/components/HelpModal/HelpModal.test.tsx` — replace registry-parity test with absence-of-lens-names assertion.
- `src/components/FretboardSVG/utils/semantics.ts` — drop `practiceLens` parameter; rename `getLensEmphasis` → `getEmphasis`; collapse switch.
- `src/components/FretboardSVG/utils/semantics.test.ts` (if present) — drop Tones-only cases.
- `src/components/FretboardSVG/hooks/useAnimatedFretboardView.ts` — drop `practiceLens` argument.
- `src/hooks/useFretboardTopologyModel.ts` — drop `practiceLensAtom` subscription + downstream argument.
- `CLAUDE.md` — tighten the "Lens & Note Roles" section to describe the single emphasis model.

**Delete:**
- `src/store/practiceLens.test.ts` — most cases reference the dropped registry/lens model. If any non-lens cases live in this file, migrate them to `practiceLensAtoms.test.ts` (or a similarly-named successor) before deletion.

**Visual baselines:** refresh `e2e/app-overlays`, `e2e/app-components/StatusBar` after implementation.

---

## Sequencing

This spec ships **before** the Chord Voicings Card UX spec (group A) so A's `span={9}` toggle bar drops into the row space freed by the lens removal without an interim layout reflow.

The Theming spec (items 3 + 8) consumes this spec's "carry-over" requirements (anticipation glow color, hold/guide-tone color disambiguation, radius/opacity re-tune).
