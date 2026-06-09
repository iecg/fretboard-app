# Consolidate Docs Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/consolidate-docs` slash command backed by two helper scripts that automates the process of extracting durable rationale from shipped specs into `docs/design/` and cleaning up stale documents.

**Architecture:** Two POSIX shell scripts handle the mechanical work (inventory + domain mapping) and a project-local `.claude/skills/` markdown file provides agent instructions. The skill calls the scripts, reads their structured output, and uses it to minimize how much of the large design docs it needs to read.

**Tech Stack:** POSIX shell, `gh` CLI (optional, graceful fallback), Claude Code project-local skills

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/docs/inventory.sh` | Scans `docs/superpowers/specs/` and `docs/superpowers/plans/` for markdown files. Classifies each as READY_MERGED, READY_AGE, or PENDING. Outputs pipe-delimited rows. |
| `scripts/docs/domain-map.sh` | Takes a spec path. Counts keyword hits against each design doc domain. Extracts `##`/`###` headings from design docs as TOC. Outputs structured scores + TOC. |
| `.claude/skills/consolidate-docs.md` | Skill instructions for the agent: how to call scripts, interpret output, plan consolidation, and execute in dry-run or apply mode. |

---

### Task 1: Create `scripts/docs/inventory.sh`

**Files:**
- Create: `scripts/docs/inventory.sh`

- [ ] **Step 1: Create the script with header output**

```bash
#!/bin/sh
set -eu

# Scans docs/superpowers/specs/ and docs/superpowers/plans/ for markdown files.
# Classifies each by eligibility for consolidation.
# Output: pipe-delimited rows (STATUS|FILE|AGE_DAYS|TITLE|PR_REFS|PR_STATUS)

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
SPEC_DIRS="docs/superpowers/specs docs/superpowers/plans"
AGE_THRESHOLD=14

# Check gh availability
GH_AVAILABLE=true
if ! command -v gh >/dev/null 2>&1; then
  GH_AVAILABLE=false
  echo "WARNING: gh CLI not found — using age-only eligibility" >&2
elif ! gh auth status >/dev/null 2>&1; then
  GH_AVAILABLE=false
  echo "WARNING: gh not authenticated — using age-only eligibility" >&2
fi

today_epoch=$(date +%s)

echo "STATUS|FILE|AGE_DAYS|TITLE|PR_REFS|PR_STATUS"

for dir in $SPEC_DIRS; do
  target="$REPO_ROOT/$dir"
  [ -d "$target" ] || continue

  for file in "$target"/*.md; do
    [ -f "$file" ] || continue

    basename_file=$(basename "$file")

    # Extract title (first # heading)
    title=$(grep -m1 '^# ' "$file" | sed 's/^# //')

    # Extract date from YYYY-MM-DD- prefix
    date_prefix=$(echo "$basename_file" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "")
    if [ -n "$date_prefix" ]; then
      file_epoch=$(date -j -f "%Y-%m-%d" "$date_prefix" +%s 2>/dev/null \
        || date -d "$date_prefix" +%s 2>/dev/null \
        || echo "")
      if [ -n "$file_epoch" ]; then
        age_days=$(( (today_epoch - file_epoch) / 86400 ))
      else
        age_days=0
      fi
    else
      age_days=0
    fi

    # Extract PR references (#NNN)
    pr_refs=$(grep -oE '#[0-9]+' "$file" | sort -u | tr '\n' ',' | sed 's/,$//')

    # Determine PR merge status
    pr_status=""
    all_merged=true
    any_pr=false
    if [ -n "$pr_refs" ] && [ "$GH_AVAILABLE" = true ]; then
      IFS=',' read -r dummy <<EOF
$pr_refs
EOF
      for ref in $(echo "$pr_refs" | tr ',' ' '); do
        any_pr=true
        pr_num=$(echo "$ref" | tr -d '#')
        state=$(gh pr view "$pr_num" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
        if [ "$state" != "MERGED" ]; then
          all_merged=false
        fi
        if [ -n "$pr_status" ]; then
          pr_status="$pr_status,$state"
        else
          pr_status="$state"
        fi
      done
    elif [ -n "$pr_refs" ]; then
      # gh unavailable — can't determine merge status
      any_pr=true
      all_merged=false
      pr_status="UNKNOWN"
    fi

    # Classify
    if [ "$any_pr" = true ] && [ "$all_merged" = true ]; then
      status="READY_MERGED"
    elif [ "$any_pr" = false ] && [ "$age_days" -gt "$AGE_THRESHOLD" ]; then
      status="READY_AGE"
    else
      status="PENDING"
    fi

    echo "${status}|${basename_file}|${age_days}|${title}|${pr_refs}|${pr_status}"
  done
done
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/docs/inventory.sh`

- [ ] **Step 3: Run inventory.sh and verify output**

Run: `./scripts/docs/inventory.sh`

Expected output (format — exact values depend on current specs):
```
STATUS|FILE|AGE_DAYS|TITLE|PR_REFS|PR_STATUS
PENDING|2026-06-09-consolidate-docs-skill-design.md|0|Consolidate Docs Skill — Design Spec||
PENDING|2026-06-09-pwa-and-sharing-design.md|0|FretFlow: PWA and URL Sharing Design Spec|#579|...
```

