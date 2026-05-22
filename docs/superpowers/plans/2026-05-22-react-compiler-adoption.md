# React Compiler Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the React Compiler to auto-memoize FretFlow components, reduce manual `useMemo`/`useCallback`/`React.memo` boilerplate, and tighten render performance — especially on the fretboard render path.

**Architecture:** Add `babel-plugin-react-compiler` via `@vitejs/plugin-react`'s `babel.plugins` option. Enable the matching ESLint rule (already shipped inside `eslint-plugin-react-hooks@7`) so Rules-of-React violations surface at lint time. Roll out in two stages: first in **`compilationMode: "annotation"`** (only files with `"use memo"` get compiled) so we can vet a few hot components without flipping the whole app; then switch to **`compilationMode: "infer"`** (compile everything that passes the rules) once lint is clean. Vitest uses Vite's plugin pipeline, so unit tests automatically run the compiled output — no separate test config.

**Tech Stack:** React 19.2, Vite 8, `@vitejs/plugin-react` 6, `eslint-plugin-react-hooks` 7, Vitest 4, Playwright (e2e + visual). Adds: `babel-plugin-react-compiler` (runtime dep is shipped inside React 19, no separate runtime package needed for React 19).

**Rollout strategy (high-level):**

1. **Tasks 1–2:** Install plugin + wire into Vite in annotation mode. Verify build, tests, dev server unchanged.
2. **Task 3:** Enable ESLint rule (`react-hooks/react-compiler`) at `warn` to surface violations without breaking CI.
3. **Task 4:** Triage and fix lint warnings (or document with `"use no memo"` escape hatches if a fix is risky).
4. **Tasks 5–6:** Opt-in two hot components (`FretboardSVG`, `Fretboard`) with `"use memo"` directives, verify visual + unit tests still pass.
5. **Task 7:** Flip `compilationMode` to `"infer"` (compile the whole app), with `sources` filter limiting it to `src/` and `packages/core/src/` (excluding test files).
6. **Task 8:** Promote ESLint rule to `error`.
7. **Task 9:** Bundle-size + visual regression check, then docs update.

Each task is independently committable and produces a working app.

---

## File Structure

**Modified:**
- `package.json` — add `babel-plugin-react-compiler` devDependency.
- `vite.config.ts` — wire compiler into `@vitejs/plugin-react`'s `babel.plugins`.
- `eslint.config.js` — enable `react-hooks/react-compiler` rule (level changes across tasks).
- `CLAUDE.md` — short section documenting compiler conventions (`"use memo"` opt-in scope during Tasks 5–6, `"use no memo"` escape hatch).
- Component files surfaced by lint that need `"use no memo"` annotations (unknown until Task 4 runs; the plan handles them generically).
- Two hot components for opt-in trial: `src/components/FretboardSVG/FretboardSVG.tsx`, `src/components/Fretboard/Fretboard.tsx`.

**Created:**
- None. No new source files needed.

**Not touched:**
- Test files (`*.test.tsx`, `*.test.ts`). The compiler skips them implicitly because we restrict `sources`.
- `packages/core/src/` (no React there — pure TS).

---

## Pre-flight assumptions

- React is `^19.2.5` (confirmed in `package.json`). The compiler's runtime is bundled in React 19, so no `react-compiler-runtime` package is needed.
- `eslint-plugin-react-hooks@7.1.1` is installed. The compiler lint rule (`react-hooks/react-compiler`) ships inside it and is **off by default**. We turn it on in Task 3.
- `@vitejs/plugin-react@6` accepts a `babel.plugins` option that prepends Babel plugins to the React pipeline.
- Build command is `pnpm run build`; tests run via `pnpm run test`; visual regression via `pnpm run test:visual`.

---

### Task 1: Install the compiler

**Files:**
- Modify: `package.json` (devDependencies)
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: Install babel-plugin-react-compiler**

Run:
```bash
pnpm add -D babel-plugin-react-compiler
```

Expected: pnpm adds the package under `devDependencies`. No peer warnings about React (React 19 is supported).

- [ ] **Step 2: Verify install**

Run:
```bash
pnpm list babel-plugin-react-compiler
```

Expected: prints a version (e.g. `babel-plugin-react-compiler 19.x.x` or `1.x.x` depending on release stream). Fail the task if it shows `(missing)`.

- [ ] **Step 3: Sanity build (no config change yet)**

Run:
```bash
pnpm run build
```

Expected: existing build succeeds. The plugin is installed but not yet active.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add babel-plugin-react-compiler

