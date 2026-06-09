---
name: consolidate-docs
description: Consolidate shipped specs into durable design docs and clean up stale documents. Dry-run by default; pass --apply to create a branch and open a PR.
---

# Consolidate Docs

Automates the extraction of durable rationale from shipped specs (`docs/superpowers/specs/`, `docs/superpowers/plans/`) into long-lived design reference docs (`docs/design/`), then deletes the spent specs.

## Mode

- **Default (no args or `--dry-run`):** Report only. Show what would be consolidated and deleted. No file changes.
- **`--apply`:** Execute the consolidation — create branch, edit design docs, delete specs, open PR.

Parse the argument from the skill invocation. If the user typed `/consolidate-docs --apply`, run in apply mode. Otherwise dry-run.

## Step 1: Inventory

Run the inventory script from the repo root:

```
./scripts/docs/inventory.sh
```

Display the output as a formatted table to the user. Group by status:
- **READY** (READY_MERGED + READY_AGE) — eligible for consolidation
- **PENDING** — not eligible, show for awareness

If there are no READY specs, report "Nothing to consolidate — all specs are still pending." and stop.

## Step 2: Domain Mapping

For each READY spec, run:

```
./scripts/docs/domain-map.sh <path-to-spec>
```

This gives you domain keyword scores and the table of contents of each design doc. Use this to determine:
- Which design doc(s) each spec maps to (highest scoring domain)
- Which section within that design doc is the right insertion point
- Whether any spec has NO_MATCH (all scores 0)

## Step 3: Read and Analyze

For each READY spec:
1. Read the full spec (these are small, typically under 5KB)
2. Using the domain scores and TOC from Step 2, identify:
   - **Durable content** — decisions, rationale, research findings, design principles, sources/citations. These belong in a design doc.
   - **Ephemeral content** — implementation steps, task lists, scope checks, edge case checklists, file structure tables. These get discarded.
   - **No durable content** — some specs are pure implementation instructions. Mark as "delete only."

For durable content, determine the target:
- Which design doc (use domain scores — highest score wins; if multi-domain, split extractions)
- Which section (use the TOC headings to find the right placement)
- Read ONLY the target section(s) of the design doc — not the full file. Use the line numbers from `grep -n` to read the specific section.

## Step 4: Consolidation Plan

Present a consolidation plan to the user:

```
## Consolidation Plan

### spec-name.md → audio-voicing-engine.md
**Extract:**
- Decision about X → §2.3 String-set selection
- Rationale for Y → §4.1 Structural variation

**Discard:**
- Implementation steps (task list)
- File structure table
- Scope check section

### another-spec.md → DELETE ONLY
No durable content found. Pure implementation spec.

### no-match-spec.md → NEEDS INPUT
Domain scores: visual:0 audio:0 theory:0
Options: (1) Create new design doc, (2) Discard
```

**In dry-run mode:** Print the plan and stop. Say: "Run `/consolidate-docs --apply` to execute this plan."

**In apply mode:** Present the plan and ask: "Proceed with this consolidation? (yes/no)" Wait for confirmation before making any changes.

## Step 5: Execute (apply mode only)

After user confirms:

1. **Create branch:**
   ```
   git checkout -b docs/consolidate-YYYY-MM-DD
   ```
   Use today's date.

2. **For each extraction:**
   - Read the target section of the design doc
   - Draft the addition, matching the existing style (decision statement, rationale, sources with provenance tags)
   - Use the Edit tool to insert the new content at the right location within the section
   - If a spec maps to multiple domains, make separate edits to each design doc

3. **For NO_MATCH specs (if user chose "create new design doc"):**
   - Create `docs/design/<domain-name>.md` following the structure of existing design docs:
     - Status/Purpose header
     - Numbered sections for decisions
     - Provenance section at the end
   - Add entry to `docs/design/README.md` table

4. **Delete consolidated specs:**
   - Record the current git SHA before deletion (for provenance): `git rev-parse HEAD`
   - Delete each READY spec file
   - Add provenance entries to the relevant design doc's Provenance section:
     `Consolidated from docs/superpowers/specs/<filename> (SHA: <sha>)`

5. **Commit:**
   ```
   git add -A docs/
   git commit -m "docs: consolidate specs into design refs"
   ```

6. **Open PR:**
   ```
   gh pr create --title "docs: consolidate specs into design refs" --body "<body>"
   ```
   PR body structure:
   ```
   ## Consolidation Summary

   ### Extracted (durable rationale merged into design docs)
   - `spec-name.md` → `audio-voicing-engine.md` §2.3, §4.1
   - `other-spec.md` → `fretboard-visual-language.md` §3.A

   ### Deleted (no durable content)
   - `impl-spec.md` — pure implementation, no rationale to preserve

   ### Provenance
   All deleted specs are recoverable via `git show <sha>:<path>`.
   SHA before deletion: `<sha>`
   ```

## Guard Rails

Follow these strictly:
- **Never edit PENDING specs.** Only READY_MERGED and READY_AGE specs are eligible.
- **Never delete without consolidating.** Every spec must either have its durable content extracted OR be explicitly marked "no durable content" in the plan.
- **NO_MATCH specs require user input.** Ask: create a new design doc, or discard? Do not decide autonomously.
- **Provenance is mandatory.** Every deletion must record the spec filename and git SHA in the design doc's Provenance section and in the PR description.
- **Conflicts get flagged, not resolved.** If extracted content contradicts something already in a design doc, flag it in the PR description. Do not silently overwrite.
- **Minimize token usage.** Use the domain-map script output to target reads. Read design doc sections, not full files. The scripts exist to keep agent token consumption low — use them.
