# M0 — Fretboard Package Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the fretboard renderer, its Jotai store closure, the progression engine, and the audio runtime into a self-contained `@fretflow/fretboard` workspace package with a serializable `FretboardEmbed` contract (config in, events out, injectable audio) — with zero web-app behavior change.

**Architecture:** One new source-only workspace package at `packages/fretboard` (no dist build; consumed via Vite alias + tsconfig paths, exactly like `@fretflow/core` is today). Moved files keep their directory depth relative to the package's `src/` root so all intra-package relative imports survive the move verbatim. The ~95 app-side importers are untouched: every moved module leaves behind a one-line re-export stub at its old path. New code is limited to the contract layer (`FretboardEmbed`, config hydration, event sink, audio-mode gate), a portable `env.ts` (replacing 3 `import.meta.env` sites), and a boundary-check script.

**Tech Stack:** pnpm workspaces, Vite 6 (rolldown), TypeScript 6, Jotai 2, vitest 4, Playwright visual regression, React Compiler (babel plugin).

**Spec:** `docs/superpowers/specs/2026-06-12-fretboard-package-expo-mobile-design.md`

**Design delta vs. spec (approved rationale):** The spec proposed a separate `@fretflow/state` package. Dependency recon (2026-06-12) found `src/store` and `src/progressions` are *mutually* coupled (`store/*` imports `progressions/progressionDomain`, `progressions/audio/*` imports `store/progressionAtoms`), so two packages would form a cycle. State therefore lives inside `@fretflow/fretboard` as the internal `store/` module, importable by future consumers via the `@fretflow/fretboard/store/*` subpath. The spec's intent ("internal-facing, atoms are not the public API") is unchanged. Task 8 amends the spec.

**Worktree:** Execute this plan in a dedicated git worktree (invoke `superpowers:using-git-worktrees` first). Branch name suggestion: `feat/m0-fretboard-package`.

---

## Inventory (computed 2026-06-12 — re-verify nothing new appeared before starting)

**Moves to `packages/fretboard/src/` (same relative depth):**

| Origin | Destination | Notes |
|---|---|---|
| `src/utils/storage.ts`, `storage.test.ts`, `storageConstants.ts` | `packages/fretboard/src/utils/` | shareCodec, abbreviateMusicName, collision, perf/ STAY |
| `src/core/` (entire dir: audio, audioIdleSuspend, audioOutputHealth, fretboardLayoutCache, lazyGuitarAudio, polygonCoverage, toneInit + tests) | `packages/fretboard/src/core/` | |
| `src/layout/` (entire dir: breakpoints, responsive + tests) | `packages/fretboard/src/layout/` | Pure functions; `useLayoutMode` (the window-measuring hook) STAYS in `src/hooks/` |
| `src/store/` EXCEPT the stay-list below | `packages/fretboard/src/store/` | |
| `src/progressions/` (entire dir) | `packages/fretboard/src/progressions/` | gitignored `__snapshots__` regenerate at the new path automatically (`vitest update: 'new'`) |
| `src/hooks/`: `useFretboardState`, `useFretboardTopologyModel`, `useFretboardViewportModel`, `usePlaybackTransportModel`, `useProgressionAudioPlayback`, `useProgressionState`, `useScaleState`, `useShapeState`, `voicingSelection` (+ their tests) | `packages/fretboard/src/hooks/` | All other hooks STAY (`useLayoutMode`, `useMediaSession`, `useKeyboardShortcuts`, `usePWAInstall`, `useResolvedTheme`, `useShareLinkHandler`, `useTranslation`) |
| `src/components/Fretboard/`, `src/components/FretboardSVG/` (entire dirs incl. CSS modules, tests, `hooks/`, `utils/`) | `packages/fretboard/src/components/` | |

**`src/store/` stay-list (app-shell concerns):** `inspectorAtoms.ts`, `languageAtom.ts`, `urlOverrideAtoms.ts`, `urlOverrideAtoms.test.ts`, `MIGRATIONS.md`. (Verified: no moving store module imports any of these.)

**Copied (not moved) into `packages/fretboard/src/test-utils/`:** `renderWithAtoms.tsx`, `a11y.ts`, `storage.ts`, `toneMocks.ts`, `vitest-axe.d.ts` — moved tests reference them by preserved relative paths; staying tests keep using `src/test-utils/`. `setup.ts` stays root-only (root vitest config runs package tests).