Adds the React Compiler Babel plugin as a devDependency in
preparation for adoption. Not yet wired into the Vite build."
```

---

### Task 2: Wire compiler into Vite in annotation mode

**Files:**
- Modify: `vite.config.ts:8-10` (the `plugins` array — currently `plugins: [react()]`)

- [ ] **Step 1: Edit `vite.config.ts` to pass the compiler to `@vitejs/plugin-react`**

Replace the existing `plugins: [react()],` line with:

```ts
plugins: [
  react({
    babel: {
      plugins: [
        ['babel-plugin-react-compiler', {
          // Annotation mode: only files with a top-level "use memo" string
          // directive get compiled. Lets us trial the compiler on a few hot
          // components before flipping the whole app to "infer" mode.
          compilationMode: 'annotation',
          // Restrict to app + workspace core. Excludes node_modules and tests.
          sources: (filename) =>
            (filename.includes('/src/') || filename.includes('/packages/core/src/')) &&
            !filename.includes('.test.') &&
            !filename.includes('.spec.'),
        }],
      ],
    },
  }),
],
```

- [ ] **Step 2: Build with the compiler installed but no opt-in files**

Run:
```bash
pnpm run build
```

Expected: build succeeds. Since no file uses `"use memo"` yet, the compiler runs in dry mode and emits no transformations — bundle should be byte-comparable (modulo any whitespace differences from the Babel pass).

- [ ] **Step 3: Run unit tests**

Run:
```bash
pnpm run test
```

Expected: all tests pass. Vitest uses Vite's plugin pipeline, so the Babel pass runs in tests too — this confirms the plugin loads cleanly under jsdom.

- [ ] **Step 4: Start dev server, smoke-check it boots**

Run:
```bash
pnpm run dev &
DEV_PID=$!
sleep 5
curl -sf http://localhost:5173/fretboard-app/ > /dev/null && echo "OK"
kill $DEV_PID
```

Expected: prints `OK`. If `curl` fails, inspect dev server logs.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "build(vite): wire react-compiler in annotation mode

Adds babel-plugin-react-compiler to @vitejs/plugin-react with
compilationMode: 'annotation'. Only files with a top-level 'use memo'
directive are compiled. Restricted to src/ and packages/core/src/,
excluding test files."
```

---

### Task 3: Enable ESLint rule at warn level

**Files:**
- Modify: `eslint.config.js` (the first `files: ['**/*.{ts,tsx}']` block — add `rules` after `languageOptions`)

- [ ] **Step 1: Add the compiler rule at `warn`**

Edit `eslint.config.js`. In the first config object (the one with `extends: [...reactHooks.configs.flat.recommended...]`), add a `rules` field after `languageOptions`:

```js
{
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    // React Compiler bails on code that violates the Rules of React.
    // Surfaced at 'warn' during rollout so CI doesn't break; promoted
    // to 'error' once the codebase is clean (see plan Task 8).
    'react-hooks/react-compiler': 'warn',
  },
},
```

- [ ] **Step 2: Run lint and capture warnings**

Run:
```bash
pnpm run lint 2>&1 | tee /tmp/react-compiler-lint.txt
```

Expected: lint exits 0 (warnings don't fail). The file `/tmp/react-compiler-lint.txt` now lists every place the compiler would bail.

- [ ] **Step 3: Eyeball the report**

Run:
```bash
grep -c "react-compiler" /tmp/react-compiler-lint.txt || echo "0 warnings"
```

Expected: a count printed (could be 0 if the codebase is already clean). Record the number — Task 4 acts on it.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): enable react-hooks/react-compiler at warn

Surfaces Rules-of-React violations the compiler would bail on,
without breaking CI. Will be promoted to error after triage."
```

---

### Task 4: Triage and fix compiler lint warnings

**Files:**
- Varies. The list comes from `/tmp/react-compiler-lint.txt` produced in Task 3.

> If Task 3 reported `0 warnings`, this entire task is a no-op — skip to Task 5 and commit nothing.

For each warning, classify it:

- **Class A — trivial fix (preferred):** mutating a prop or state in render, conditional hooks, ref accessed during render. Fix the code.
- **Class B — intentional pattern we want to keep:** e.g. a component that legitimately needs to bail out of compilation. Add `'use no memo';` as the first statement of the function body.
- **Class C — risky to touch right now:** add `'use no memo';` with an inline comment `// TODO(react-compiler): <reason>` and open a follow-up issue.

- [ ] **Step 1: Iterate over the warning list**

For each warning in `/tmp/react-compiler-lint.txt`:

```bash
# Open the file at the reported line
$EDITOR <file>:<line>
```

Decide A / B / C and apply.

**Example Class A fix (mutation in render):**

Before:
```tsx
function Widget({ items }: { items: Item[] }) {
  items.sort((a, b) => a.order - b.order) // mutates prop — compiler bails
  return <ul>{items.map(i => <li key={i.id}>{i.label}</li>)}</ul>
}
```

After:
```tsx
function Widget({ items }: { items: Item[] }) {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  return <ul>{sorted.map(i => <li key={i.id}>{i.label}</li>)}</ul>
}
```

