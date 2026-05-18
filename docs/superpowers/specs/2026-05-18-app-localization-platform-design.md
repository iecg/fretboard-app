# App-Wide Localization Platform — Design

**Status:** Brainstorm spec. Produced 2026-05-18 after a theme-contract review surfaced
that lens, pattern, scale, chord-type and tuning **value names** are English-hardcoded
across the whole app — the typed `useTranslation` system only covers field labels and
hints.

**Date:** 2026-05-18

**Scope:** Turn FretFlow's partial in-house i18n into a complete, scalable localization
platform: every user-visible string resolves through translation, core-domain names
localize, numbers/plurals format per locale, and tooling keeps it that way.

---

## 1. Background

### Current state

- `src/i18n/{en,es,types}.ts` — `types.ts` declares a `Dictionary` interface; `en` and
  `es` implement it. `useTranslation()` reads `languageAtom`, picks a dictionary, and
  returns `t(keyPath)` which dot-walks the object and `console.warn`s + returns the raw
  key on a miss.
- ~166 keys, nested under `inspector.*`, `controls.*`, `statusBar.*`, `common.*`.
- Only **17 of 67** component files call `useTranslation`.

### Gap inventory

1. **Core-domain value names are English-hardcoded** and never localized anywhere:
   - Lens names — `LENS_REGISTRY` `label` / `description` in `packages/core/src/theory.ts`.
   - Scale / mode names — `theoryCatalog.ts` `displayLabel` ("Major (Ionian)"), `shortLabel`.
   - Chord-type names — `CHORD_DEFINITIONS` keys ("Major Triad") and the
     `CHORD_TYPE_SHORT_LABELS` map.
   - Tuning names — `packages/core/src/guitar.ts` ("Standard", "Drop D").
2. **Pattern value names** — "CAGED" / "3NPS" / "None" / "One String" / "Two Strings" —
   hardcoded in `FingeringPatternControls.tsx` *and* duplicated in `StatusBar.tsx`.
3. **Compact lens labels** — `LENS_SHORT_LABELS` hardcoded and duplicated in
   `ChordOverlayControls.tsx` and `StatusBar.tsx`.
4. **39 hardcoded `aria-label="…"` literals** across components, plus visible string
   literals in the ~50 components that never call `useTranslation`.
5. **No locale-aware formatting** — numbers, ordinals ("1st" inversion), and any
   count-dependent text are concatenated as English.
6. **No guard** — nothing stops a new hardcoded string from shipping.

Non-translatable by nature (explicitly out of scope, allowlisted): note names
(C, D♯…), scale-degree roman numerals (i, IV, vii°), CAGED shape letters.

---

## 2. Goals and Non-Goals

### Goals

- Every user-visible string — visible text and `aria-label` / `aria-description` —
  resolves through `t()`.
- Core-domain names (lens, scale, chord-type, tuning, pattern) localize app-wide and
  consistently.
- New locales are **drop-in**: `en` is the source of truth, other locales are partial
  and fall back per-key to `en`.
- Numbers, ordinals, and plural-sensitive messages format for the active locale.
- A lint rule fails CI on new hardcoded user-facing strings.
- The contribution path — adding a key, adding a locale — is documented.

### Non-Goals

- No translation of the non-translatable allowlist (§1).
- No new spoken locales delivered here — the platform must *support* `fr`, `de`, … but
  this effort ships only the existing `en` + `es` content.
- No right-to-left layout work — RTL is a separate future effort; the platform must not
  block it but does not implement it.
- No third-party i18n library swap (see §3, Approach decision).

---

## 3. Architecture

### Approach decision — extend the in-house system

Two approaches were considered:

- **A — Extend the existing typed in-house system (chosen).** It is small, dependency-
  free, and gives compile-time key checking. We add fallback, lazy loading, formatting,
  and tooling around it.
- **B — Adopt `react-i18next` / `formatjs`.** Rejected: a full migration of 166 keys +
  17 consumers for capabilities (fallback, plurals, lazy load) that are cheap to add to
  the current system, and it would forfeit the compile-time `Dictionary` typing.

### 3a. Locale model & per-key fallback

- **`en` is the canonical source of truth.** The `Dictionary` type is *derived* from it:
  `export type Dictionary = typeof en`. `en` is exhaustive by construction — there is no
  separate hand-maintained interface to drift.
- Non-`en` locales are typed `DeepPartial<Dictionary>` — they may omit any key.
- `t(key)` resolves the active locale first; for any missing segment it falls back to
  `en`; if `en` also lacks the key it `console.warn`s in dev and returns the raw key.