**Known cross-boundary facts (verified by grep):**
- Staying code imports moved modules in ~95 files → handled entirely by re-export stubs (Task 3 Step 9).
- Moved code imports NO staying module. The only `import.meta` uses in the moved set are `progressions/audio/bus.ts:163`, `progressions/audio/sound/buildSignalGraph.ts:91`, `hooks/useProgressionAudioPlayback.ts:428` → fixed in Task 4.
- Direct (non-stub) importers of the moved component dirs, to be rewritten in Task 3 Step 10: `src/App.tsx`, `src/App.test.tsx`, `src/integration.test.tsx`, `src/styles/__tests__/fbColorTokens.test.ts`.

---

### Task 1: Scaffold `packages/fretboard` and wire the workspace

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `packages/fretboard/package.json`
- Create: `packages/fretboard/src/index.ts`
- Modify: `package.json` (root — dependencies)
- Modify: `vite.config.ts` (alias, react-compiler sources, vitest include/coverage)
- Modify: `tsconfig.app.json` (paths, include)

- [ ] **Step 1: Add the package to the workspace**

In `pnpm-workspace.yaml`, change:

```yaml
packages:
  - "packages/core"
```

to:

```yaml
packages:
  - "packages/core"
  - "packages/fretboard"
```

- [ ] **Step 2: Create `packages/fretboard/package.json`**

Source-only package — no build step, no dist (the web app consumes it via alias the same way `@fretflow/core` is aliased to its `src/index.ts`):

```json
{
  "name": "@fretflow/fretboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*"
  },
  "dependencies": {
    "@fretflow/core": "workspace:*",
    "clsx": "^2.1.1",
    "jotai": "^2.20.0",
    "motion": "^12.40.0",
    "tone": "^15.1.22"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 3: Create placeholder entry `packages/fretboard/src/index.ts`**

```ts
// Public contract surface — populated in the contract task.
export {};
```

- [ ] **Step 4: Add the workspace dependency to the root `package.json`**

In root `package.json` `dependencies`, after `"@fretflow/core": "workspace:*",` add:

```json
"@fretflow/fretboard": "workspace:*",
```

- [ ] **Step 5: Wire Vite**

In `vite.config.ts`:

(a) `resolve.alias` — add the fretboard alias (prefix alias; rollup alias semantics resolve both the bare id and subpaths):

```ts
resolve: {
  alias: {
    '@fretflow/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    '@fretflow/fretboard': fileURLToPath(new URL('./packages/fretboard/src', import.meta.url)),
  },
},
```

(b) React Compiler `sources` filter — add the new package explicitly:

```ts
sources: (filename: string) =>
  (filename.includes('/src/') ||
    filename.includes('/packages/core/src/') ||
    filename.includes('/packages/fretboard/src/')) &&
  !filename.includes('.test.') &&
  !filename.includes('.spec.'),
```

(c) vitest `test.include` — add the package:

```ts
include: [
  'src/**/*.{test,spec}.{ts,tsx}',
  'packages/core/src/**/*.{test,spec}.{ts,tsx}',
  'packages/fretboard/src/**/*.{test,spec}.{ts,tsx}',
],
```

(d) vitest `coverage.include` and `coverage.exclude`:

```ts
include: ['src/**/*.{ts,tsx}', 'packages/fretboard/src/**/*.{ts,tsx}'],
```

and add to `exclude`: `'packages/fretboard/src/test-utils/'`.

- [ ] **Step 6: Wire TypeScript**

In `tsconfig.app.json`:

```json
"paths": {
  "@fretflow/core": ["packages/core/src/index.ts"],
  "@fretflow/fretboard": ["packages/fretboard/src/index.ts"],
  "@fretflow/fretboard/*": ["packages/fretboard/src/*"]
},
```

and:

```json
"include": ["src", "packages/core/src", "packages/fretboard/src"]
```

- [ ] **Step 7: Install and verify green baseline**

Run: `pnpm install && pnpm run build:types && pnpm run test && pnpm run lint`
Expected: all pass (nothing moved yet; package is an empty shell).

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml packages/fretboard package.json vite.config.ts tsconfig.app.json pnpm-lock.yaml
git commit -m "chore(fretboard-pkg): scaffold @fretflow/fretboard workspace package"
```

---

### Task 2: Stub-generator script

**Files:**
- Create: `scripts/make-stubs.mjs`

