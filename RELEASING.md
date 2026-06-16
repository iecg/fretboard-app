# Releasing FretFlow

Release mechanics — **read on demand**, when cutting a release or merging a breaking change. Not preloaded into agent context. The day-to-day workflow lives in [`AGENTS.md`](AGENTS.md); this doc holds the detail that only matters at release time.

## Trigger

Releases are triggered via GitHub Actions (**Auto Release**, `auto-release.yml`). It is a manual dispatch and computes the semver bump from Conventional Commits. **Never tag manually.**

## Breaking changes

The Auto Release workflow uses the Angular preset, which does **not** recognize the `!` shorthand (e.g. `feat!:`). To trigger a major version bump you **must** include a `BREAKING CHANGE:` footer in the commit body:

```text
feat(scope): short subject

Optional body.

BREAKING CHANGE: explanation of what breaks and how to migrate.
```

When merging a PR via squash, ensure the squash commit body (not just the title) carries the footer — GitHub does not append the PR body to the commit by default. Without the footer, breaking PRs will be released as a minor bump.

### Footer placement matters

`conventional-commits-parser` only promotes `BREAKING CHANGE:` to a breaking-change note when it lives in the **footer section** — the final paragraph block of the commit. Things that displace it out of the footer block (and silently demote the release to a minor bump):

- Markdown horizontal rules (`---`, `---------`) in the body.
- A trailing `Co-authored-by:` / `Signed-off-by:` / "Generated with Claude Code" paragraph after the `BREAKING CHANGE:` line.
- Any "token: value" paragraph that comes after `BREAKING CHANGE:`.

Keep the body plain text and put `BREAKING CHANGE:` as the last paragraph. If the squash UI appends trailers, use **Rebase and merge** instead to preserve the body verbatim. After merging, dispatch Auto Release and confirm the dry-run prints `Type: major` before the tag step runs.

When squashing, GitHub fills the squash body from the PR description by default. Confirmed failure mode: PR #463 and PR #465 both squashed with a PR description that contained markdown rules and ended with a `Co-authored-by:` paragraph, and the analyzer scored both as non-breaking. The safe path for any breaking PR is to use **Rebase and merge** so the branch commit body lands on `main` verbatim.
