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
    title=$(grep -m1 '^# ' "$file" | sed 's/^# //' || true)
    title="${title:-UNTITLED}"

    # Extract date from YYYY-MM-DD- prefix
    date_prefix=$(echo "$basename_file" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "")
    if [ -n "$date_prefix" ]; then
      file_epoch=""
      file_epoch=$(date -j -f "%Y-%m-%d" "$date_prefix" +%s 2>/dev/null) \
        || file_epoch=$(date -d "$date_prefix" +%s 2>/dev/null) \
        || file_epoch=""
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
