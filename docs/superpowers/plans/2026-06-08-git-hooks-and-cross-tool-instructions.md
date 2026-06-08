# Git Hooks & Cross-Tool Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the minimal shell-only git-hook strategy and canonicalize project instructions in `AGENTS.md` so every AI agent runtime honors the pre-PR discipline.

**Architecture:** Replace husky/Node-based hooks with a single plain-POSIX `.githooks/pre-commit` that only blocks `main` commits, registered via `core.hooksPath` in `postinstall`. Drop now-orphaned tooling (commitlint, stylelint). Move the canonical project guide into `AGENTS.md` and reduce `CLAUDE.md`/`GEMINI.md` to `@AGENTS.md` import stubs.

**Tech Stack:** pnpm workspace, git hooks (POSIX sh), ESLint, TypeScript, Vitest. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-06-08-git-hooks-design.md](../specs/2026-06-08-git-hooks-design.md)

**Branch:** `chore/git-hooks-and-agents-md` (already created; spec already committed here).

**Note on task style:** This is configuration/tooling work, not application logic. There is no unit-testable behavior to drive with TDD, so each task's "test" is an explicit verification command with expected output. Run the command and confirm the output before committing.

---

### Task 1: Commit the hook migration and reconcile the lockfile

The working tree already has the husky removal applied (deleted `.husky/*`, edited `package.json`, untracked `.githooks/`). The lockfile and `core.hooksPath` are still stale. This task makes the migration consistent and commits it.

**Files:**
- Modify: `package.json` (already edited in working tree — `prepare` → `postinstall`, husky/lint-staged removed)
- Create: `.githooks/pre-commit` (already present, untracked)
- Delete: `.husky/commit-msg`, `.husky/pre-commit`, `.husky/pre-push` (already deleted in working tree)
- Modify: `pnpm-lock.yaml` (reconcile)

- [ ] **Step 1: Confirm the current working-tree state**

Run: `git status --short && git config --get core.hooksPath`
Expected: shows deleted `.husky/*`, modified `package.json`, untracked `.githooks/`; `core.hooksPath` prints `.husky/_` (stale).

- [ ] **Step 2: Verify the pre-commit hook content is exactly this**

Run: `cat .githooks/pre-commit`
Expected:

```sh
#!/bin/sh
branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)
if [ "$branch" = "main" ]; then
  echo "Error: Direct commits to 'main' are not allowed. Please use a feature branch."
  exit 1
fi
```

If it differs, write that exact content. Ensure it is executable: `chmod +x .githooks/pre-commit`.

- [ ] **Step 3: Reconcile the lockfile and register the hooks path**

Run: `pnpm install`
This reconciles `pnpm-lock.yaml` with the husky/lint-staged removal and runs `postinstall`, which sets `core.hooksPath`.

- [ ] **Step 4: Verify the hooks path is now correct**

Run: `git config --get core.hooksPath`
Expected: `.githooks`

If it still prints `.husky/_`, set it explicitly: `git config core.hooksPath .githooks`

- [ ] **Step 5: Verify the pre-commit guard logic without switching branches**

Confirm you are NOT on `main` (so real commits in later tasks succeed):
Run: `git symbolic-ref --short HEAD`
Expected: `chore/git-hooks-and-agents-md`

Confirm the guard logic blocks when the branch is `main` (non-destructive simulation):
Run: `sh -c 'branch=main; if [ "$branch" = "main" ]; then echo "BLOCKED (exit 1)"; exit 1; fi'; echo "simulated-main exit: $?"`
Expected: prints `BLOCKED (exit 1)` then `simulated-main exit: 1`.

- [ ] **Step 6: Commit the hook migration**

```bash
git add -A
git commit -m "chore(hooks): replace husky with shell-only .githooks pre-commit guard

Remove husky, lint-staged, and the prepare script. Add .githooks/pre-commit
(plain POSIX sh) that blocks direct commits to main, registered via
core.hooksPath in postinstall. Reconcile the lockfile."
```

- [ ] **Step 7: Verify the commit is clean**

Run: `git status --short`
Expected: empty (no uncommitted changes).

---

### Task 2: Remove commitlint

`@commitlint/cli` and `@commitlint/config-conventional` are orphaned now that the `commit-msg` hook is gone. The `commitlint.config.js` file is also unused.