- [ ] **Step 1: Write the script**

Takes moved-file paths (their OLD `src/`-relative locations), writes a re-export stub at the old path pointing at the package subpath. Detects `export default` in the moved file.

```js
// scripts/make-stubs.mjs
// Usage: node scripts/make-stubs.mjs src/store/scaleAtoms.ts src/core/audio.ts ...
// For each OLD path (file must already be moved to packages/fretboard/src/<same-rel-path>),
// writes a stub at the old path re-exporting from @fretflow/fretboard.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

for (const oldPath of process.argv.slice(2)) {
  const rel = oldPath.replace(/^src\//, "").replace(/\.(ts|tsx)$/, "");
  const newPathTs = `packages/fretboard/src/${rel}.ts`;
  const newPathTsx = `packages/fretboard/src/${rel}.tsx`;
  const newPath = existsSync(newPathTs) ? newPathTs : newPathTsx;
  if (!existsSync(newPath)) {
    console.error(`SKIP (not found in package): ${oldPath}`);
    process.exitCode = 1;
    continue;
  }
  const source = readFileSync(newPath, "utf-8");
  const hasDefault = /export\s+default\s/.test(source);
  const spec = `@fretflow/fretboard/${rel}`;
  let stub = `// Re-export stub: implementation moved to ${spec}\nexport * from "${spec}";\n`;
  if (hasDefault) stub += `export { default } from "${spec}";\n`;
  writeFileSync(oldPath, stub);
  console.log(`stub: ${oldPath} -> ${spec}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/make-stubs.mjs
git commit -m "chore(fretboard-pkg): add re-export stub generator"
```

---

### Task 3: The Great Move (atomic — store and progressions are mutually coupled, so they move together; tsc is only expected green at the end of this task)

**Files:**
- Move: per the Inventory table above
- Create: re-export stubs at all old non-test module paths
- Create: `packages/fretboard/src/test-utils/` (copies)
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/integration.test.tsx`, `src/styles/__tests__/fbColorTokens.test.ts`

- [ ] **Step 1: Move utils**

```bash
mkdir -p packages/fretboard/src/utils
git mv src/utils/storage.ts src/utils/storage.test.ts src/utils/storageConstants.ts packages/fretboard/src/utils/
```

- [ ] **Step 2: Move src/core and src/layout**

```bash
git mv src/core packages/fretboard/src/core
git mv src/layout packages/fretboard/src/layout
```

- [ ] **Step 3: Move the store closure (everything except the stay-list)**

```bash
mkdir -p packages/fretboard/src/store
for f in src/store/*; do
  base=$(basename "$f")
  case "$base" in
    inspectorAtoms.ts|languageAtom.ts|urlOverrideAtoms.ts|urlOverrideAtoms.test.ts|MIGRATIONS.md) ;;
    *) git mv "$f" packages/fretboard/src/store/ ;;
  esac
done
```

- [ ] **Step 4: Move progressions and the hooks**

```bash
git mv src/progressions packages/fretboard/src/progressions
mkdir -p packages/fretboard/src/hooks
for h in useFretboardState useFretboardTopologyModel useFretboardViewportModel \
         usePlaybackTransportModel useProgressionAudioPlayback useProgressionState \
         useScaleState useShapeState voicingSelection; do
  for ext in ts tsx test.ts test.tsx; do
    [ -f "src/hooks/$h.$ext" ] && git mv "src/hooks/$h.$ext" packages/fretboard/src/hooks/
  done
done
```

- [ ] **Step 5: Move the fretboard component trees**

```bash
mkdir -p packages/fretboard/src/components
git mv src/components/Fretboard packages/fretboard/src/components/Fretboard
git mv src/components/FretboardSVG packages/fretboard/src/components/FretboardSVG
```

- [ ] **Step 6: Copy test utilities into the package**

```bash
mkdir -p packages/fretboard/src/test-utils
cp src/test-utils/renderWithAtoms.tsx src/test-utils/a11y.ts src/test-utils/storage.ts \
   src/test-utils/toneMocks.ts src/test-utils/vitest-axe.d.ts packages/fretboard/src/test-utils/
git add packages/fretboard/src/test-utils
```

Then open each copied file and verify it has no imports reaching back into `src/` (the originals import only react, @testing-library, jotai, vitest — if one does reach into `src/`, copy that dependency too).

- [ ] **Step 7: Generate stubs for every moved non-test module**

```bash
node scripts/make-stubs.mjs \
  src/utils/storage.ts src/utils/storageConstants.ts \
  $(cd packages/fretboard/src && find core layout store progressions hooks -name '*.ts' -o -name '*.tsx' \
    | grep -v '\.test\.' | grep -v test-utils | sed 's|^|src/|')
```

(The `find` echoes every moved module at its old `src/`-relative path; the script writes the stubs. Components are intentionally excluded — their four importers are rewritten in Step 10.)

- [ ] **Step 8: Delete stubs nothing references**

For each stub, if no staying file imports its path, remove it:

```bash
for stub in $(grep -rl "Re-export stub" src --include='*.ts' --include='*.tsx'); do
  rel=${stub#src/}; rel=${rel%.ts}; rel=${rel%.tsx}
  if ! grep -rqE "from \"[^\"]*${rel}\"" src --include='*.ts' --include='*.tsx' --exclude="$(basename $stub)"; then
    git rm -f "$stub" 2>/dev/null || rm "$stub"
  fi
done
```

Note: the grep matches the tail of relative import specifiers (`../store/scaleAtoms` ends with `store/scaleAtoms`). After deleting, re-run `pnpm run build:types`; if a deletion broke something, restore that stub (`git checkout -- <path>`).

- [ ] **Step 9: Rewrite the four direct component importers**

In `src/App.tsx`, `src/App.test.tsx`, `src/integration.test.tsx`: replace import specifiers of the form `./components/Fretboard/...` and `./components/FretboardSVG/...` (or `../components/...`) with `@fretflow/fretboard/components/Fretboard/...` / `@fretflow/fretboard/components/FretboardSVG/...`. Also replace `./core/lazyGuitarAudio` (and any other `./core/...` imports in these files) — the stubs cover them, so this is optional here, but `App.tsx`'s component imports have no stubs and MUST be rewritten.

In `src/styles/__tests__/fbColorTokens.test.ts`: inspect how it references the fretboard — if it imports modules, rewrite to the package specifier; if it reads files from disk by path, update the path string to `packages/fretboard/src/components/...`.

- [ ] **Step 10: Typecheck and resolve stragglers**

Run: `pnpm run build:types`

Decision rule for any remaining "Cannot find module" error:
- Error in a **package** file importing an old `src/` location → the imported file belongs to the closure; `git mv` it into the package at the same relative depth and stub its old path (Step 7 command for that one file).
- Error in a **staying** file → a stub was deleted too eagerly or never generated; (re)create it with `node scripts/make-stubs.mjs <oldPath>`.

Repeat until clean.

- [ ] **Step 11: Run the full unit suite**

Run: `pnpm run test`
Expected: PASS. Moved tests run from their new package paths (vitest include from Task 1); missing snapshots are seeded automatically (`update: 'new'`). Failures to watch for: tests importing `../test-utils/setup`-only globals (setup is global via root config — fine) and path-sensitive tests like `fbColorTokens` (fix path strings as in Step 9).

- [ ] **Step 12: Lint**

Run: `pnpm run lint`
Expected: PASS. If `react-refresh` complains about stub files exporting non-components from `.tsx` stubs, rename that stub to `.ts`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor(fretboard-pkg): move fretboard, store closure, progressions, and audio runtime into @fretflow/fretboard

Pure move: files keep their relative depth inside the package so intra-package
imports are unchanged; all app-side importers continue to work through
re-export stubs at the old paths. No behavior change."
```

---

### Task 4: Portable env module (kill the `import.meta.env` Vite-isms)

**Files:**
- Create: `packages/fretboard/src/env.ts`
- Create: `packages/fretboard/src/env.test.ts`
- Modify: `packages/fretboard/src/progressions/audio/bus.ts:163`
- Modify: `packages/fretboard/src/progressions/audio/sound/buildSignalGraph.ts:91`
- Modify: `packages/fretboard/src/hooks/useProgressionAudioPlayback.ts:428`

- [ ] **Step 1: Write the failing test**

`packages/fretboard/src/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { IS_DEV, IS_TEST } from "./env";

describe("env", () => {
  it("reports test mode under vitest", () => {
    expect(IS_TEST).toBe(true);
  });
  it("exposes a boolean dev flag", () => {
    expect(typeof IS_DEV).toBe("boolean");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm vitest run packages/fretboard/src/env.test.ts`
Expected: FAIL — `Cannot find module './env'`.

- [ ] **Step 3: Implement `packages/fretboard/src/env.ts`**

`process.env.NODE_ENV` is statically replaced by both Vite and Metro, making this the one env probe that works under both bundlers. `import.meta` is banned in this package (Metro cannot parse it; enforced in Task 5).

```ts
// Portable environment flags. This package is consumed by two bundlers
// (Vite for the web app, Metro for the Expo DOM island); process.env.NODE_ENV
// is the only env probe both replace statically. Never use import.meta here.
export const IS_DEV: boolean = process.env.NODE_ENV !== "production";
export const IS_TEST: boolean = process.env.NODE_ENV === "test";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/fretboard/src/env.test.ts`
Expected: PASS (vitest sets `NODE_ENV=test`).

- [ ] **Step 5: Replace the three call sites**

In `progressions/audio/bus.ts` line ~163: `if (import.meta.env.DEV) {` → `if (IS_DEV) {`, adding `import { IS_DEV } from "../../env";`

In `progressions/audio/sound/buildSignalGraph.ts` line ~91: `if (import.meta.env.DEV) console.warn(...)` → `if (IS_DEV) console.warn(...)`, adding `import { IS_DEV } from "../../../env";`

In `hooks/useProgressionAudioPlayback.ts` line ~428: `if (import.meta.env.MODE === "test" || needsResume) {` → `if (IS_TEST || needsResume) {`, adding `import { IS_TEST } from "../env";`

- [ ] **Step 6: Verify no `import.meta` remains in the package**

Run: `grep -rn "import\.meta" packages/fretboard/src`
Expected: no output.

- [ ] **Step 7: Full test run and commit**

Run: `pnpm run test && pnpm run build:types`
Expected: PASS.

```bash
git add packages/fretboard/src
git commit -m "refactor(fretboard-pkg): replace import.meta.env with portable env module"
```

---

### Task 5: Boundary guard (package must stay self-contained)

**Files:**
- Create: `scripts/check-fretboard-boundaries.mjs`
- Modify: `package.json` (root — lint script)

- [ ] **Step 1: Write the checker**

```js
// scripts/check-fretboard-boundaries.mjs
// @fretflow/fretboard must be consumable by both Vite (web) and Metro (Expo
// DOM island). Enforce: (1) no relative import escapes the package's src/,
// (2) no import.meta anywhere in the package.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";

const ROOT = resolve("packages/fretboard/src");
const errors = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) check(p);
  }
}

function check(file) {
  const text = readFileSync(file, "utf-8");
  if (text.includes("import.meta")) {
    errors.push(`${file}: uses import.meta (Metro cannot parse it — use env.ts)`);
  }
  const specRe = /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of text.matchAll(specRe)) {
    const spec = m[1] ?? m[2];
    if (!spec.startsWith(".")) continue;
    const target = resolve(dirname(file), spec);
    if (!(target + sep).startsWith(ROOT + sep) && target !== ROOT) {
      errors.push(`${file}: relative import escapes package: "${spec}"`);
    }
  }
}

walk(ROOT);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("fretboard package boundaries OK");
```

- [ ] **Step 2: Verify it catches a violation**

Temporarily add `import "../../../src/main";` to `packages/fretboard/src/index.ts`, run `node scripts/check-fretboard-boundaries.mjs`, expect exit 1 with the escape error. Revert the line, run again, expect `fretboard package boundaries OK`.

- [ ] **Step 3: Wire into lint**

Root `package.json`:

```json
"lint": "eslint . && node scripts/check-fretboard-boundaries.mjs",
```

- [ ] **Step 4: Run and commit**

Run: `pnpm run lint`
Expected: PASS.

```bash
git add scripts/check-fretboard-boundaries.mjs package.json
git commit -m "chore(fretboard-pkg): enforce package boundary and import.meta ban"
```

---

### Task 6: Contract layer — `FretboardEmbed`, config, events, audio mode

**Files:**
- Create: `packages/fretboard/src/contract/events.ts`
- Create: `packages/fretboard/src/contract/embedAtoms.ts`
- Create: `packages/fretboard/src/contract/FretboardEmbed.tsx`
- Create: `packages/fretboard/src/contract/FretboardEmbed.test.tsx`
- Modify: `packages/fretboard/src/components/Fretboard/Fretboard.tsx` (gate `playGuitarNote`)
- Modify: `packages/fretboard/src/index.ts`

- [ ] **Step 1: Define events and embed atoms**

`packages/fretboard/src/contract/events.ts`:

```ts
/** Serializable events emitted across the embed boundary. Grows with consumers. */
export type FretboardEvent = {
  type: "noteActivated";
  /** Frequency in Hz of the activated note (what the builtin synth would play). */
  frequency: number;
};

export type FretboardEventSink = (event: FretboardEvent) => void;
```

`packages/fretboard/src/contract/embedAtoms.ts`:

```ts
import { atom } from "jotai";
import type { FretboardEventSink } from "./events";

/**
 * "builtin": the package renders its own audio (GuitarSynth / Tone.js) — the
 * web app's behavior. "events": the package is silent and emits FretboardEvents
 * so the host (e.g. a native shell) renders audio itself.
 */
export const audioModeAtom = atom<"builtin" | "events">("builtin");

/** Host-registered event sink. Null outside an embed. */
export const fretboardEventSinkAtom = atom<FretboardEventSink | null>(null);
```

- [ ] **Step 2: Write the failing contract tests**

`packages/fretboard/src/contract/FretboardEmbed.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FretboardEmbed } from "./FretboardEmbed";