**Example Class B/C escape hatch:**

```tsx
function LegacyThing() {
  'use no memo' // intentional: relies on identity-sensitive ref pattern
  // ...
}
```

- [ ] **Step 2: Re-run lint until warnings are 0**

Run:
```bash
pnpm run lint
```

Expected: zero `react-hooks/react-compiler` warnings.

- [ ] **Step 3: Run unit tests**

Run:
```bash
pnpm run test
```

Expected: all pass. Any Class A fix should be behavior-preserving; tests confirm.

- [ ] **Step 4: Commit (one commit per logical group)**

```bash
git add <files>
git commit -m "refactor: resolve react-compiler rule violations

Fixes Rules-of-React violations surfaced by the compiler lint rule.
Files with intentional opt-outs use a 'use no memo' directive."
```

If you made multiple unrelated fixes, split into multiple commits — keep each one reviewable.

---

### Task 5: Opt-in `FretboardSVG` to compilation

**Files:**
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx` (top of file, inside the component function — or at module top if you want the whole module compiled)
- Test: `src/components/FretboardSVG/FretboardSVG.test.tsx` (existing)

> The `FretboardSVG` component is the largest hot spot — directly subscribed to many atoms and re-renders on every fretboard state change. Compiling it is the highest-value trial.

- [ ] **Step 1: Add `"use memo"` directive at the top of the file**

Edit `src/components/FretboardSVG/FretboardSVG.tsx`. Make the very first line of the file (above all imports) be:

```ts
'use memo'
```

A file-level directive opts every component and hook in the module into compilation.

- [ ] **Step 2: Build to confirm the compiler accepts the file**

Run:
```bash
pnpm run build 2>&1 | tee /tmp/svg-build.txt
```

Expected: build succeeds. If the compiler logs a bailout for this file (e.g. `[react-compiler] Skipped: ...`), open the bailout, fix the underlying Rules-of-React issue (per Task 4 patterns), and re-run.

- [ ] **Step 3: Run the existing FretboardSVG unit tests**

Run:
```bash
pnpm run test -- src/components/FretboardSVG/
```

Expected: all tests pass — output should be identical to pre-compilation (the compiler only affects when re-renders happen, not what they produce).

- [ ] **Step 4: Run the fretboard-svg visual regression suite**

Run:
```bash
pnpm run test:visual -- e2e/fretboard-svg
```

Expected: zero snapshot diffs. Compilation must not change rendered output.

- [ ] **Step 5: Commit**

```bash
git add src/components/FretboardSVG/FretboardSVG.tsx
git commit -m "perf(fretboard): opt FretboardSVG into react-compiler

Adds a top-of-file 'use memo' directive so the compiler auto-memoizes
the largest hot-path component on the fretboard render path. Visual
regression suite and unit tests confirm output is unchanged."
```

---

### Task 6: Opt-in `Fretboard` wrapper to compilation

**Files:**
- Modify: `src/components/Fretboard/Fretboard.tsx` (top of file)
- Test: existing component + visual tests

- [ ] **Step 1: Add the directive**

First line of `src/components/Fretboard/Fretboard.tsx`:

```ts
'use memo'
```

- [ ] **Step 2: Build**

Run:
```bash
pnpm run build
```

Expected: success, no bailouts on this file.

- [ ] **Step 3: Tests**

Run:
```bash
pnpm run test -- src/components/Fretboard/
pnpm run test:visual -- e2e/fretboard-svg e2e/app-components
```

Expected: all green, no visual diffs.

- [ ] **Step 4: Commit**

```bash
git add src/components/Fretboard/Fretboard.tsx
git commit -m "perf(fretboard): opt Fretboard wrapper into react-compiler"
```

---

### Task 7: Switch to `infer` mode (compile everything)

**Files:**
- Modify: `vite.config.ts` (the `compilationMode` option set in Task 2)
- Modify: `src/components/FretboardSVG/FretboardSVG.tsx` (remove now-redundant `'use memo'`)
- Modify: `src/components/Fretboard/Fretboard.tsx` (remove now-redundant `'use memo'`)

- [ ] **Step 1: Flip `compilationMode` from `'annotation'` to `'infer'`**

In `vite.config.ts`, change:

```ts
compilationMode: 'annotation',
```

to:

```ts
// Infer mode: compile every component/hook in `sources` unless it
// opts out with 'use no memo'.
compilationMode: 'infer',
```

- [ ] **Step 2: Remove the now-redundant `'use memo'` directives**

In both:
- `src/components/FretboardSVG/FretboardSVG.tsx`
- `src/components/Fretboard/Fretboard.tsx`

…delete the leading `'use memo'` line. Infer mode compiles them automatically.

- [ ] **Step 3: Full build**

Run:
```bash
pnpm run build 2>&1 | tee /tmp/infer-build.txt
```

Expected: build succeeds. The compiler may print informational lines about files it skipped (anything with `'use no memo'` from Task 4). Skim and confirm none are unexpected.

- [ ] **Step 4: Full unit suite**

Run:
```bash
pnpm run test
```

Expected: all pass.

- [ ] **Step 5: Full visual regression suite**

Run:
```bash
pnpm run test:visual
```

Expected: zero snapshot diffs across all suites (`app-components`, `app-layout`, `app-mobile`, `app-overlays`, `fretboard-svg`). If any diff appears, the compiler has changed rendered output — that's a bug. Bisect by adding `'use no memo'` to the offending component, file an upstream issue with a repro.

- [ ] **Step 6: E2E**

Run:
```bash
pnpm run test:e2e:production
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts src/components/FretboardSVG/FretboardSVG.tsx src/components/Fretboard/Fretboard.tsx
git commit -m "perf(react): enable react-compiler infer mode app-wide