**Files:**
- Delete: `commitlint.config.js`
- Modify: `package.json` (remove `@commitlint/cli`, `@commitlint/config-conventional` from devDependencies)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Confirm commitlint is referenced nowhere except package.json + its config**

Run: `grep -rn "commitlint" . --include="*.js" --include="*.json" --include="*.sh" -l | grep -v node_modules`
Expected: only `package.json` and `commitlint.config.js`. (If `.githooks/` or any hook references it, stop — the dependency is not actually orphaned.)

- [ ] **Step 2: Remove the config file**

Run: `git rm commitlint.config.js`
Expected: `rm 'commitlint.config.js'`

- [ ] **Step 3: Remove the dependencies**

Run: `pnpm remove @commitlint/cli @commitlint/config-conventional`
Expected: pnpm reports the two packages removed and updates `package.json` + `pnpm-lock.yaml`.

- [ ] **Step 4: Verify removal**

Run: `grep -n "commitlint" package.json; echo "exit: $?"`
Expected: no matches (`exit: 1`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(deps): remove orphaned commitlint tooling

The commit-msg hook that used commitlint was removed with husky. Commit
format is enforced at PR-merge and validated by the Auto Release dry-run."
```

---

### Task 3: Drop stylelint as a lint gate

Stylelint has a low practical catch rate (browsers ignore invalid CSS). Remove it from the `lint` script and from dependencies.

**Files:**
- Modify: `package.json:23` (the `lint` script) and devDependencies (`stylelint`, `stylelint-config-recommended`)
- Delete: `.stylelintrc.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Update the `lint` script**

In `package.json`, change line 23 from:

```json
    "lint": "eslint . && stylelint 'src/**/*.css'",
```

to:

```json
    "lint": "eslint .",
```

- [ ] **Step 2: Remove the stylelint config file**

Run: `git rm .stylelintrc.json`
Expected: `rm '.stylelintrc.json'`

- [ ] **Step 3: Remove the dependencies**

Run: `pnpm remove stylelint stylelint-config-recommended`
Expected: pnpm reports both packages removed and updates `package.json` + `pnpm-lock.yaml`.

- [ ] **Step 4: Verify `lint` runs ESLint only and passes**

Run: `pnpm run lint`
Expected: ESLint runs and completes with no errors; stylelint is never invoked.

- [ ] **Step 5: Verify stylelint is fully gone**

Run: `grep -n "stylelint" package.json; echo "exit: $?"`
Expected: no matches (`exit: 1`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(lint): drop stylelint from lint gate and dependencies

Browsers silently ignore invalid CSS; the practical catch rate did not
justify the extra dependency. lint is now eslint-only."
```

---

### Task 4: Canonicalize instructions in AGENTS.md with import stubs

Move the project guide to `AGENTS.md`, apply the content edits the spec requires, and reduce `CLAUDE.md`/`GEMINI.md` to one-line `@AGENTS.md` import stubs.

**Files:**
- Rename: `CLAUDE.md` → `AGENTS.md` (preserve history with `git mv`)
- Modify: `AGENTS.md` (four content edits below)
- Create: `CLAUDE.md` (stub)
- Create: `GEMINI.md` (stub)

- [ ] **Step 1: Rename CLAUDE.md to AGENTS.md preserving history**

Run: `git mv CLAUDE.md AGENTS.md`
Expected: no output; `git status` shows a rename.

- [ ] **Step 2: Edit — fix the commands comment (stylelint reference)**

In `AGENTS.md`, change:

```
pnpm run lint                  # eslint + stylelint
```

to:

```
pnpm run lint                  # eslint
```

- [ ] **Step 3: Edit — strengthen the pre-PR discipline line**

In `AGENTS.md`, change:

```
**MANDATORY:** Run `lint`, `test`, and `build` locally before PR.
```

to:

```
**MANDATORY:** Run `lint`, `test`, and `build` locally before opening a PR. Git hooks do **not** run these checks — `.githooks/pre-commit` only blocks direct commits to `main`. CI is the real gate, but running them locally first avoids burning a CI cycle.
```

- [ ] **Step 4: Edit — add a Git hooks + instruction-files bullet to Development Workflow**

In `AGENTS.md`, find this bullet under `## Development Workflow`:

```
- **Releases:** Triggered via GitHub Actions (Auto Release). Never tag manually.
```

Immediately after it, add:

```
- **Git hooks:** `.githooks/pre-commit` (plain POSIX shell) blocks direct commits to `main`. Registered via `git config core.hooksPath .githooks` in the `postinstall` script. No husky and no Node-based tooling in hooks — they stay near-zero CPU so concurrent AI agents never thrash or stall on a hung hook.
- **Instruction files:** `AGENTS.md` is the canonical project guide. `CLAUDE.md` and `GEMINI.md` are `@AGENTS.md` import stubs so Claude Code, Gemini CLI, opencode, Codex, Copilot, and Antigravity all read the same content. Edit `AGENTS.md` only.
```

- [ ] **Step 5: Edit — fix the stylelint/lint-staged conventions bullet**

In `AGENTS.md`, change:

```
  - Stylelint wired into `pnpm run lint` and `lint-staged`. Package manager is **pnpm** (workspace defined in `pnpm-workspace.yaml`).
```

to:

```
  - Linting is **ESLint only** (`pnpm run lint` → `eslint .`); there is no stylelint or lint-staged. Package manager is **pnpm** (workspace defined in `pnpm-workspace.yaml`).
```

- [ ] **Step 6: Catch any remaining stale references**

Run: `grep -niE "husky|lint-staged|stylelint|commitlint" AGENTS.md; echo "exit: $?"`
Expected: `exit: 1` (no matches). If any match remains, reword it to reflect the new reality (no husky, no lint-staged, no stylelint, no local commitlint), then re-run until clean.

- [ ] **Step 7: Create the CLAUDE.md import stub**

Create `CLAUDE.md` with exactly this content (single line plus trailing newline):

```
@AGENTS.md
```

- [ ] **Step 8: Create the GEMINI.md import stub**

Create `GEMINI.md` with exactly this content (single line plus trailing newline):

```
@AGENTS.md
```

- [ ] **Step 9: Verify the stubs and canonical file**

Run: `cat CLAUDE.md GEMINI.md; echo "---"; head -1 AGENTS.md`
Expected: `CLAUDE.md` and `GEMINI.md` each print `@AGENTS.md`; `AGENTS.md` first line is `# FretFlow — Claude Code Guide` (or its renamed equivalent — see Step 10).

- [ ] **Step 10: Update the AGENTS.md title line**

In `AGENTS.md`, change the top heading from:

```
# FretFlow — Claude Code Guide
```

to:

```
# FretFlow — AI Agent Guide
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "docs: canonicalize project guide in AGENTS.md with import stubs

Move the project guide from CLAUDE.md to AGENTS.md so every agent runtime
(Claude Code, Gemini CLI, opencode, Codex, Copilot, Antigravity) reads it.
CLAUDE.md and GEMINI.md become @AGENTS.md import stubs. Fix stale stylelint
and lint-staged references and document the new shell-only hook model."
```

---

### Task 5: Full verification

Confirm the whole change is internally consistent and the project still builds and tests cleanly.

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: ESLint passes; stylelint not invoked.

- [ ] **Step 2: Test**

Run: `pnpm run test`
Expected: Vitest suite passes.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: `@fretflow/core` build + `tsc -b` + `vite build` all succeed.

- [ ] **Step 4: Confirm all removed tooling is gone**

Run: `grep -rniE "husky|lint-staged|commitlint|stylelint" package.json; echo "exit: $?"`
Expected: `exit: 1` (no matches).

- [ ] **Step 5: Confirm hook registration survives a clean install**

Run: `pnpm install && git config --get core.hooksPath`
Expected: `.githooks`

- [ ] **Step 6: Confirm the working tree is clean**

Run: `git status --short`
Expected: empty.

- [ ] **Step 7: Push the branch and open a PR**

```bash
git push -u origin chore/git-hooks-and-agents-md
gh pr create --fill
```

Expected: PR opens; CI runs the full suite as the universal gate.

---

## Spec coverage check

- Spec A (minimal hook, no pre-push, no Node tooling, `postinstall` registration) → Task 1.
- Spec B (remove husky/lint-staged) → Task 1; (remove commitlint) → Task 2; (drop stylelint) → Task 3.
- Spec C (`lint` = `eslint .`) → Task 3 Step 1.
- Spec D (AGENTS.md canonical, `@AGENTS.md` stubs, import-stub mechanism, three content edits) → Task 4.
- Spec verification list → Task 5.
