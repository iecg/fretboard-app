# Git Hooks & Cross-Tool Instructions Design

> **Status:** Approved for implementation

**Goal:** Lightweight, shell-only git hooks that catch the one failure worth catching (direct commits to `main`) without CPU starvation under multiple concurrent AI agents — paired with a cross-tool instruction-file layout so the project's pre-PR discipline is honored by every agent runtime, not just Claude Code.

## Context: a primarily AI-driven repo

This repo is developed primarily by AI coding agents, often several concurrently (separate worktrees). Two properties of that environment drive every decision below:

1. **An agent is present and iterating.** Unlike a human who pushes and walks away, an agent stays in the loop. It does not need a hook to catch what CI will surface anyway — it will read the CI failure and fix it.
2. **A hung hook is the worst failure mode.** A human sees a stalled `git push` and hits Ctrl-C. An autonomous agent may simply wait on a hung `tsc`/`eslint`. Node-based tooling in hooks reintroduces exactly the zombie/stall risk we are trying to avoid, multiplied by concurrent agents thrashing the CPU.

The two enforcement layers that are **tool-agnostic** — they apply no matter which agent runtime pushed — are:

- **CI** — fires on every push regardless of tool. This is the real gate.
- **git hooks** — every tool runs `git push`; none can skip a pre-push hook (barring `--no-verify`).

Documented discipline (instruction files) is **not** universally honored — see "Cross-tool instruction files" below.

## Decision summary

| Decision | Outcome |
|----------|---------|
| Hook strategy | Minimal guard only — block `main` commits; no Node tooling in any hook |
| Pre-push hook | None |
| `husky` + `lint-staged` | Removed (deps + config + hooks) |
| `@commitlint/*` deps | Removed (orphaned once `commit-msg` hook was deleted) |
| `stylelint` | Dropped as a lint gate and as a devDependency |
| `lint` script | `eslint .` |
| Canonical instruction file | `AGENTS.md` |
| `CLAUDE.md` / `GEMINI.md` | `@AGENTS.md` import stubs (Windows-safe, single source of truth) |

## A. Git hooks: minimal guard

### Rationale

Pre-push hooks running `tsc`/`eslint`/`vitest` were considered and rejected for this repo:

- **Redundant with mandated discipline.** Running `pnpm run build` before a PR is already required, and `build` is `tsc -b && vite build`. A disciplined agent already ran `tsc`. The hook only fires when the agent skipped a step it was told to run — and a blocking/hanging hook is a poor way to compensate for that.
- **Hang/thrash risk is worst for autonomous agents** (see Context).
- **Concurrent worktrees defeat the incremental advantage.** `tsc -b` relies on `.tsbuildinfo`; N agents building concurrently in N worktrees either pay full cost (no incremental win) or contend on cache state (false failures).
- **CI is already the universal gate** — observable and recoverable, unlike a stalled push.

### Specification

- **`.githooks/pre-commit`** — plain POSIX shell. Single responsibility: block direct commits to `main`. No Node tooling.

  ```sh
  #!/bin/sh
  branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)
  if [ "$branch" = "main" ]; then
    echo "Error: Direct commits to 'main' are not allowed. Please use a feature branch."
    exit 1
  fi
  ```

- **No pre-push hook.** No `commit-msg` hook.
- **`postinstall`** registers the hooks directory:

  ```json
  "postinstall": "git config core.hooksPath .githooks 2>/dev/null; pnpm --filter @fretflow/core run build"
  ```

  (Renamed from `prepare`, which previously installed husky.)

### Constraints

- **No Node.js dependencies in hooks** — plain POSIX shell only. No husky, commitlint, lint-staged, or `node_modules` resolution.
- **Near-zero CPU** — hooks complete in well under a second and leave no background processes.

## B. Dependency & script cleanup

Remove from `package.json`:

- `husky`, `lint-staged` devDependencies (already removed) and the `lint-staged` config block (already removed).
- `@commitlint/cli`, `@commitlint/config-conventional` devDependencies — orphaned once the `commit-msg` hook was deleted. Conventional Commit format is enforced at PR-merge time and validated by the Auto Release dry-run, not locally.
- `stylelint` devDependency. Practical catch rate is low (browsers silently ignore invalid CSS), and the value does not justify carrying it as a lint gate.

Update scripts:

- `"lint": "eslint ."` — drop the `&& stylelint 'src/**/*.css'` half.

## C. Cross-tool instruction files

### Problem

`CLAUDE.md` is Claude Code's native format and is **not** a cross-tool standard. In a multi-agent repo, three of the four other common runtimes never read it:

| Tool | Reads `CLAUDE.md`? | Canonical file |
|------|--------------------|----------------|
| Claude Code | yes (native) | `CLAUDE.md` |
| opencode | only as a *fallback* when no `AGENTS.md` exists; if both exist, `AGENTS.md` wins and `CLAUDE.md` is ignored | `AGENTS.md` |
| Codex | no | `AGENTS.md` |
| Copilot | no | `AGENTS.md` / `.github/copilot-instructions.md` |
| Antigravity | no | `GEMINI.md` + `AGENTS.md` |

The trap: adding an `AGENTS.md` causes opencode to *stop* reading `CLAUDE.md`. A split brain (rules in `CLAUDE.md`, a separate `AGENTS.md`) silently drops the `CLAUDE.md` content for opencode as well. Because the minimal-hook strategy in Section A leans on documented pre-PR discipline as the safety net, that discipline must live where every runtime reads it.

### Specification

- **`AGENTS.md` is the canonical instruction file.** Move the current `CLAUDE.md` content into it (the content is tool-agnostic project documentation), then apply the three edits in "Content edits during the port" below.
- **`CLAUDE.md` and `GEMINI.md` become import stubs**, each a single line:

  ```
  @AGENTS.md
  ```

  Claude Code and Gemini CLI both inline `@import` references, so each tool sees the full content through a real (non-symlink) file. opencode, Codex, and Copilot read `AGENTS.md` directly. Antigravity reads both `GEMINI.md` and `AGENTS.md`.

- **Mechanism choice — import stubs over symlinks.** Git stores symlinks natively and they survive clone on macOS/Linux, but a Windows checkout with `core.symlinks=false` materializes the stub as a plain text file literally containing `AGENTS.md` — broken. Import stubs are real files with no OS-dependent behavior, so they are Windows-safe at zero extra cost.

### Content edits during the port

When moving content into `AGENTS.md`:

1. **Fix the stale `lint-staged` reference** (current `CLAUDE.md:105`): "Stylelint wired into `pnpm run lint` and `lint-staged`." — `lint-staged` is gone and stylelint is dropped. Remove the line / update the CSS conventions bullet accordingly.
2. **Strengthen the pre-PR discipline line** (current `CLAUDE.md:21`): "MANDATORY: Run `lint`, `test`, and `build` locally before PR." This is now the load-bearing safety net (no husky enforces it). Make explicit that hooks no longer run these checks, so the agent must.
3. **Add a "Git hooks" note**: `.githooks/pre-commit` guards `main`, registered via `core.hooksPath` in `postinstall`; no husky and no Node tooling in hooks; CI is the real gate.

## Out of scope

- Re-introducing any Node-based pre-push validation.
- `.github/copilot-instructions.md` (Copilot reads `AGENTS.md`; add later only if a Copilot-specific override is needed).
- Restructuring the instruction content itself beyond the three edits above.

## Verification

- `pnpm install` runs `postinstall` and `git config --get core.hooksPath` returns `.githooks`.
- A commit attempt on `main` is rejected by `.githooks/pre-commit`; a commit on a feature branch succeeds.
- `pnpm run lint` runs `eslint .` and does not invoke stylelint.
- `pnpm run build` and `pnpm run test` pass.
- `grep -r husky\|lint-staged\|commitlint\|stylelint package.json` returns nothing.
- Opening `CLAUDE.md` shows a single `@AGENTS.md` line; `AGENTS.md` contains the full project guide with the three content edits applied.