vi.mock("../core/lazyGuitarAudio", () => ({
  playGuitarNote: vi.fn().mockResolvedValue(undefined),
}));
import { playGuitarNote } from "../core/lazyGuitarAudio";

describe("FretboardEmbed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the fretboard", () => {
    render(<FretboardEmbed config={{}} />);
    // The fretboard SVG exposes an accessible application/figure role — assert
    // on whatever stable landmark Fretboard renders (adjust the query to the
    // actual accessible name; see Fretboard.tsx aria labels).
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("applies config.root to the rendered scale", () => {
    render(<FretboardEmbed config={{ root: "G", displayFormat: "notes" }} />);
    expect(screen.getAllByText("G").length).toBeGreaterThan(0);
  });

  it("isolates state between two embeds (per-embed store)", () => {
    const { unmount } = render(
      <FretboardEmbed config={{ root: "G", displayFormat: "notes" }} />,
    );
    unmount();
    render(<FretboardEmbed config={{ root: "D", displayFormat: "notes" }} />);
    expect(screen.getAllByText("D").length).toBeGreaterThan(0);
  });

  it('audio="events": emits noteActivated and does NOT call the builtin synth', async () => {
    const onEvent = vi.fn();
    render(<FretboardEmbed config={{ audio: "events" }} onEvent={onEvent} />);
    const user = userEvent.setup();
    // Hit targets are rendered by FretboardHitTargetLayer; find the first one.
    const hitTarget = document.querySelector('[data-string][data-fret]')
      ?? document.querySelector("svg rect, svg circle");
    expect(hitTarget).not.toBeNull();
    await user.click(hitTarget as Element);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "noteActivated", frequency: expect.any(Number) }),
    );
    expect(playGuitarNote).not.toHaveBeenCalled();
  });

  it('audio="builtin" (default): calls the builtin synth', async () => {
    render(<FretboardEmbed config={{}} />);
    const user = userEvent.setup();
    const hitTarget = document.querySelector('[data-string][data-fret]')
      ?? document.querySelector("svg rect, svg circle");
    await user.click(hitTarget as Element);
    expect(playGuitarNote).toHaveBeenCalled();
  });
});
```

Note to implementer: the hit-target selector and the tap-to-sound path must be confirmed against the real DOM. Open `packages/fretboard/src/components/FretboardSVG/FretboardHitTargetLayer.tsx` and `components/Fretboard/Fretboard.tsx` (grep `playGuitarNote`) and adjust the queries so the test clicks the element whose handler reaches `playGuitarNote`. The assertions (event emitted + synth suppressed / synth called) are the contract and must not be weakened.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run packages/fretboard/src/contract/FretboardEmbed.test.tsx`
Expected: FAIL — `FretboardEmbed` does not exist.