Both specs are new (0 days) so they should be PENDING. Verify the pipe-delimited format is correct and parseable.

- [ ] **Step 4: Commit**

```bash
git add scripts/docs/inventory.sh
git commit -m "feat(scripts): add docs inventory script for consolidation eligibility"
```

---

### Task 2: Create `scripts/docs/domain-map.sh`

**Files:**
- Create: `scripts/docs/domain-map.sh`

- [ ] **Step 1: Create the script**

```bash
#!/bin/sh
set -eu

# Takes a spec file path. Outputs:
# 1. Domain scores — keyword hit counts against each design doc domain
# 2. TOC — ## and ### headings from each design doc

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
DESIGN_DIR="$REPO_ROOT/docs/design"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <spec-file-path>" >&2
  exit 1
fi

spec_file="$1"
if [ ! -f "$spec_file" ]; then
  echo "ERROR: file not found: $spec_file" >&2
  exit 1
fi

basename_file=$(basename "$spec_file")
spec_content=$(cat "$spec_file")

# Domain keyword lists (case-insensitive matching)
visual_keywords="marker|color|OKLCH|polygon|SVG|connector|shape|fill|contrast|fretboard-visual-language"
audio_keywords="voicing|strum|audio|Tone\.js|playback|AudioContext|inversion|audio-voicing-engine"
theory_keywords="chord.quality|scale|guide.tone|lens|mode|interval|degree|improvisation|music-theory-pedagogy"

# Count keyword hits (case-insensitive)
visual_score=$(echo "$spec_content" | grep -ioE "$visual_keywords" | wc -l | tr -d ' ')
audio_score=$(echo "$spec_content" | grep -ioE "$audio_keywords" | wc -l | tr -d ' ')
theory_score=$(echo "$spec_content" | grep -ioE "$theory_keywords" | wc -l | tr -d ' ')

# Determine if NO_MATCH
total=$((visual_score + audio_score + theory_score))
if [ "$total" -eq 0 ]; then
  echo "DOMAIN_SCORES|${basename_file}|visual:${visual_score}|audio:${audio_score}|theory:${theory_score}|NO_MATCH"
else
  echo "DOMAIN_SCORES|${basename_file}|visual:${visual_score}|audio:${audio_score}|theory:${theory_score}"
fi

# TOC extraction from each design doc
for doc in "$DESIGN_DIR"/*.md; do
  [ -f "$doc" ] || continue
  doc_basename=$(basename "$doc")
  # Skip README
  [ "$doc_basename" = "README.md" ] && continue

  headings=$(grep -E '^#{2,3} ' "$doc" | tr '\n' '|' | sed 's/|$//')
  echo "TOC|${doc_basename}|${headings}"
done
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/docs/domain-map.sh`

- [ ] **Step 3: Run domain-map.sh against the PWA spec and verify output**

Run: `./scripts/docs/domain-map.sh docs/superpowers/specs/2026-06-09-pwa-and-sharing-design.md`

Expected: Domain scores line showing keyword hits (audio should have some hits for AudioContext/playback, theory should have some for scale, visual likely near 0). Three TOC lines for the three design docs. Verify pipe-delimited format.

- [ ] **Step 4: Run domain-map.sh against the consolidation spec itself**

Run: `./scripts/docs/domain-map.sh docs/superpowers/specs/2026-06-09-consolidate-docs-skill-design.md`

Expected: Keyword hits from the keyword lists themselves being present in the spec (since the spec literally lists them). This is a useful sanity check that the grep patterns work.

- [ ] **Step 5: Commit**

```bash
git add scripts/docs/domain-map.sh
git commit -m "feat(scripts): add docs domain-map script for consolidation targeting"
```

---

### Task 3: Create `.claude/skills/consolidate-docs.md`

**Files:**
- Create: `.claude/skills/consolidate-docs.md`

- [ ] **Step 1: Create the skills directory if needed**

Run: `mkdir -p .claude/skills`

- [ ] **Step 2: Write the skill file**

```markdown
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
```

- [ ] **Step 3: Verify the skill file is well-formed**

Run: `head -5 .claude/skills/consolidate-docs.md`

Expected: the YAML frontmatter with `name: consolidate-docs` and `description:`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/consolidate-docs.md
git commit -m "feat(skills): add consolidate-docs project-local skill"
```

---

### Task 4: End-to-End Dry-Run Verification

**Files:** None modified — this is a manual verification task.

- [ ] **Step 1: Run both scripts standalone to verify they work together**

Run:
```bash
./scripts/docs/inventory.sh
```
Then for each READY spec (if any — current specs may all be PENDING):
```bash
./scripts/docs/domain-map.sh docs/superpowers/specs/<spec-file>.md
```

Verify: output is well-formed pipe-delimited text, no shell errors, TOC headings match actual design doc structure.

- [ ] **Step 2: Invoke the skill in dry-run mode**

Run: `/consolidate-docs`

Verify:
- The agent calls `inventory.sh` and displays the table
- PENDING specs are listed but not processed
- If any READY specs exist, the agent produces a consolidation plan
- If no READY specs, the agent reports "Nothing to consolidate"

- [ ] **Step 3: Commit the plan file**

```bash
git add docs/superpowers/plans/2026-06-09-consolidate-docs-skill.md
git commit -m "docs(plans): add consolidate-docs skill implementation plan"
```
