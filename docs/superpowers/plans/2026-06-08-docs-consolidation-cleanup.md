# Docs Consolidation & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate durable research from shipped specs into `docs/design/`, hard-delete the ephemeral plans/specs, and make the durable docs discoverable from CLAUDE.md without bloating context.

**Architecture:** Mirror the existing `docs/design/fretboard-visual-language.md` pattern — decisions → tagged rationale (`[web]`/`[spec]`/`[convention]`/`[internal]`) → citation index → §Provenance with pre-deletion SHAs. Two new durable docs (audio/voicing, theory/pedagogy), one updated (visual-language), a README index, and a context-cheap reference-not-import block in CLAUDE.md. Deletion happens last so nothing is lost before consolidation.

**Tech Stack:** Markdown only. No code changes. `git` for SHA capture and recovery verification; `pnpm run lint` as the safety gate.

**Source specs and their recovery SHAs** (captured 2026-06-08; `git show <sha>:<path>` recovers each):

| Spec | SHA |
|---|---|
| `2026-06-01-audio-voicing-engine-design.md` | `83e8cdee` |
| `2026-06-03-strum-inversion-voicing-design.md` | `ef93f7c1` |
| `2026-06-03-full-voicing-fallback-design.md` | `759634c3` |
| `2026-06-03-funk-bossa-voicing-migration-design.md` | `ef93f7c1` |
| `2026-06-03-expose-voicing-knobs-design.md` | `ef93f7c1` |
| `2026-06-01-extended-chord-qualities-design.md` | `8d7b5da6` |
| `2026-06-07-improvisation-lenses-design.md` | `5566bde9` |
| `2026-06-03-chord-overlay-grouping-markers-design.md` | `5ce84af8` |
| `2026-06-03-chord-overlay-color-consistency-design.md` | `5ce84af8` |
| `2026-06-03-fb-marker-apca-audit.md` | `c973b674` |
| `2026-06-03-marker-color-followups-design.md` | `432e2651` |

> If any SHA fails to resolve at execution time (e.g. history rewritten), re-capture with
> `git log -1 --format=%h -- <path>` BEFORE deleting that file.

---

## File Structure

**Create:**
- `docs/design/audio-voicing-engine.md` — durable "why" for the voicing/strum/fallback/audio engine.
- `docs/design/music-theory-pedagogy.md` — durable "why" for chord theory, scales, lenses, guide tones, modes.
- `docs/design/README.md` — index of durable design docs with "when to consult" triggers.

**Modify:**
- `docs/design/fretboard-visual-language.md` — refresh §10 provenance + shipped deferred items.
- `CLAUDE.md` — add a ~4-line "Design Rationale (read on demand)" reference block.

**Delete (last):**
- All of `docs/superpowers/plans/*` and `docs/superpowers/specs/*` (incl. `assets/`), including this plan and its design spec.

---

### Task 1: Spot-check candidate specs for un-shipped forward-looking ideas

Before consolidating, confirm the three flagged specs don't hold deferred ideas that would be lost. Anything forward-looking gets migrated into a durable doc's "Open questions / deferred" section in later tasks.

**Files:**
- Read only: three spec files below.

- [ ] **Step 1: Read the exploration draft and two voicing specs**

Run:
```bash
sed -n '1,400p' docs/superpowers/specs/2026-06-04-fretboard-followups-exploration-draft.md
sed -n '1,400p' docs/superpowers/specs/2026-06-03-expose-voicing-knobs-design.md
sed -n '1,400p' docs/superpowers/specs/2026-06-03-funk-bossa-voicing-migration-design.md
```

- [ ] **Step 2: Cross-check each against shipped commits**

Run: `git log --oneline -50 | grep -iE "voicing|funk|bossa|knob|followup"`
Expected: identify which ideas shipped. For `expose-voicing-knobs` and `funk-bossa`, confirm the feature is on `main`. For the exploration draft, note any idea NOT traceable to a merged PR.

- [ ] **Step 3: Record the disposition inline in this plan**