- [ ] **Step 4: Implement the embed**

`packages/fretboard/src/contract/FretboardEmbed.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Provider, createStore } from "jotai";
import { Fretboard } from "../components/Fretboard/Fretboard";
import { baseRootNoteAtom, baseScaleNameAtom } from "../store/scaleAtoms";
import { themeAtom, displayFormatAtom, type ThemePreference } from "../store/uiAtoms";
import { audioModeAtom, fretboardEventSinkAtom } from "./embedAtoms";
import type { FretboardEventSink } from "./events";

/**
 * Serializable configuration for an embedded fretboard. Every field crosses
 * process/webview boundaries, so values must stay JSON-serializable and only
 * change at human speed (no per-frame updates). Grows with consumers (M2+).
 */
export interface FretboardConfig {
  /** Root note as a sharp name, e.g. "C", "F#". */
  root?: string;
  /** Scale name as stored by the app, e.g. "Major", "Minor Pentatonic". */
  scale?: string;
  theme?: ThemePreference;
  displayFormat?: "notes" | "degrees" | "none";
  /** "builtin" (default): package plays its own audio. "events": silent, emits FretboardEvents. */
  audio?: "builtin" | "events";
  /** Pixel height per string row (host-controlled sizing). */
  stringRowPx?: number;
}

export interface FretboardEmbedProps {
  config: FretboardConfig;
  onEvent?: FretboardEventSink;
}

// The effects below are the hydration layer: imperative atom writes keyed on
// config changes. FretboardSVG and everything beneath it keep their direct
// atom subscriptions untouched.
export function FretboardEmbed({ config, onEvent }: FretboardEmbedProps) {
  // One isolated store per embed: embeds never share state with a host app
  // that might also be running the default Jotai store.
  const [store] = useState(() => createStore());

  useEffect(() => {
    if (config.root !== undefined) store.set(baseRootNoteAtom, config.root);
    if (config.scale !== undefined) store.set(baseScaleNameAtom, config.scale);
    if (config.theme !== undefined) store.set(themeAtom, config.theme);
    if (config.displayFormat !== undefined) store.set(displayFormatAtom, config.displayFormat);
    store.set(audioModeAtom, config.audio ?? "builtin");
  }, [store, config.root, config.scale, config.theme, config.displayFormat, config.audio]);

  useEffect(() => {
    store.set(fretboardEventSinkAtom, onEvent ?? null);
  }, [store, onEvent]);

  return (
    <Provider store={store}>
      <Fretboard stringRowPx={config.stringRowPx ?? 34} />
    </Provider>
  );
}
```

