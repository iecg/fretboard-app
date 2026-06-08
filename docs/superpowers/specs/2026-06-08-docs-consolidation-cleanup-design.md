# Docs Consolidation & Cleanup — Design

**Date:** 2026-06-08
**Status:** Approved, ready for implementation plan.

## Problem

`docs/superpowers/` has accumulated 18 plans and 23 specs, nearly all of which
describe work that has already shipped to `main`. Specs and plans are *ephemeral*
by design — they describe a unit of work and are meant to be pruned once the work
lands. But the **research and rationale** inside them (music pedagogy, perception
science, guitar conventions, engineering principles) is *durable* and is currently
trapped in soon-to-be-deleted files.

`docs/design/fretboard-visual-language.md` already establishes the durable-vs-ephemeral
model: it lives outside `docs/superpowers/`, consolidates the "why" behind the visual
language, and records provenance (including SHAs for specs already pruned from `main`).
This cleanup extends that proven pattern to the rest of the project's durable research,
then prunes the ephemeral source files.

A secondary goal: make the durable docs **discoverable without polluting always-loaded
context**. Per Claude Code best practice (reference-not-import: CLAUDE.md is the index,
`docs/` is the library), the docs are pulled in on demand via a compact trigger-based
reference list — never `@`-imported.

## Goals

1. Consolidate durable research from shipped specs into durable design docs in `docs/design/`.
2. Hard-delete all shipped/stale plans, specs, and their assets (recoverable via git).
3. Make durable docs discoverable via a lightweight, context-cheap reference from CLAUDE.md.

## Non-goals

- No layout/responsive durable doc (no durable research cluster; already covered in CLAUDE.md).
- No `@`-import of design docs into CLAUDE.md (would embed full files every session).
- No code changes. This is documentation-only.
- No archive folder — deletion relies on git history, matching the existing model.

## Design

### Durable docs (final set, all in `docs/design/`)

Each doc mirrors the established structure of `fretboard-visual-language.md`:
decisions → rationale (tagged `[web]` / `[spec]` / `[convention]` / `[internal]`) →
annotated citation index → **§Provenance** listing every source spec with its
pre-deletion SHA so `git show <sha>:<path>` recovers the original.

1. **`fretboard-visual-language.md`** — *updated*.
   - Refresh §10 Provenance: specs being deleted in this cleanup move from "Present on
     `main`" to "Pruned, recovered from history," each annotated with the last commit SHA
     before deletion.
   - Resolve shipped "TBD / deferred" items: the improvisation lenses landed (#550), so the
     §3A degree-lens entry and the relevant §6 deferred items are updated to reflect shipped
     state (or moved to the new pedagogy doc where they fit better).

2. **`audio-voicing-engine.md`** — *new*.
   Consolidates the rationale behind the voicing/strum/audio engine. Source specs:
   - `2026-06-01-audio-voicing-engine-design.md`
   - `2026-06-03-strum-inversion-voicing-design.md`
   - `2026-06-03-full-voicing-fallback-design.md`
   - `2026-06-03-funk-bossa-voicing-migration-design.md`
   - `2026-06-03-expose-voicing-knobs-design.md`
   Covers: inversion-based strum voicing (color tones internal), scored close-voicing
   fallback, funk/bossa voicing migration, exposed voicing knobs, and the Tone.js/Web-Audio
   engine principles.

3. **`music-theory-pedagogy.md`** — *new*.
   Consolidates the music-theory and pedagogy grounding. Source specs:
   - `2026-06-01-extended-chord-qualities-design.md`
   - improvisation-lenses grounding (`2026-06-07-improvisation-lenses-design.md`)
   - guide-tone-line grounding (currently partly in visual-language §3C/§7)
   Covers: extended chord qualities (9/11/13, 6/9; extensions vs. alterations), guide-tone
   lines, improvisation lenses (Root / Guide / Common-practice), modal characteristic tones.
   Cross-references visual-language.md for the *rendering* of these concepts (theory lives
   here; how it's drawn lives there — the two domains stay separate).

### Discoverability (context-cheap referencing)

- **`docs/design/README.md`** — *new* index. One-line summary per durable doc plus a
  "when to consult" trigger. Navigable without git.
- **CLAUDE.md** — add one compact block (~4 content lines), trigger-based, no `@`-import:

  ```text
  ## Design Rationale (read on demand — do not preload)
  Durable "why" docs live in docs/design/ (index: docs/design/README.md). Consult before changing:
  - markers / color / motion / connectors → fretboard-visual-language.md
  - voicing / strum / fallback / audio → audio-voicing-engine.md
  - chord theory / scales / lenses / pedagogy → music-theory-pedagogy.md
  ```

### Deletion

Hard-delete, **after** consolidation, in this order:
1. Extract durable research → write/update the 3 durable docs.
2. Record each deleted spec's pre-deletion SHA in the relevant doc's §Provenance.
3. Delete all plans (`docs/superpowers/plans/*`), all specs (`docs/superpowers/specs/*`),
   and `docs/superpowers/specs/assets/*` (the SVG + PNG go with their specs).

Spot-check before deleting, in case they hold un-shipped forward-looking ideas:
- `2026-06-04-fretboard-followups-exploration-draft.md` (a draft — may contain deferred
  ideas to migrate into a durable doc's "Open questions / deferred" section).
- `2026-06-03-expose-voicing-knobs-design.md` and `2026-06-03-funk-bossa-voicing-migration-design.md`
  (confirm fully shipped vs. partial).

Any genuinely un-shipped, forward-looking content is migrated into the relevant durable
doc's "Open questions / deferred" section rather than lost.

### Provenance SHA capture

For each deleted file, the recorded SHA is the **last commit that modified the file before
its deletion** (`git log -1 --format=%H -- <path>`), so the file content is recoverable via
`git show <sha>:<path>`.

## Verification

- `docs/superpowers/plans/` and `docs/superpowers/specs/` are empty (or the directories
  removed) except for this design doc, which is itself ephemeral and deleted last.
- `docs/design/` contains exactly: `README.md`, `fretboard-visual-language.md`,
  `audio-voicing-engine.md`, `music-theory-pedagogy.md` (+ any migrated `assets/`).
- Every durable doc's §Provenance lists a valid SHA for each source spec; spot-check that
  `git show <sha>:<path>` succeeds for a sample.
- CLAUDE.md gains only the ~4-line reference block; no `@`-imports; total file stays well
  under the ~200-line guideline.
- `pnpm run lint` passes (markdown/stylelint scope unaffected, but run to be safe).

## Decisions log

- **Removal policy:** hard delete (git history), not an archive folder — matches the
  existing visual-language model.
- **Durable doc set:** audio/voicing engine + music-theory/pedagogy as new docs; update
  visual-language; no layout doc (YAGNI).
- **Referencing:** reference-not-import, trigger-based list in CLAUDE.md + README index,
  grounded in Claude Code progressive-disclosure best practice.
- **Assets:** deleted with their specs.
