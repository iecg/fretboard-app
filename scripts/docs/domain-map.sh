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