Implementation notes (verify against the real code while implementing):
- `baseRootNoteAtom` / `baseScaleNameAtom` are the persisted source-of-truth atoms in `store/scaleAtoms.ts` (the derived `rootNoteAtom`/`scaleNameAtom` sit above them). If their write signatures validate input, pass validated values through.
- `Fretboard`'s required prop is `stringRowPx` (see `FretboardProps`); 34 matches the mobile string-spacing default established on the `capacitorjs` branch. If `stringRowPx` turns out optional, drop the fallback.

- [ ] **Step 5: Gate the builtin synth at its call site**

In `packages/fretboard/src/components/Fretboard/Fretboard.tsx`, locate the handler that calls `playGuitarNote(frequency)` (line 8 imports it; grep for the call). Replace the direct call with the mode gate:

```tsx
import { useAtomValue } from "jotai";
import { audioModeAtom, fretboardEventSinkAtom } from "../../contract/embedAtoms";
```

inside the component:

```tsx
const audioMode = useAtomValue(audioModeAtom);
const eventSink = useAtomValue(fretboardEventSinkAtom);
```

and at the call site, where `frequency` is computed:

```tsx
if (audioMode === "events") {
  eventSink?.({ type: "noteActivated", frequency });
} else {
  void playGuitarNote(frequency);
}
```

