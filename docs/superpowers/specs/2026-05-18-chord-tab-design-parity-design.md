# Chord Tab — Design Parity — Design

**Status:** Brainstorm spec. Produced 2026-05-18 from two updated `FretFlow DAW` Chord-tab
design screenshots (Degree-mode and Manual-mode states) plus a side-by-side diff against the
shipped Chord tab.

**Date:** 2026-05-18

**Scope:** Bring the **Chord** inspector tab up to the updated design — layout, relabelling,
control restyling, the StringSetPicker fix — and make the voicing engine actually drive the
fretboard. One tab; the View / Scale / Progression tabs are separate future passes.

---

## 1. Background

The DAW shell and the voicing engine shipped (PR #413). A side-by-side review of the
shipped Chord tab against an updated design surfaced twelve differences. This spec resolves
the Chord-tab subset; three app-shell items are deferred (§7).

The authoritative design is two screenshots:

- **Degree mode:** `SOURCE` row = `MODE` (Off/Degree/Manual) · `DEGREE` (i/III/iv/v/VII) ·
  `LENS` (Chord/Guide/Tension); `CHORD TYPE` group with a `QUALITY` 15-cell single-row
  grid; `VOICING` group with a `CONNECTORS` toggle inline in the header, and Type /
  Inversion / String Set, each with a hint.
- **Manual mode:** identical except the `DEGREE` slot is replaced by a `ROOT` 12-note
  picker row.

### Current shipped state

- `ChordOverlayControls` (`src/components/ChordOverlayControls/`) renders a 6-column
  `PropGrid`: SOURCE (Mode span 3, Degree span 3, Root span 4, Lens span 4 — wrapping onto
  several rows), CHORD TYPE (the `ChordTypeGrid`, span 6), VOICING (Type span 3, Inversion
  span 3, String Set span 6, Full Chords `Switch` span 3, Show-on-Board `Switch` span 3).
- The Lens control hides the Tension option when unavailable (`hideWhenUnavailable`).
- `voicingMatchesAtom` (`src/store/chordOverlayAtoms.ts`) is gated
  `if (!get(fullChordsEnabledAtom)) return []` — the **voicing engine only runs when the
  Full Chords switch is on, and that switch defaults off**. This is why Type / Inversion /
  String Set appear inert (diff item 12).
- `fullChordsEnabledAtom` is also read by the View tab's "Full Chords" `ToggleProp`.
- `StringSetPicker` (`src/components/Inspector/StringSetPicker.tsx`) renders on-strings in
  `--text-muted` (cyan only on the active card), orders strings thick-at-top, and uses a
  non-linear height ramp (`2.2 - (i / 5) * 1.4`).
- `.toggle-btn` / `.toggle-group` (`src/components/shared/shared.module.css`) — the shipped
  pills are taller, wider, and more rounded than the design's.
- `FretboardSVG` renders chord connector polylines (`useChordConnectorPolylines` →
  `connectorPolylines`) with no user-facing visibility control.

### Decisions taken during the brainstorm

- **Mode keeps all three options** (Off / Degree / Manual); "Off" is **not** moved into the
  Degree toggle.
- **Full Chords switch removed** — the voicing Type control's "Full CAGED" option subsumes
  it. The voicing engine ungates (§5d).
- **Show-on-Board switch removed and repurposed** — the switch slot inline with the VOICING
  header becomes a **Connectors** toggle controlling voicing connector-line visibility.
- **Lens shows all three options always** (Chord / Guide / Tension); an unavailable lens is
  disabled, not hidden.
- App-shell items (inspector full-width, fretboard in a card, status bar full-width) are
  **deferred** to the always-on DAW spec (§7).

---

## 2. Goals and Non-Goals

### Goals

- The Chord tab matches the updated design: layout, labels, control proportions, hints.
- The voicing engine (Type / Inversion / String Set) visibly drives the fretboard.
- `StringSetPicker` matches the design (cyan, string order, linear ramp).
- A working Connectors toggle.

### Non-Goals

- No changes to the View / Scale / Progression tabs (separate passes) — except the noted
  no-op consequence on the View-tab Full Chords toggle (§5d, §8).
- No music-theory or voicing-engine algorithm changes — only its activation gate.
- No app-shell layout changes (§7, deferred).

---

## 3. Layout — Source group (diff items 7, 8)

`ChordOverlayControls`' SOURCE group becomes a single grid row on the desktop/tablet tiers:

- **`MODE`** — label changes from "Chord Mode" to **"Mode"** (`controls.chordMode` → a new
  `controls.mode` string, or retarget the existing label). `ToggleBar`, 3 options
  Off / Degree / Manual, **span 2**. Atom wiring (`chordOverlayModeAtom`) unchanged.
- **`DEGREE`** (Degree mode) — `ToggleBar` i/III/iv/v/VII, **span 3**. **`ROOT`** (Manual
  mode) — the `NoteGrid` 12-note picker, **span 3** (it is a single 12-column row since the
  root-grid pass). Exactly one of the two occupies the slot per `chordOverlayMode`.
- **`LENS`** — `ToggleBar`, **span 1**, 3 options. See §3a.
- **Mode hint** — a single static string **"Off · Diatonic degree · Free root."**
  (replacing the current per-mode `degreeModeHint` / `manualModeHint`). One `Prop` `hint`.

The three cells total span 6 in Degree mode (2 + 3 + 1) and 6 in Manual mode (2 + 3 + 1).
On the mobile tier the `PropGrid` already collapses to 2 columns; cells wrap as today.

### 3a. Lens — three options, always shown

The Lens `ToggleBar` shows all three lenses — **Chord** (`targets`), **Guide**
(`guide-tones`), **Tension** (`tension`) — at all times. An unavailable lens renders
`disabled` (the `ToggleBar` per-option `disabled` flag — already supported), never hidden.
The `hideWhenUnavailable` branch in `ChordOverlayControls`' `lensOptions` builder is
removed. Option labels are the compact forms **"Chord" / "Guide" / "Tension"** (overridden
in the control, or the `LENS_REGISTRY` short labels — a plan decision). Lens hint:
**"Landing tones · Tension shows chord notes outside the scale."** The auto-exit
`useEffect` for unavailable lenses is kept.

---

## 4. Layout — Chord Type group (diff items 7, 9)

- The `CHORD TYPE` group's inner cell sub-label changes from "Chord Type" to **"Quality"**
  (`controls.chordType` label → a `controls.quality` string). The group header
  (`inspector.groupChordType`, "Chord Type") is unchanged.
- The `ChordTypeGrid` renders all **15 quality cells in a single row**
  (`grid-template-columns: repeat(15, minmax(0, 1fr))`), with tighter cell height and
  horizontal padding to fit. `ChordTypeGrid.module.css` is the only file changed for this.
- The group hint is kept: "Switching degree picks the diatonic default automatically."

---

## 5. Voicing group (diff items 6, 10, 2, 12)

### 5a. Remove the Full Chords switch

The Full Chords `Switch` `Prop` is deleted from `ChordOverlayControls`' VOICING group.

### 5b. Connectors toggle

The VOICING `GroupHeader` gains a right-slot control (the `GroupHeader` `right` prop
already exists): a `Switch` labelled **"Connectors"**, bound to a new
`voicingConnectorsAtom`. The old Show-on-Board `Switch` `Prop` is deleted.

- **New atom:** `voicingConnectorsAtom` — `atomWithStorage<boolean>`, key `voicingConnectors`,
  default **`false`** (the design screenshot shows the toggle off), `booleanStorage`,
  `GET_ON_INIT` — following the `fullChordsEnabledAtom` pattern in `chordOverlayAtoms.ts`.
- **Rendering:** `FretboardSVG` already computes `connectorPolylines`
  (`useChordConnectorPolylines`) and renders them. The chord connector polylines render
  only when `voicingConnectorsAtom` is true. The atom threads through the existing
  `useFretboardState` → `Fretboard` → `FretboardSVG` prop path (a new boolean prop, e.g.
  `showChordConnectors`); the render guard at the `connectorPolylines.length > 0` block
  ANDs in the flag. Interval connectors (`useIntervalConnectorPolylines`) are **not**
  affected — they belong to the fingering pattern, not the chord voicing.

### 5c. Voicing-control hints (diff item 2)

Type / Inversion / String Set each get a `Prop` `hint` matching the design:

- **Type** — "How densely the chord is voiced."
- **Inversion** — "Which chord tone is the lowest note."
- **String Set** — "Full CAGED uses all six strings — pick a subset for partial voicings."

New `useTranslation` keys under `inspector.*` (en + es).

### 5d. Voicing engine activation — the item-12 fix

`voicingMatchesAtom` (`src/store/chordOverlayAtoms.ts`) drops its
`if (!get(fullChordsEnabledAtom)) return []` line. The remaining gates are unchanged:
`chordOverlayHiddenAtom` (still driven by the lens-strip per-note machinery, defaults
false) and the `chordType` presence check. Net effect: whenever a chord is active
(Mode ≠ Off → `chordType` resolves) the engine runs, and **Type / Inversion / String Set
drive `voicingMatchesAtom` → `fullChordMatchesAtom` → the fretboard**.

`fullChordsEnabledAtom` keeps its definition (the View tab still imports it) but is no
longer read by the engine. **Cross-tab consequence:** the View-tab "Full Chords"
`ToggleProp` becomes a no-op. It is **not** removed here (out of tab scope) — recorded as a
follow-up for the View-tab parity pass (§8).

---

## 6. Control restyling

### 6a. ToggleBar proportions (diff item 1 — corrected)

The design's toggle bars are **less rounded, less wide, less tall** than the shipped ones.
In `src/components/shared/shared.module.css`:

- `.toggle-btn` — reduce `border-radius` (squarer corners), reduce `min-height`, reduce
  horizontal `padding`. Exact values are tuned against the design screenshots during
  implementation; the direction is unambiguous (smaller / squarer).
- `.toggle-group` — reduce its `padding`/`gap` to match.

This is shared CSS — every `ToggleBar` in the app shifts. That is intended (the design's
proportions are the new standard). Visual-regression baselines refresh across suites.

`shared.test.tsx` asserts `.toggle-btn` density values; update those assertions to the new
values.

### 6b. StringSetPicker (diff item 5)

In `src/components/Inspector/StringSetPicker.tsx` / `.module.css`:

- **Cyan on-strings.** `.stringOn` uses the cyan accent (`--neon-cyan` / `--accent-primary`)
  instead of `--text-muted`, in every card — not only the active card.
- **String order reversed.** The diagram currently renders thick (low-E) at the top. Flip
  it: thick low-E strings at the **bottom**, thin high-E at the top. The `mask` data and
  card `sub`-labels are unchanged — only the visual row order and the per-row thickness
  index flip.
- **Linear stroke ramp.** Replace the `2.2 - (i / 5) * 1.4` height formula with an even
  linear ramp from the thinnest high-E to the thickest low-E (e.g. a fixed min + a constant
  per-string step). The exact min/step is tuned to the design; the requirement is a
  constant delta between adjacent strings.

`StringSetPicker.test.tsx` is updated only if a changed assertion requires it (the role /
label / onChange contract is unchanged).

---

## 7. Deferred — app-shell layout (diff items 3, 4, 11)

Three differences are app-shell structure, not Chord-tab content:

- **3** — the Inspector is a full-width section, not inside a card.
- **4** — the fretboard sits inside a card.
- **11** — the status bar is full-width.

These are appended as a layout section to
`docs/superpowers/specs/2026-05-18-always-on-daw-model-design.md` and built in that effort.
This spec does not touch app-shell layout.

---

## 8. Cross-Cutting Notes

- New / changed UI strings (`Mode`, `Quality`, the Mode hint, the Lens hint, the three
  voicing hints, `Connectors`) go through `useTranslation`, en + es, following the existing
  `inspector.*` / `controls.*` key conventions.
- One new atom only: `voicingConnectorsAtom`. No other domain state added.
- Mandatory before each PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`,
  `npx tsc -b`.
- Visual-regression baselines refresh for `app-components` (Chord tab), `app-layout` (the
  shared ToggleBar restyle ripples app-wide), `fretboard-svg` (connectors), darwin + linux.
- **Follow-up (View-tab pass):** remove the View-tab "Full Chords" `ToggleProp` and retire
  `fullChordsEnabledAtom` once it has no remaining consumer.

## 9. Testing

- `ChordOverlayControls.test.tsx` — SOURCE row renders Mode/Degree(or Root)/Lens; Mode is
  3-option; Lens shows all three options with Tension disabled when unavailable; the Full
  Chords and Show-on-Board switches are gone; the Connectors toggle is present in the
  VOICING header and drives `voicingConnectorsAtom`; Type/Inversion/String Set show hints.
- `chordOverlayAtoms.test.ts` — `voicingMatchesAtom` returns engine output whenever a chord
  is active, regardless of `fullChordsEnabledAtom`; `voicingConnectorsAtom` default false.
- `StringSetPicker.test.tsx` — unchanged contract still passes.
- `shared.test.tsx` — `.toggle-btn` density assertions updated to the new values.
- `FretboardSVG` / `Fretboard` tests — chord connector polylines render only when the
  connectors flag is true.
- Visual regression — refresh the suites listed in §8.

## 10. Acceptance Criteria

- The Chord tab matches the two design screenshots: Source row (Mode · Degree/Root · Lens),
  Quality single-row grid, Voicing group with the Connectors header toggle, all hints.
- Switching voicing Type / Inversion / String Set visibly changes the fretboard.
- The Connectors toggle shows/hides the voicing connector lines.
- `StringSetPicker` uses cyan on-strings, low-E at the bottom, a linear stroke ramp.
- Toggle bars are the design's tighter, squarer proportions.
- No Full Chords switch, no Show-on-Board switch on the Chord tab.
- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` all pass.