- This makes a new locale drop-in: a partial dictionary, with `en` covering every gap.

### 3b. Lazy-loaded locale bundles

- `en` is statically imported — it is always needed as the fallback.
- Every other locale is registered as a dynamic importer:
  `{ es: () => import("./es"), fr: () => import("./fr") }`.
- A locale loader (an atom-driven effect, or an i18n provider) loads the active
  non-`en` locale on `languageAtom` change; until it resolves the UI renders `en`.
- Result: non-active locale dictionaries stay out of the main bundle.

### 3c. Core-domain names — id-keyed, app owns translation

`@fretflow/core` must not depend on the app's i18n. The contract:

- Core exposes a **stable string id** for every domain value — lenses (`targets`,
  `guide-tones`, `tension` — already present), scale modes, chord types, tunings,
  fingering patterns. Where an id does not yet exist (chord types are keyed by their
  English name; tunings likewise), core gains an explicit `id` slug.
- Core keeps its current English names — those *are* the `en` values; nothing is
  duplicated.
- The app i18n gains domain namespaces — `lens.*`, `scale.*`, `chordType.*`,
  `tuning.*`, `pattern.*` — populated only in **non-`en`** locale dictionaries. `en`
  needs no domain entries: a **domain-name resolver** resolves `t()` for a domain id
  and falls back to core's English name when the active locale lacks it.
- A single resolver (e.g. `useDomainLabel()` / `domainLabel(kind, id, locale)`) replaces
  every raw read of `LENS_REGISTRY.label`, `CHORD_TYPE_SHORT_LABELS`, the duplicated
  `LENS_SHORT_LABELS` / `PATTERN_LABELS`, and scale/tuning display names.

### 3d. Locale-aware formatting

- A formatting layer wraps `Intl.NumberFormat` (numbers, BPM, fret indices) and
  `Intl.PluralRules` (count-sensitive messages) keyed to the active locale.
