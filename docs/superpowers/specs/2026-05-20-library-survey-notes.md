# Library Survey — Reference Notes

**Status:** Reference document, not a spec. Produced 2026-05-20 alongside the FretFlow Integration Design ([`2026-05-20-fretflow-integration-design.md`](2026-05-20-fretflow-integration-design.md)).

**Date:** 2026-05-20

**Purpose:** Capture the library landscape considered during the integration brainstorm so future feature work can revisit candidates without re-doing the survey. The integration spec commits to **Tonal.js + Tone.js only**; this document records what else was considered and the conditions under which each becomes worth adopting.

---

## 1. Committed in the integration spec

| Library | Why committed | Modules in use |
|---|---|---|
| **Tonal.js** | Replaces bespoke theory (`core/theory.ts`, `core/degrees.ts`, parts of `core/circleOfFifthsUtils.ts`). Powers degree resolution, transposition, enharmonics, common-tone computation for the Lead lens. | `@tonaljs/chord`, `@tonaljs/scale`, `@tonaljs/note`, `@tonaljs/interval`, `@tonaljs/key` |
| **Tone.js** | Replaces bespoke audio scheduling. Powers `Tone.Transport`, `Tone.Sequence`, `Tone.PolySynth`, `Tone.Sampler`, metronome scheduling. Improves timing precision for beat-aware lens. | `tone` (single package) |

Bundle add: ~165KB gzipped (Tonal cherry-picked ~15KB; Tone ~150KB). Net after removing replaced bespoke code: approximately +120KB gzipped.

---

## 2. Deferred — feature-gated

These libraries solve real problems but only earn their bundle weight if a specific feature ships. Re-evaluate when the feature is proposed.

### 2a. MIDI

| Library | What it gives | Pulls in when |
|---|---|---|
| **`@tonejs/midi`** | Read / write standard MIDI files. Integrates cleanly with Tone.js since it shares the same author/ecosystem. | "Save progression as MIDI", "Import MIDI progression", "Export practice loop to my DAW" |

Approximate size: ~30KB gzipped.

### 2b. Music notation

| Library | What it gives | Pulls in when | Notes |
|---|---|---|---|
| **VexFlow** | Standard music notation renderer (treble/bass clef, key signatures, chord symbols). Mature, large API. | Sheet-music views of chords, scales, or progressions. | ~200KB gzipped. Heavy but standard. |
| **abcjs** | ABC notation → SVG renderer. Lighter than VexFlow, less expressive. | Quick chord-on-staff visualizations. | ~120KB gzipped. |
| **OpenSheetMusicDisplay** | MusicXML rendering. Built on VexFlow. | Importing teacher-provided sheet music. | Heaviest of the three. |

Verdict: if notation becomes a feature, **VexFlow** is the default pick unless the use case is constrained to chord diagrams (then abcjs).

### 2c. Algorithmic composition

| Library | What it gives | Pulls in when | Notes |
|---|---|---|---|
| **scribbletune** | Pattern-based melody / rhythm generation. Lightweight, deterministic. | "Suggest a melody over this progression", "Generate a bass line" | ~50KB gzipped. |
| **magenta-music** | ML-based melody / chord continuation. TensorFlow.js dependency. | "AI-generated continuation", "Style-transfer the backing track" | ~500KB+ gzipped (with TF.js). Heavy. |

Verdict: scribbletune is the modest pick; magenta is only worth it if AI-driven generation becomes a top-line feature.

### 2d. UI / interaction

| Library | What it gives | Pulls in when | Notes |
|---|---|---|---|
| **`@dnd-kit`** | Drag-and-drop for reordering progression steps (replacing the up/down buttons in `ProgressionControls.tsx`). Modern, accessible, tree-shakeable. | Song tab progression-step editing should feel direct. | ~25KB gzipped. Strong candidate when polishing the Song tab. |
| **react-dnd** | Older drag-and-drop. Larger API surface. | — | Skip in favor of @dnd-kit. |