Default mode is `"builtin"` and the web app never sets it otherwise, so web behavior is identical.

- [ ] **Step 6: Export the public surface**

`packages/fretboard/src/index.ts`:

```ts
export { FretboardEmbed } from "./contract/FretboardEmbed";
export type { FretboardConfig, FretboardEmbedProps } from "./contract/FretboardEmbed";
export type { FretboardEvent, FretboardEventSink } from "./contract/events";
export { Fretboard } from "./components/Fretboard/Fretboard";
```

- [ ] **Step 7: Run the contract tests until green**

Run: `pnpm vitest run packages/fretboard/src/contract/FretboardEmbed.test.tsx`
Expected: PASS (adjust DOM queries per the Step 2 note, not the assertions).

- [ ] **Step 8: Full suite, lint, typecheck**

Run: `pnpm run test && pnpm run lint && pnpm run build:types`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/fretboard/src
git commit -m "feat(fretboard-pkg): FretboardEmbed contract — config hydration, event sink, injectable audio mode"
```

---

### Task 7: Full verification — zero behavior change

- [ ] **Step 1: Unit + lint + build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all PASS; production build emits the same app.

- [ ] **Step 2: Token check**

Run: `pnpm run ui:tokens`
Expected: PASS (no undefined `var(--x)` — CSS modules moved verbatim).

- [ ] **Step 3: Visual regression — the extraction gate**

Run: `pnpm run test:visual`
Expected: PASS with **zero snapshot diffs**. Any diff means the extraction changed behavior — stop, diagnose (likely a missed stub or an import-order side effect such as the `migrateLegacyKeys()` module side effect in `utils/storage.ts` now loading from a different graph position), and fix before proceeding. Do NOT update snapshots to make this pass.

- [ ] **Step 4: E2E**

Run: `pnpm run test:e2e:production`
Expected: PASS.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix(fretboard-pkg): extraction fixes surfaced by full verification"
```

