# Help Modal Redesign — Design Spec

**Date:** 2026-06-07
**Status:** Approved (design)
**Component:** `src/components/HelpModal/`

## Problem

The in-app help modal (`HelpModal.tsx`, ~250 lines of hardcoded English JSX) is badly
out of date. The app has grown a full progression/song system — presets, backing
tracks, transport, voice-leading emphasis, the Inspector's Overlay/Song tabs — none of
which the help documents. The keyboard-shortcut section lists only `S`/`C` while the
real handler binds eleven keys. Section names are wrong (help says "Theory/View"; the
Inspector tabs are "Overlay/Song"). The content is a single long scroll, all strings are
hardcoded (inconsistent with the app's en/es i18n), and there are no visuals.

## Goals

- Bring every section in line with the current code.
- Add the missing progression/song/backing-track/transport documentation.
- Introduce lightweight, theme-aware visuals.
- Move content into the app's i18n system (English + Spanish).
- Restructure for scannability following established help-UX guidance.

## Non-Goals

- No contextual/inline tooltips or guided tours — this is the pull-style reference modal only.
- No search box (content is small enough to scan within a tab).
- No screenshots or raster images.

## Research Basis

- **NN/g Heuristic #10 (Help & Documentation):** help should be searchable, concise,
  task-focused, written from the user's perspective, and verb-oriented. → All body copy
  is rewritten as task-oriented prose ("Tap a note to set the tonic"), not feature dumps.
- **Nielsen — progressive disclosure:** never exceed two disclosure levels. → Tabs are
  the single disclosure level. No nested accordions inside a tab.
- **"Everboarding":** keep an ongoing "What's new" surface for new features rather than a
  one-time tutorial. → Generalized, versioned What's-new notice.

Sources: NN/g *Help and Documentation*, NN/g *Onboarding Tutorials vs. Contextual Help*,
NN/g *Pop-ups and Adaptive Help*, IxDF *Progressive Disclosure*.

## Design

### Structure: tabbed modal

The modal keeps its current Radix Dialog shell, overlay, animation, sizing, and close
button. The body becomes a **tab bar + a single scrollable panel** for the active tab.
Five tabs, each a short, self-contained topic:

| Tab id | Label (en) | Covers |
|---|---|---|
| `start` | Start | What FretFlow is; layout (mobile tab bar vs tablet/desktop cards); the Inspector's Overlay/Song tabs; a current "What's new" notice. |
| `notes` | Notes | Note-role colors; Note Labels (Notes / Intervals / None); the degree strip; tap-to-hear audio. |
| `shapes` | Scales & Shapes | Root selection; scale family + mode; Parallel/Relative browsing; CAGED / 3NPS / All patterns; Full Chords and voicings (Full/Close + string sets); Circle of Fifths. |
| `play` | Progressions & Songs | Diatonic chords; the Song tab; presets by genre; building/editing the progression sequence; time signature + tempo; backing track (chord/bass/drums/metronome); loop; transport (play/pause/stop, step navigation); voice-leading emphasis and practice-bar cues. |
| `settings` | Settings & Shortcuts | Settings drawer (tuning, zoom, fret range, accidentals, enharmonic display, sound quality, theme, language, reset); full keyboard-shortcut map. |

The tab bar uses the existing pill/segmented styling vocabulary already present in the
app. The active tab is tracked in local component state (not persisted). Opening the
modal always starts on `start`.

### Content config

Content moves out of JSX into a typed config so layout/order/diagram placement are data,
not markup:

```
src/components/HelpModal/helpContent.ts

interface HelpItem  { labelKey?: string; bodyKey: string }   // labelKey → bold lead-in
interface HelpSection { titleKey: string; diagram?: DiagramId; items: HelpItem[] }
interface HelpTab   { id: string; labelKey: string; sections: HelpSection[] }
export const HELP_TABS: HelpTab[]
```

`HelpModal.tsx` maps `HELP_TABS` → tab bar + active panel. Each `HelpItem` renders as a
paragraph or list row; when `labelKey` is present it renders `<strong>{t(labelKey)}</strong>`
followed by `{t(bodyKey)}`. This preserves today's bold inline lead-ins without embedding
markup inside translation strings.

### Diagrams

Small inline-SVG (or lightweight markup) components, one folder, keyed by a `DiagramId`
union and resolved by a `<HelpDiagram id={...} />` switch:

```
src/components/HelpModal/diagrams/
  LayoutMapDiagram.tsx       // mobile single-panel vs desktop three-card boxes
  NoteRoleLegendDiagram.tsx  // color swatch + label per note role
  ShapeDiagram.tsx           // mini fretboard: one CAGED box vs a 3NPS span
  VoiceLeadingDiagram.tsx    // anticipation / hold / departing legend + mini transport
  ShortcutTableDiagram.tsx   // keyboard-shortcut table
```

**Theme-correctness is the core maintainability win:** diagrams reference the same CSS
custom properties the fretboard uses for note roles and surfaces (e.g. the note-role
legend reads the live role colors), so they track light/dark themes and any future token
changes automatically — there is nothing to re-capture when the UI shifts.

Diagram labels are i18n keys too (passed in or read via `useTranslation`).

### What's New

Replace the stale, single-purpose `seenChordModeRemovalNoticeAtom` (chord-mode removal
is long past) with a generalized, versioned notice:

- `helpWhatsNewSeenAtom` — `atomWithStorage<string>` holding the id of the last-seen
  notice (storage key via `src/utils/storage.ts`).
- A single current notice id + copy lives in `helpContent.ts` / i18n. The notice renders
  on the **Start** tab only when its id ≠ the stored seen id; "Got it" writes the id.
- Updated copy points at progressions, songs, and backing tracks.

### Corrections captured (ground truth from code)

- **Keyboard shortcuts** (`src/hooks/useKeyboardShortcuts.ts`):
  `Space` play/pause · `.` stop · `R` loop · `M` mute · `1` chord track · `2` bass ·
  `3` drums · `4` metronome · `←/→` previous/next step (when stopped) · `S` scale layer ·
  `C` chord layer. Modifier-held keys and typing in inputs are ignored.
- **Inspector tabs** are **Overlay** and **Song** (`inspector.viewTab` / `inspector.songTab`).
- **Voicings:** Off / Full / Close, plus string-set selection (All / Bass / Lower mid /
  Middle / Upper mid / Treble).
- **Settings** now also exposes **Sound quality** and **Language**.

## i18n

- Add a `help` tree to `Dictionary` (`src/i18n/types.ts`) covering tab labels, section
  titles, item labels/bodies, diagram labels, and the What's-new notice.
- Fill English values in `en.ts`; write matching Spanish values in `es.ts` in the same
  register as the existing translations.
- All access goes through the existing `t("help.…")` (`useTranslation`), which already
  warns on missing keys.

## Files

**New**
- `src/components/HelpModal/helpContent.ts`
- `src/components/HelpModal/diagrams/*` (five diagram components + an index/switch)

**Modified**
- `src/components/HelpModal/HelpModal.tsx` — render tabs + active panel from config; tab state.
- `src/components/HelpModal/HelpModal.module.css` — tab bar styling; keep shell.
- `src/components/HelpModal/HelpModal.test.tsx` — rewrite (see Testing).
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — `help` tree.
- `src/store/uiAtoms.ts` — replace `seenChordModeRemovalNoticeAtom` with `helpWhatsNewSeenAtom`.

**Removed**
- The hardcoded English JSX body and `seenChordModeRemovalNoticeAtom`.

## Testing

Rewrite `HelpModal.test.tsx`:

- Renders dialog when open; close button calls `onClose`; focus moves to close button
  (retain existing behavior).
- Renders the tab bar; clicking each tab shows that tab's sections and hides others.
- Each diagram component mounts without error on its tab.
- Stale-term guards: no "Theory/View" Inspector labels, no "Focus" section, no removed
  lens names; shortcut section lists the real keys.
- What's-new: notice shows when the current id ≠ stored seen id, hides when equal, and
  "Got it" writes the id.
- i18n coverage: every `help.*` key referenced by `HELP_TABS` resolves in **both** `en`
  and `es` (no key falls back to the raw path).

## Risks / Mitigations

- **Spanish drift** — new English keys without Spanish. Mitigated by the i18n coverage
  test asserting both dictionaries.
- **Diagram/theme coupling** — a renamed CSS token could blank a diagram. Diagrams use
  the same tokens the fretboard reads, so a rename breaks both visibly; a smoke-render
  test catches a hard failure.
- **Tab count on small screens** — five pills. Labels are terse and the bar wraps; if it
  proves cramped in visual review, merge `notes` into `shapes` (4 tabs).

## Out-of-scope follow-ups

- Generalized multi-entry What's-new history.
- Per-control contextual tooltips linking into the relevant help tab.
