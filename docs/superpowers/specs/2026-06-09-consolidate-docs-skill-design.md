# Consolidate Docs Skill — Design Spec

## Context

FretFlow accumulates ephemeral specs and plans in `docs/superpowers/specs/` and `docs/superpowers/plans/` during feature work. Durable rationale lives in `docs/design/` across three domain docs (fretboard-visual-language, audio-voicing-engine, music-theory-pedagogy). Consolidation — extracting durable content from shipped specs into design docs and deleting the specs — has been done manually twice. This spec automates the process with an AI-agent-driven skill backed by helper scripts.

## Overview

Three deliverables:

| File | Purpose |
|------|---------|
| `.claude/skills/consolidate-docs.md` | Project-local skill invoked as `/consolidate-docs` |
| `scripts/docs/inventory.sh` | Spec inventory with eligibility classification |
| `scripts/docs/domain-map.sh` | Domain matching and design doc TOC extraction |

## Flow

1. User invokes `/consolidate-docs` (dry-run) or `/consolidate-docs --apply`
2. Skill calls `inventory.sh` → structured eligibility report
3. Skill calls `domain-map.sh` for each READY spec → domain scores + design doc TOCs
4. Agent reads only READY specs (small) and targeted design doc sections (not full files)
5. Dry-run: prints consolidation plan and stops
6. Apply: presents plan, waits for confirmation, executes edits, opens PR

## Scripts

### `scripts/docs/inventory.sh`

No arguments. Scans `docs/superpowers/specs/` and `docs/superpowers/plans/` for markdown files (skips silently if either directory doesn't exist). For each file:

- Extracts the title (first `# ` heading)
- Computes age in days from the `YYYY-MM-DD-` filename prefix
- Greps for PR references (`#NNN`) and checks merge status via `gh pr view`
- Outputs pipe-delimited rows:

```
STATUS|FILE|AGE_DAYS|TITLE|PR_REFS|PR_STATUS
READY_MERGED|2026-05-20-voicing-design.md|20|Voicing Fallback|#524|merged
READY_AGE|2026-05-01-old-spec.md|39|Some Old Spec||
PENDING|2026-06-09-pwa-design.md|0|PWA and Sharing|#579|open
```

Eligibility rules:
- `READY_MERGED`: all referenced PRs are merged
- `READY_AGE`: no PR references and age > 14 days
- `PENDING`: otherwise

Fallback: if `gh` is unavailable or not authenticated, uses age-only classification and prints a warning.

### `scripts/docs/domain-map.sh`

Takes a spec filename as argument. Two outputs:

**Domain scoring** — counts keyword/citation hits per design doc:
- `fretboard-visual-language.md`: markers, color, OKLCH, polygon, SVG, connector, shape, fill, contrast
- `audio-voicing-engine.md`: voicing, strum, audio, Tone.js, playback, AudioContext, inversion
- `music-theory-pedagogy.md`: chord quality, scale, guide tone, lens, mode, interval, degree, improvisation

**TOC extraction** — `##` and `###` headings from each design doc (structure only, not content).

Output:
```
DOMAIN_SCORES|spec-file.md|visual:2|audio:7|theory:1
TOC|audio-voicing-engine.md|## 1. Voicing selection|## 2. Strum engine|...
TOC|fretboard-visual-language.md|## 1. The encoding model|...
TOC|music-theory-pedagogy.md|## 1. Chord qualities|...
```

All domain scores 0 → `NO_MATCH` flag.

Both scripts are POSIX shell with no dependencies beyond `gh`.

## Skill Instructions

### Modes
- Default (no args): dry-run — report only, no file changes
- `--apply`: creates branch, edits files, opens PR

### Dry-Run Steps
1. Run `inventory.sh`, display eligibility table
2. For each READY spec, run `domain-map.sh`
3. Read each READY spec in full
4. Produce a consolidation plan per spec:
   - **Extract**: decisions/rationale to merge → target design doc + section
   - **Discard**: implementation details, task lists, scope checks
   - **No match**: specs that don't map to existing domains → flag for user

### Apply Steps
1. Run dry-run steps 1-4
2. Present plan, wait for user confirmation
3. Create branch `docs/consolidate-YYYY-MM-DD`
4. For each extraction: read target section of design doc, draft addition, edit file
5. Update `docs/design/README.md` if a new design doc is created
6. Delete consolidated specs
7. Commit: `docs: consolidate specs into design refs`
8. Open PR with body listing what was consolidated, discarded, and why

### Guard Rails
- Never edits PENDING specs
- Never deletes a spec without consolidating or explicitly marking "no durable content"
- `NO_MATCH` specs: agent asks user — create new design doc, or discard?
- PR description includes provenance (spec filename + git SHA before deletion)
- Agent reads design doc sections only, never full files, unless section boundary is ambiguous
- Conflicting information: agent flags in PR description rather than silently overwriting

## Edge Cases

- **Multi-domain spec**: extractions split across multiple design docs
- **No durable content**: agent marks "delete only" in plan, user confirms via PR
- **New domain**: agent drafts new `docs/design/<domain>.md` with standard structure, adds to README
- **`gh` unavailable**: falls back to age-only eligibility with warning
- **No READY specs**: reports "nothing to consolidate" and exits
- **Conflicting info**: flagged in PR description, not silently overwritten

## Scope Check

This spec covers the skill file, two helper scripts, and the PR-based approval flow. No changes to existing design docs or application code. The skill is project-local (lives in the repo) and available to any contributor with the repo checked out.
