#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Rewrite release tags as annotated tags while preserving target commits.
Dry run by default. Use --execute to rewrite local, --push to force-push.

Usage:
  scripts/retag-release-annotations.sh [options]

Options:
  --execute          Rewrite local tags in place.
  --push             Force-push rewritten tags to remote. Requires --execute.
  --remote <name>    Remote name. Default: origin
  --tag <tag>        Retag specific release. Repeatable.
  --help             Show help.

Notes:
  - Only v*.*.* tags are considered.
  - Annotation body is generated from the commit message.
  - Force-pushing may retrigger workflows.
EOF
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git repository"
}

ensure_tag_exists() {
  local tag="$1"
  git rev-parse -q --verify "refs/tags/$tag" >/dev/null 2>&1 || die "tag not found: $tag"
}

ensure_semver_tag() {
  local tag="$1"
  [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "tag is not a semver release tag: $tag"
}

build_message_file() {
  local tag="$1"
  local target="$2"
  local message_file="$3"
  local commit_message

  commit_message="$(git log -1 --format=%B "$target")"

  {
    printf '%s\n' "$tag"
    if [[ -n "$commit_message" ]]; then
      printf '\n%s\n' "$commit_message"
    fi
  } > "$message_file"
}

main() {
  require_repo

  local execute=false
  local push=false
  local remote=origin
  local -a requested_tags=()
  local -a tags=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --execute)
        execute=true
        shift
        ;;
      --push)
        push=true
        shift
        ;;
      --remote)
        [[ $# -ge 2 ]] || die "--remote requires a value"
        remote="$2"
        shift 2
        ;;
      --tag)
        [[ $# -ge 2 ]] || die "--tag requires a value"
        requested_tags+=("$2")
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done

  if [[ "$push" == true && "$execute" != true ]]; then
    die "--push requires --execute"
  fi

  if [[ ${#requested_tags[@]} -gt 0 ]]; then
    tags=("${requested_tags[@]}")
  else
    while IFS= read -r tag; do
      [[ -n "$tag" ]] && tags+=("$tag")
    done < <(git tag --list 'v*.*.*' --sort=version:refname)
  fi

  [[ ${#tags[@]} -gt 0 ]] || die "no semver release tags found"

  if [[ "$push" == true ]]; then
    git remote get-url "$remote" >/dev/null 2>&1 || die "remote not found: $remote"
  fi

  printf 'Mode: %s\n' "$([[ "$execute" == true ]] && printf 'execute' || printf 'dry-run')"
  printf 'Push: %s\n' "$([[ "$push" == true ]] && printf 'yes (%s)' "$remote" || printf 'no')"
  printf 'Tags: %s\n' "${tags[*]}"

  local tag
  for tag in "${tags[@]}"; do
    ensure_semver_tag "$tag"
    ensure_tag_exists "$tag"

    local target
    local target_subject
    local message_file

    target="$(git rev-list -n 1 "$tag")"
    target_subject="$(git log -1 --format=%s "$target")"
    message_file="$(mktemp)"
    build_message_file "$tag" "$target" "$message_file"

    printf '\n== %s ==\n' "$tag"
    printf 'target: %s\n' "$target"
    printf 'subject: %s\n' "$target_subject"
    printf 'annotation preview:\n'
    sed -n '1,12p' "$message_file"

    if [[ "$execute" == true ]]; then
      git tag -a -f "$tag" "$target" -F "$message_file"
      printf 'local tag rewritten: %s\n' "$tag"

      if [[ "$push" == true ]]; then
        git push "$remote" "refs/tags/$tag" --force
        printf 'remote tag force-pushed: %s/%s\n' "$remote" "$tag"
      fi
    fi

    rm -f "$message_file"
  done

  if [[ "$execute" != true ]]; then
    printf '\nDry run only. Re-run with --execute to rewrite local tags.\n'
    printf 'Add --push after disabling the tag protection rule to update the remote.\n'
  fi
}

main "$@"