Append a short bullet list under this step listing each un-shipped idea found and which durable doc's "Open questions / deferred" section it will migrate to (visual-language, audio-voicing, or music-theory). If everything shipped, write "All shipped — nothing to migrate." No commit (this is analysis; the result feeds Tasks 2–4).

Disposition (fill in during execution):
- _(to be filled)_

---

### Task 2: Write `docs/design/music-theory-pedagogy.md`

**Files:**
- Create: `docs/design/music-theory-pedagogy.md`
- Read: source specs `8d7b5da6:.../2026-06-01-extended-chord-qualities-design.md`, `5566bde9:.../2026-06-07-improvisation-lenses-design.md`; existing `docs/design/fretboard-visual-language.md` §3C/§7/§8 (guide-tone + modal grounding to relocate).

- [ ] **Step 1: Read the source material**

Run:
```bash
git show 8d7b5da6:docs/superpowers/specs/2026-06-01-extended-chord-qualities-design.md
git show 5566bde9:docs/superpowers/specs/2026-06-07-improvisation-lenses-design.md
sed -n '132,154p;288,308p' docs/design/fretboard-visual-language.md
```

- [ ] **Step 2: Write the doc**

Create `docs/design/music-theory-pedagogy.md` with this structure (mirror visual-language.md's tone, provenance tags, and honesty note):

```markdown
# Music Theory & Pedagogy — Research & Rationale Reference

**Status:** Living reference. **Durable** — lives in `docs/design/`, outside
`docs/superpowers/` so it survives the pruning of specs and plans. This document
holds the *theory* grounding (what the notes mean); rendering decisions (how they're
drawn) live in `fretboard-visual-language.md`. The two domains stay separate.

> **Sourcing honesty.** Same provenance tags as the visual-language doc:
> **[web]** verified via web search (URL given); **[spec]** asserted in a prior
> FretFlow design spec; **[convention]** standard music-theory practice; **[internal]**
> a FretFlow engineering/product principle.

## 1. Extended chord qualities
- Decisions on the nine added qualities (9ths, 11ths, 13ths, 6/9): which intervals,
  enharmonic spelling, voicing implications. Pull rationale + sources from the
  extended-chord-qualities spec. Tag each [web]/[spec]/[convention].
- Extensions vs. alterations: natural 9/11/13 are diatonic (2/4/6 up an octave,
  "available tensions"); altered tensions (b9/#9/#11/b13) are chromatic. [web]
  (learnjazzstandards; Jazz harmony — Wikipedia).

## 2. Guide-tone lines
- 3rd & 7th are the primary voice-leading tones; the 3rd is the strongest (Larsen).
  Levine, Coker, Larsen. [spec] (relocated from visual-language §3C/§7).

## 3. Improvisation lenses (Root / Guide / Common practice)
- The Root / Guide / Common-practice selector (shipped #550). What each lens
  emphasizes pedagogically and why these three. Pull from the improvisation-lenses spec.

## 4. Modal characteristic tones
- Dorian natural-6, Lydian #4, Mixolydian b7, Phrygian b2; emphasized to evoke the mode.
  [web] (Open Music Theory; Berklee; Musical-U). (Theory home; the *accent channel*
  for rendering them remains an open sub-design in visual-language.md §6.)

## 5. Annotated citation index
- Consolidate the theory/pedagogy citations (guide-tone lines, jazz harmony,
  modal characteristic notes, Hooktheory degree colors) with URLs.

## 6. Open questions / deferred
- (Migrate any un-shipped theory idea found in Task 1 Step 3 here.)

## 7. Provenance
- `2026-06-01-extended-chord-qualities-design.md` — SHA `8d7b5da6`
- `2026-06-07-improvisation-lenses-design.md` — SHA `5566bde9`
- guide-tone + modal grounding relocated from `fretboard-visual-language.md` §3C/§7/§8.
```

Replace each bullet with actual synthesized prose and real citations drawn from the
sources read in Step 1. No placeholders — if a source lacks a citation, tag it `[spec]`
or `[convention]` honestly rather than inventing a URL.

- [ ] **Step 3: Verify provenance SHAs resolve**

Run:
```bash
git show 8d7b5da6:docs/superpowers/specs/2026-06-01-extended-chord-qualities-design.md >/dev/null && echo OK1
git show 5566bde9:docs/superpowers/specs/2026-06-07-improvisation-lenses-design.md >/dev/null && echo OK2
```
Expected: `OK1` and `OK2`.

- [ ] **Step 4: Commit**

```bash
git add docs/design/music-theory-pedagogy.md
git commit -m "docs(design): add durable music-theory & pedagogy reference"
```

---

### Task 3: Write `docs/design/audio-voicing-engine.md`

**Files:**
- Create: `docs/design/audio-voicing-engine.md`
- Read: the five voicing/audio source specs (SHAs in the header table).

- [ ] **Step 1: Read the source material**

Run:
```bash
git show 83e8cdee:docs/superpowers/specs/2026-06-01-audio-voicing-engine-design.md
git show ef93f7c1:docs/superpowers/specs/2026-06-03-strum-inversion-voicing-design.md
git show 759634c3:docs/superpowers/specs/2026-06-03-full-voicing-fallback-design.md
git show ef93f7c1:docs/superpowers/specs/2026-06-03-funk-bossa-voicing-migration-design.md
git show ef93f7c1:docs/superpowers/specs/2026-06-03-expose-voicing-knobs-design.md
```

- [ ] **Step 2: Write the doc**

Create `docs/design/audio-voicing-engine.md` with this structure:

```markdown
# Audio & Voicing Engine — Research & Rationale Reference

**Status:** Living reference. **Durable** — lives in `docs/design/`, outside
`docs/superpowers/`. Holds the "why" behind FretFlow's voicing selection, strum
realization, fallback scoring, and audio playback. Cross-references
`fretboard-visual-language.md` for how voicings are *drawn* (connectors, markers).

> **Sourcing honesty.** Provenance tags: [web] / [spec] / [convention] / [internal]
> (see fretboard-visual-language.md for definitions).

## 1. Voicing selection & inversion-based strum
- Inversion-based strum voicing with color tones kept internal: decision + rationale.
  Pull from strum-inversion-voicing spec. [spec]/[convention].

## 2. Scored close-voicing fallback
- The scoring model for close voicings when no full shape fits (Scale None, power
  chords): inputs to the score, tie-breaks, string-set selection. Pull from
  full-voicing-fallback spec.

## 3. Funk / bossa voicing migration
- Why funk and bossa voicings migrated to the new engine; what changed. Pull from
  funk-bossa spec. (If superseded/partial per Task 1, note that honestly.)

## 4. Exposed voicing knobs
- Which voicing parameters are user-exposed vs. internal, and why. Pull from
  expose-voicing-knobs spec. (If un-shipped per Task 1, move forward-looking parts
  to §6.)

## 5. Audio engine principles
- GuitarSynth singleton (Web Audio) + Tone.js progression playback: the durable
  engineering principles (timing, ring-out, sustain) worth keeping. [internal].

## 6. Open questions / deferred
- (Migrate any un-shipped voicing idea found in Task 1 Step 3 here.)

## 7. Provenance
- `2026-06-01-audio-voicing-engine-design.md` — SHA `83e8cdee`
- `2026-06-03-strum-inversion-voicing-design.md` — SHA `ef93f7c1`
- `2026-06-03-full-voicing-fallback-design.md` — SHA `759634c3`
- `2026-06-03-funk-bossa-voicing-migration-design.md` — SHA `ef93f7c1`
- `2026-06-03-expose-voicing-knobs-design.md` — SHA `ef93f7c1`
```

Replace bullets with synthesized prose + real provenance from Step 1. No placeholders.

- [ ] **Step 3: Verify provenance SHAs resolve**

Run:
```bash
for pair in "83e8cdee 2026-06-01-audio-voicing-engine-design" "ef93f7c1 2026-06-03-strum-inversion-voicing-design" "759634c3 2026-06-03-full-voicing-fallback-design" "ef93f7c1 2026-06-03-funk-bossa-voicing-migration-design" "ef93f7c1 2026-06-03-expose-voicing-knobs-design"; do
  set -- $pair; git show $1:docs/superpowers/specs/$2.md >/dev/null && echo "OK $2";
done
```
Expected: five `OK ...` lines.

- [ ] **Step 4: Commit**

```bash
git add docs/design/audio-voicing-engine.md
git commit -m "docs(design): add durable audio & voicing engine reference"
```

---

### Task 4: Update `docs/design/fretboard-visual-language.md`

**Files:**
- Modify: `docs/design/fretboard-visual-language.md` (§3A, §4, §6, §10).

- [ ] **Step 1: Re-read the current doc sections to edit**

Run: `sed -n '79,120p;192,253p;341,374p' docs/design/fretboard-visual-language.md`

- [ ] **Step 2: Update §10 Provenance**

Move the four specs being deleted in this cleanup from "Present on `main`" to a
"Pruned in the 2026-06-08 docs cleanup, recovered from history" subsection, each with
its SHA:
- `2026-06-03-chord-overlay-grouping-markers-design.md` — `5ce84af8`
- `2026-06-03-chord-overlay-color-consistency-design.md` — `5ce84af8`
- `2026-06-03-fb-marker-apca-audit.md` — `c973b674`
- `2026-06-03-marker-color-followups-design.md` — `432e2651`

- [ ] **Step 3: Resolve shipped deferred items**

- §3A degree-lens entry and §4 table footnote: the scale-degree color lens was
  *removed* (#534) and replaced by the Root/Guide/Common-practice improvisation lenses
  (#550). Update these to reflect shipped reality, and point theory details to
  `music-theory-pedagogy.md` §3.
- §6: update any deferred item that shipped; leave genuinely-open items (modal
  characteristic-tone accent channel) as open.
- Add a one-line cross-reference near the top: "Theory grounding (chord qualities,
  guide tones, modes, lenses) now lives in `music-theory-pedagogy.md`; this doc keeps
  the *rendering* rationale."

- [ ] **Step 4: Verify the four SHAs resolve**

Run:
```bash
for pair in "5ce84af8 2026-06-03-chord-overlay-grouping-markers-design" "5ce84af8 2026-06-03-chord-overlay-color-consistency-design" "c973b674 2026-06-03-fb-marker-apca-audit" "432e2651 2026-06-03-marker-color-followups-design"; do
  set -- $pair; git show $1:docs/superpowers/specs/$2.md >/dev/null && echo "OK $2";
done
```
Expected: four `OK ...` lines.

- [ ] **Step 5: Commit**

```bash
git add docs/design/fretboard-visual-language.md
git commit -m "docs(design): refresh visual-language provenance + shipped deferred items"
```

---

### Task 5: Write `docs/design/README.md` index

**Files:**
- Create: `docs/design/README.md`

- [ ] **Step 1: Write the index**

Create `docs/design/README.md`:

```markdown
# Design Rationale — Durable "Why" Docs

These docs hold the **durable research and rationale** behind FretFlow's design.
They live here (not in `docs/superpowers/`) so they survive the pruning of ephemeral
specs and plans. **Read on demand** — they are not preloaded into agent context.

| Doc | Consult before changing… |
|---|---|
| [`fretboard-visual-language.md`](./fretboard-visual-language.md) | markers, color, marker shape/size/fill, connectors, voice-leading motion, contrast/tokens |
| [`audio-voicing-engine.md`](./audio-voicing-engine.md) | voicing selection, strum realization, close-voicing fallback, audio/Tone.js playback |
| [`music-theory-pedagogy.md`](./music-theory-pedagogy.md) | chord qualities/extensions, scales, guide tones, improvisation lenses, modal characteristic tones |

**Provenance model:** each doc's §Provenance lists the source specs it consolidates
with the git SHA before deletion. Recover an original with `git show <sha>:<path>`.
```

- [ ] **Step 2: Verify links resolve to real files**

Run: `ls docs/design/fretboard-visual-language.md docs/design/audio-voicing-engine.md docs/design/music-theory-pedagogy.md`
Expected: all three listed, no "No such file".

- [ ] **Step 3: Commit**

```bash
git add docs/design/README.md
git commit -m "docs(design): add durable-docs index"
```

---

### Task 6: Add the reference block to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (add a new section near the end, after "CI / Release").

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "^## " CLAUDE.md`
Expected: section list; insert the new section after the final one.

- [ ] **Step 2: Add the reference block**

Append this section to `CLAUDE.md`:

```markdown
## Design Rationale (read on demand — do not preload)

Durable "why" docs live in `docs/design/` (index: `docs/design/README.md`). They are
**not** preloaded — pull the relevant one only when making a decision in its domain:

- markers / color / marker shape / connectors / voice-leading motion → `docs/design/fretboard-visual-language.md`
- voicing / strum / close-voicing fallback / audio playback → `docs/design/audio-voicing-engine.md`
- chord qualities / scales / guide tones / improvisation lenses / modes → `docs/design/music-theory-pedagogy.md`
```

- [ ] **Step 3: Verify CLAUDE.md stays lean**

Run: `wc -l CLAUDE.md`
Expected: still comfortably under 200 lines; the block added ~8 lines, no `@`-imports present (`grep -c '@docs/' CLAUDE.md` → `0`).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: reference durable design docs from CLAUDE.md (read-on-demand)"
```

---

### Task 7: Delete all ephemeral plans, specs, and assets

Only after Tasks 2–6 are committed. Everything is recoverable via git history.

**Files:**
- Delete: `docs/superpowers/plans/*`, `docs/superpowers/specs/*` (incl. `assets/`), including this plan and the design spec `2026-06-08-docs-consolidation-cleanup-design.md`.

- [ ] **Step 1: Confirm the durable docs are committed first**

Run: `git status --porcelain docs/design/ && git log --oneline -6`
Expected: `docs/design/` clean (all committed); the last commits are the docs(design) commits from Tasks 2–6.

- [ ] **Step 2: Delete the ephemeral trees**

Run:
```bash
git rm -r docs/superpowers/plans docs/superpowers/specs
```
Expected: lists all removed `.md` files + the two asset files.

- [ ] **Step 3: Verify nothing durable was touched**

Run: `git status --porcelain && ls docs/design`
Expected: staged deletions are all under `docs/superpowers/`; `docs/design/` still lists the four `.md` files (+ README) and any migrated `assets/`.

- [ ] **Step 4: Spot-check recovery still works post-deletion-stage**

Run: `git show 5ce84af8:docs/superpowers/specs/2026-06-03-chord-overlay-color-consistency-design.md | head -5`
Expected: the original spec's first lines print (proves history recovery is intact even though the file is staged for deletion).

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(superpowers): prune shipped specs & plans (consolidated into docs/design)"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm final docs/ shape**

Run:
```bash
ls -R docs/design
find docs/superpowers -type f 2>/dev/null || echo "superpowers empty/removed"
```
Expected: `docs/design` contains `README.md`, `fretboard-visual-language.md`,
`audio-voicing-engine.md`, `music-theory-pedagogy.md` (+ migrated assets if any);
`docs/superpowers` empty or gone.

- [ ] **Step 2: Confirm no dangling references to deleted specs**

Run: `grep -rn "docs/superpowers" docs/design CLAUDE.md || echo "no stale references"`
Expected: any matches are **SHA-qualified provenance lines** (`git show <sha>:docs/superpowers/...`), not live links. No bare links to deleted files.

- [ ] **Step 3: Lint gate**

Run: `pnpm run lint`
Expected: passes.

- [ ] **Step 4: Final commit if lint produced fixes (else skip)**

```bash
git add -A && git commit -m "docs: lint fixes for consolidated design docs" || echo "nothing to commit"
```

---

## Notes for the implementer

- **Synthesis, not copy-paste.** The two new docs distill the *durable rationale* from
  their source specs — decisions, why, citations — not the task-by-task implementation
  detail. When in doubt about whether something is durable, ask: "would a future spec
  cite this, or is it scaffolding for one shipped change?" Keep the former.
- **Honesty over polish.** Tag provenance truthfully (`[spec]` if a spec asserted it
  without a URL; `[web]` only if you can cite the URL). Never invent citations.
- **Deletion is last and reversible.** Nothing is deleted until the durable docs are
  committed. Git history is the archive — the SHAs in §Provenance are the recovery keys.