(Skip if nothing changed.)

---

### Task 8: Documentation — AGENTS.md and spec amendment

**Files:**
- Modify: `AGENTS.md` (Architecture + File Layout sections)
- Modify: `docs/superpowers/specs/2026-06-12-fretboard-package-expo-mobile-design.md`

- [ ] **Step 1: Update AGENTS.md**

In **Architecture → State & Logic**, change the state bullet's location reference from `src/store/` to: atoms live in `@fretflow/fretboard` (`packages/fretboard/src/store/`), domain-split as before; app-shell atoms (`inspectorAtoms`, `languageAtom`, `urlOverrideAtoms`) remain in `src/store/`. Old `src/store/*` paths are re-export stubs — new code should import from `@fretflow/fretboard/store/<module>` directly.

In **Architecture → Components & Layout**, update the Rendering bullet: `Fretboard`/`FretboardSVG` live in `packages/fretboard/src/components/`; the package's public contract is `FretboardEmbed` (`config` in, `FretboardEvent`s out, `audio: "builtin" | "events"`).

In **File Layout**, add under `packages/`:

```text
└── fretboard/                # @fretflow/fretboard — fretboard renderer, Jotai store closure,
    └── src/                  # progression engine, audio runtime, FretboardEmbed contract.
                              # Source-only (no dist); consumed via Vite alias + tsconfig paths.
                              # Self-contained: no imports from src/, no import.meta
                              # (enforced by scripts/check-fretboard-boundaries.mjs in `pnpm run lint`).
```

- [ ] **Step 2: Amend the spec**

In the spec's "Package: `@fretflow/state`" section, add at the top:

> **Amendment (M0 implementation):** `src/store` and `src/progressions` are mutually coupled, so a standalone state package would create a dependency cycle. State ships inside `@fretflow/fretboard` as the internal `store/` module (subpath-importable via `@fretflow/fretboard/store/*`). Everything else in this section applies to that module unchanged.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-06-12-fretboard-package-expo-mobile-design.md
git commit -m "docs(fretboard-pkg): document @fretflow/fretboard package and amend spec"
```

---

### Task 9: Finish the branch

- [ ] **Step 1: Re-run the MANDATORY pre-PR checks**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: PASS.

- [ ] **Step 2: Complete the branch**

Invoke `superpowers:finishing-a-development-branch` — open a PR to `main` titled `refactor(fretboard-pkg): extract @fretflow/fretboard package with FretboardEmbed contract`. The PR body should call out: pure-move + stubs strategy, zero visual diffs, the spec delta (state folded into the fretboard package), and that this is M0 of the mobile design spec.

---

## Deferred (explicitly NOT in M0)

- Storage-driver injection beyond the existing `hasLocalStorage()` guard — the DOM island has `localStorage`; a native consumer swap happens at `utils/storage.ts` when actually needed (YAGNI).
- Progression-engine event emission in `audio="events"` mode — M0 ships the seam (`audioModeAtom`) and gates note taps; transport/progression events are added in M2/M3 when the native shell consumes them.
- Config fields beyond `root/scale/theme/displayFormat/audio/stringRowPx` — added per consumer need.
- A standalone vitest project inside `packages/fretboard` — the root vitest config runs the package's tests (Task 1 Step 5c); per-package isolated runs can be added when the private mobile repo needs them.
- The `fretflow-mobile` private repo (M1) — separate plan.