Switches compilationMode from 'annotation' to 'infer' so every
component and hook in src/ and packages/core/src/ is auto-memoized
unless it carries a 'use no memo' directive. Removes the per-file
'use memo' opt-ins from FretboardSVG and Fretboard (now redundant).

Verified: lint, unit, visual regression (all suites), and e2e:production
all pass with zero diffs."
```

---

### Task 8: Promote ESLint rule to error

**Files:**
- Modify: `eslint.config.js` (the rule level set in Task 3)

- [ ] **Step 1: Change `warn` → `error`**

In `eslint.config.js`:

```js
rules: {
  'react-hooks/react-compiler': 'error',
},
```

- [ ] **Step 2: Run lint**

Run:
```bash
pnpm run lint
```

Expected: exits 0. If any error appears, it slipped in after Task 4 — fix it now using the same A/B/C triage from Task 4.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): promote react-hooks/react-compiler to error

Guards against future Rules-of-React regressions now that the
compiler runs on the whole app."
```

---

### Task 9: Bundle-size delta and documentation

**Files:**
- Modify: `CLAUDE.md` (add a short "React Compiler" subsection under "Conventions" or a new "Build" subsection)

- [ ] **Step 1: Capture bundle-size delta**

Run:
```bash
pnpm run build
ls -la dist/assets/*.js | awk '{print $5, $9}' | tee /tmp/post-compiler-bundle.txt
```

Expected: a list of asset sizes. The compiler adds a small amount of generated memoization code per component; expect a modest size *increase* in source bundles (typically low single-digit %). Runtime perf is the win, not bundle size.

- [ ] **Step 2: Add a `React Compiler` note to `CLAUDE.md`**

Edit `CLAUDE.md`. Under the `## Conventions` section, add (after the CSS bullet, before A11y):

```markdown
- **React Compiler:** Enabled via `babel-plugin-react-compiler` in `vite.config.ts` with `compilationMode: 'infer'`. Every component and hook in `src/` and `packages/core/src/` is auto-memoized — manual `useMemo` / `useCallback` / `React.memo` is rarely needed for render-perf and should be added only when profiling proves it. The `react-hooks/react-compiler` ESLint rule runs at `error` and guards Rules-of-React compliance. To opt a single file out, add `'use no memo'` as the first statement of the function (or top of the module) with a `// TODO(react-compiler): <reason>` comment.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document react-compiler conventions

Records the compiler configuration, the auto-memoization expectation
for new code, and the 'use no memo' escape hatch."
```

- [ ] **Step 4: Final full verification before opening a PR**

Run:
```bash
pnpm run lint && pnpm run test && pnpm run build
```

Expected: all three succeed. This is the MANDATORY pre-PR check from `CLAUDE.md`.

---

## Self-review notes

- **Spec coverage:** Original request was "implement react compiler". Plan installs the plugin (Task 1), wires it (Task 2), enables the lint rule (Task 3), cleans up violations (Task 4), trial-compiles hot components (Tasks 5–6), enables app-wide compilation (Task 7), hardens the lint rule (Task 8), and documents the change (Task 9). Full coverage.
- **Placeholder scan:** Task 4 is intentionally generic because its work depends on Task 3's lint output, which is unknown until run. The plan provides concrete A/B/C classification rules with example before/after code so an engineer can act without further guidance. No `TBD` / `implement later` / `similar to Task N`.
- **Type consistency:** `compilationMode` and `sources` config keys are used identically in Tasks 2 and 7. The `'use memo'` directive in Tasks 5–6 is removed in Task 7. ESLint rule name `'react-hooks/react-compiler'` is consistent across Tasks 3 and 8.
- **Rollback:** Any task can be reverted by `git revert` of its commit. The annotation-mode intermediate state (Tasks 2–6) is itself a safe production state — partial rollout is supported.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-22-react-compiler-adoption.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