`@dnd-kit` is the closest to "adopt during the integration if you want" — the Song-tab UX would improve, and the library is small. The integration spec defers it; if the user changes their mind, it slots into Phase 3 (Inspector reshape) or Phase 8 (Polish) cleanly.

### 2e. Persistence

| Library | What it gives | Pulls in when | Notes |
|---|---|---|---|
| **`idb-keyval`** | Async, robust IndexedDB key-value store. ~600 bytes. | "Save named progression", "Export / import song", larger persisted state than localStorage handles cleanly. | Tiny; safe to adopt once persistence needs outgrow localStorage. |
| **Dexie.js** | Full IndexedDB ORM. | Complex relational persistence (multiple songs, tags, history). | ~40KB gzipped. Overkill until justified. |

### 2f. Sample-based instruments

| Library | What it gives | Pulls in when | Notes |
|---|---|---|---|
| **`soundfont-player`** | SoundFont (.sf2) playback in the browser. | If Tone.js's built-in synths sound thin and we want higher-quality sampled instruments. | ~20KB gzipped + sample bytes. Tone.js's `Tone.Sampler` may already cover this. |
| **`webaudiofont`** | Pre-encoded instrument samples (large library). | Same trigger as soundfont-player. | Generous sample library; bundle impact depends on which instruments are imported. |

Verdict: only adopt if Tone.js audio quality is found insufficient after Phase 7.

---

## 3. Considered and explicitly skipped

These libraries overlap with what's already adopted, or don't add enough value to justify the dependency.

| Library | Why skipped |
|---|---|
| **music21j** | Alternative theory library to Tonal. No reason to double up. |
| **teoria** | Older theory library, less maintained than Tonal. |
| **howler.js** | General-purpose Web Audio wrapper. Tone.js covers the same ground better for music applications. |
| **d3 / visx** | Chart/data-viz libraries. FretFlow's SVG rendering is bespoke and fine; no chart-style needs. |
| **react-dnd** | Older drag-and-drop. `@dnd-kit` is the modern replacement (§2d). |
| **midijs** | Alternative MIDI handler. `@tonejs/midi` integrates better with the Tone.js audio stack. |

---

## 4. Decision framework — when to revisit

For each candidate, the test is the same:

1. **Is a specific feature pulling for it?** Don't adopt a library to "have it ready." Adopt it when a designed feature needs it.
2. **Does it replace meaningfully more bespoke code than it adds?** Tonal does (clear win). Tone.js does (clear win). VexFlow would replace zero existing code (pure addition).
3. **Is the bundle add proportional to the feature value?** Magenta-music's 500KB+ only pays off if AI generation is a top-line feature.
4. **Is there a maintained alternative we already use?** If yes, default to the one we have unless the alternative offers a distinct advantage.

A library passes the bar when the answer is *yes* to (1), and *yes* to either (2) or (3).

---

## 5. Bundle budget context

For reference when re-evaluating:

- Pre-integration estimated bundle: ~400KB gzipped (rough order-of-magnitude — verify with `pnpm run build` + bundle analyzer).
- Post-integration estimated: ~520KB gzipped (Tonal + Tone added, theory layer shrunk).
- Reasonable target ceiling for a guitar practice app: ~800KB gzipped.
- Headroom remaining post-integration: ~280KB.

VexFlow (200KB) and Magenta (500KB+) are the only candidates large enough that bundle pressure would be a primary consideration. Most others fit comfortably.

---

## 6. Related context

- The integration spec ([`2026-05-20-fretflow-integration-design.md`](2026-05-20-fretflow-integration-design.md) §9) is the source of truth for committed libraries.
- The voicing engine redesign spec ([`2026-05-18-voicing-engine-redesign-design.md`](2026-05-18-voicing-engine-redesign-design.md)) is the closest existing reference for a pure-engine change without new libraries — useful precedent for measuring "what fraction of an engine rewrite needs library help."