- Plural messages use a sub-key convention — `key.one` / `key.other` (etc. per the
  locale's plural categories) — resolved by a `tPlural(key, count)` helper built on
  `Intl.PluralRules`. No ICU-MessageFormat dependency.
- Ordinals (voicing inversions "1st/2nd/3rd") move from hardcoded strings to a locale
  ordinal formatter.

### 3e. Tooling

- An ESLint rule — `eslint-plugin-i18next`'s `no-literal-string` (or equivalent) —
  flags hardcoded user-facing strings in JSX text and in `aria-label` /
  `aria-description` / `title` / `placeholder` attributes. It is wired into
  `pnpm run lint`. A scoped allowlist covers the non-translatable set (§1) and
  non-UI strings (test ids, data attributes, class names).
- A locale-coverage script/test reports, per non-`en` locale, which keys are missing
  (informational — fallback keeps the app correct) so translators see their TODO list.

---

## 4. Phasing

Five phases, each independently shippable and verifiable. Each becomes its own
implementation plan.

- **Phase 1 — Locale platform.** §3a + §3b: `Dictionary = typeof en`, partial locales,
  per-key `en` fallback in `t`, lazy-loaded non-`en` bundles, dev miss-warnings. No
  visible change; the engine becomes fallback-capable and code-split.
- **Phase 2 — Domain-name localization.** §3c: core `id` slugs where missing, the
  domain-name resolver, the `lens/scale/chordType/tuning/pattern` namespaces, `es`
  translations for them. Replace every hardcoded/duplicated domain label
  (`LENS_SHORT_LABELS`, `PATTERN_LABELS`, raw `LENS_REGISTRY.label`, scale/chord/tuning
  displays). Lens/scale/chord/pattern/tuning names now localize everywhere.
- **Phase 3 — UI string sweep.** Audit all 67 components; route every visible literal
  and `aria-label` literal through `t()`, adding keys to `en` (+ `es`). The 39 known
  `aria-label` literals and the ~50 non-`useTranslation` components are the worklist.
- **Phase 4 — Locale-aware formatting.** §3d: the `Intl` formatting layer, `tPlural`,
  ordinal formatter; migrate concatenated number/count strings.
- **Phase 5 — Tooling & workflow.** §3e: the ESLint rule + allowlist wired into lint,
  the coverage check, and `docs/` guidance for adding keys and locales.

---

## 5. Cross-Cutting Notes

- `languageAtom` (`src/store/languageAtom.ts`) stays the single source of the active
  locale; the loader subscribes to it.
- The `Dictionary`-from-`en` flip means every existing `es` key is still checked
  (`DeepPartial<Dictionary>` rejects unknown keys); only *omission* becomes legal.
- Phase 3 is the largest and is safe to land component-by-component behind the Phase 1
  engine.
- Mandatory before each phase's PR: `pnpm run lint`, `pnpm run test`, `pnpm run build`,
  `npx tsc -b`.
- Visual-regression baselines refresh wherever a swept string changes rendered width.

## 6. Testing

- **Phase 1** — `t()` returns the active-locale value when present, the `en` value when
  the locale omits the key, and the raw key (with a dev warn) when `en` omits it;
  the lazy loader resolves and swaps the dictionary.
- **Phase 2** — the domain resolver returns the localized name for a known id in `es`
  and the English core name in `en` / on a missing translation; every consumer
  (`StatusBar`, `ChordOverlayControls`, `FingeringPatternControls`, scale/chord pickers)
  renders the resolved name.
- **Phase 3** — a representative swept component renders localized text under `es`; the
  ESLint rule (added in Phase 5) backstops the rest. Visual regression for width shifts.
- **Phase 4** — number/ordinal/plural helpers format correctly for `en` and a locale
  with different plural rules; a count-sensitive message picks the right plural form.
- **Phase 5** — the lint rule fails on an added hardcoded JSX string and on a hardcoded
  `aria-label`; the coverage check lists missing keys for a deliberately-incomplete
  locale.

## 7. Acceptance Criteria

- `en` is the typed source of truth; a non-`en` locale may omit keys and the app still
  renders correct text via per-key fallback.
- Non-`en` locale bundles are code-split out of the main chunk.
- Lens, scale, chord-type, tuning, and pattern names render localized in every
  surface (inspector, status bar, pickers) — no English-hardcoded duplicates remain.
- Every user-visible string and `aria-label` resolves through `t()`; the lint rule
  fails CI on a new hardcoded one.
- Numbers, ordinals, and plural messages format for the active locale.
- Adding a new locale requires only a new partial dictionary file and a registry entry.
- `pnpm run lint`, `pnpm run test`, `pnpm run build`, `npx tsc -b` pass at every phase.

---

## 8. Addendum — Progression tab string inventory (2026-05-18)

An automated review of the Inspector Tab Refinements branch (PR #414) flagged the
Progression tab as still English-hardcoded. The strings below are concrete worklist
items for the phases above — recorded here so the sweep does not miss them. They are
deliberately *not* fixed in #414: piecemeal localization of a few lines would be
inconsistent with the surrounding hardcoded siblings and is out of that branch's scope.

### Phase 3 worklist — Progression tab components

- **`src/components/ProgressionControls/BackingTrackControls.tsx`** — `LabeledSelect`
  `label` props ("Genre style", "Chord instrument", "Chord pattern", "Bass pattern",
  "Drum pattern"); the `aria-label="Swing amount"`; the inline chord-instrument option
  labels ("Strum", "Piano", "Organ"); the "Custom" genre option label.
- **`src/components/ProgressionControls/ProgressionControls.tsx`** — the chord-action
  toolbar visible text ("Add", "Duplicate") and its `aria-label`s ("Add chord", "Move
  chord up", "Move chord down", "Duplicate chord", "Remove chord"); the
  "Selected — &lt;degree&gt; · &lt;chord&gt;" editor header; the "Degree" / "Duration" /
  "Quality" section labels; the control `aria-label`s ("Progression mode", "Beats per
  bar", "Preset", "Progression degree", "Duration value", "Duration unit", "Chord
  quality"); the empty-state hint ("Add a chord or load a preset.") and the quality
  hint copy.

### Domain-inventory addition — backing-track names

§1.1's domain inventory omits two backing-track value-name sets. The §1.2 "pattern
value names" entry covers *fingering* patterns (CAGED / 3NPS / …), not these. Add the
following to the Phase 2 domain-name work:

- **Genre style names** — `GENRE_STYLES[].label` in
  `src/progressions/audio/genres.ts` ("Pop", "Rock", "Blues", "Jazz", …).
- **Chord / bass / drum pattern names** — the `label` fields of `CHORD_PATTERNS`,
  `BASS_PATTERNS`, and `DRUM_PATTERNS` in `src/progressions/audio/patterns.ts`.

These follow the §3c id-keyed contract: each entry already carries a stable `id`, so
the app gains `genre.*` and `backingPattern.*` namespaces — populated in non-`en`
locales only — with the domain-name resolver falling back to the English `label`.
