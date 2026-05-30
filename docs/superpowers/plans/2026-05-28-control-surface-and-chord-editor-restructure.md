# Control-surface system + chord-editor restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all control-like surfaces (dropdowns, steppers, toggle bars, icon buttons, modal-close/header buttons) onto two composable CSS classes with retuned tokens, then replace the chord-editor DegreeGrid with two scale-aware grouped dropdowns driven by Tonal-backed harmony helpers.

**Architecture:** Two phases. Phase A (Tasks 1–7) is a pure CSS/structure refactor: extract `.surface--control` / `.surface--chrome` composables in `shared.module.css`, retune `--dc-*` token alphas, unify the icon-button size scale, and route every consumer through them. Phase B (Tasks 8–16) adds `packages/core/src/keyHarmony.ts` (diatonic/borrowed/chromatic classification via existing `getDiatonicChord` + Tonal `Key`/`Mode`), an app-layer dropdown-option builder, an extended quality-group builder, a session-only quality-lock atom + a root-selection orchestrating atom, then rewrites the `SongControls` editor and deletes `DegreeGrid`.

**Tech Stack:** React 19 + TypeScript, Jotai atoms, Tonal.js (`@tonaljs/key`, `@tonaljs/mode`, `@tonaljs/note`, `@tonaljs/chord`), Radix Select (`LabeledSelect`), `cva` (ToggleBar variants), Vitest + Testing Library, Playwright visual regression. Package manager is **pnpm**.

**Spec:** `docs/superpowers/specs/2026-05-28-control-surface-and-chord-editor-restructure-design.md`

---

## Reference notes (read before starting)

**Commands** (run from repo root):

```bash
pnpm run test -- <path>     # run a single test file
pnpm run lint               # eslint + stylelint
pnpm run build              # tsc -b && vite build
pnpm run test:visual:update # refresh darwin visual snapshots
```

**Key existing facts the tasks rely on:**

- `--dc-*` tokens are defined in **three** blocks of `src/styles/semantic.css`: `:root` (dark default, ~line 226), `[data-theme="modern-light"]` (~line 285), `[data-theme="modern-dark"]` (~line 343). The `:root` and `modern-dark` blocks carry identical cyan values.
- `LabeledSelect` already supports grouped options via the `groups` prop (`LabeledSelectGroup[]`, each `{ groupLabel?, options }`). See `src/components/LabeledSelect/LabeledSelect.tsx`.
- `getDiatonicChord(degree, scaleName, tonicNote)` (in `@fretflow/core`) returns `{ root: string; quality: string } | null` with FretFlow quality keys (`"M"`, `"m"`, `"dim"`, `"aug"`).
- `getDegreeSequence(scaleName)` (in `@fretflow/core`) returns the ordered `DegreeId[]` for a scale.
- `PROGRESSION_HARMONY_SCALE` (private in `src/progressions/progressionDomain.ts`) maps `"major pentatonic" → "major"`, `"minor pentatonic" → "minor"`, `"major blues" → "major"`, `"minor blues" → "minor"`. Task 8 promotes this to core and Task 8b re-points the existing consumer.
- `guessQualityForBorrowedRoot(root?, scaleName?, tonicNote?)` currently returns `"M"` (stub). Keep as-is; the Quality "Diatonic" group uses it for borrowed roots.
- The editor lives in `src/components/SongControls/SongControls.tsx`. The chord-root control is `DegreeGrid` (lines ~373–386); the pip-nav is at lines ~350–370; the quality select at ~389–409.
- `updateProgressionStepRootAtom` is also consumed by `src/store/songStateAtoms.ts` — **do not change its semantics**; add a new orchestrating atom instead.
- CSS contract-test precedent: `src/components/Inspector/Inspector.module.css.test.ts` reads the raw CSS file and asserts on its contents.

---

## Phase A — Control-surface system

### Task 1: Retune `--dc-*` tokens + add a contract test

**Files:**
- Create: `src/styles/semantic.css.test.ts`
- Modify: `src/styles/semantic.css` (three `--dc-bg` / `--dc-border` pairs)

- [ ] **Step 1: Write the failing contract test**

Create `src/styles/semantic.css.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "semantic.css"), "utf8");

describe("semantic.css --dc-* control-surface tokens", () => {
  it("dark/default resting surface reads against flat cards", () => {
    expect(css).toContain("--dc-bg: rgb(77 228 255 / 0.05);");
    expect(css).toContain("--dc-border: rgb(77 228 255 / 0.28);");
  });

  it("light-mode resting surface reads against flat cards", () => {
    expect(css).toContain("--dc-bg: rgb(20 112 136 / 0.06);");
    expect(css).toContain("--dc-border: rgb(20 112 136 / 0.32);");
  });

  it("keeps both dark occurrences (root + modern-dark) in sync", () => {
    const matches = css.match(/--dc-border: rgb\(77 228 255 \/ 0\.28\);/g) ?? [];
    expect(matches.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/styles/semantic.css.test.ts`
Expected: FAIL — current values are `0.03` / `0.18` (dark) and `0.04` / `0.22` (light).

- [ ] **Step 3: Edit the three token blocks in `src/styles/semantic.css`**

In the `:root` block (~line 226–229) change:

```css
  --dc-bg: rgb(77 228 255 / 0.05);
  --dc-bg-hover: rgb(77 228 255 / 0.08);
  --dc-bg-active: rgb(77 228 255 / 0.1);
  --dc-border: rgb(77 228 255 / 0.28);
```

In the `[data-theme="modern-light"]` block (~line 285–288) change:

```css
  --dc-bg: rgb(20 112 136 / 0.06);
  --dc-bg-hover: rgb(20 112 136 / 0.08);
  --dc-bg-active: rgb(20 112 136 / 0.10);
  --dc-border: rgb(20 112 136 / 0.32);
```

In the `[data-theme="modern-dark"]` block (~line 343–346) change to match `:root`:

```css
  --dc-bg: rgb(77 228 255 / 0.05);
  --dc-bg-hover: rgb(77 228 255 / 0.08);
  --dc-bg-active: rgb(77 228 255 / 0.1);
  --dc-border: rgb(77 228 255 / 0.28);
```

Only `--dc-bg` and `--dc-border` change; leave `*-hover` / `*-active` as they are.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/styles/semantic.css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/styles/semantic.css src/styles/semantic.css.test.ts
git commit -m "style(tokens): retune --dc-bg/--dc-border so resting control surfaces read against flat cards"
```

---

### Task 2: Add `.surface--control` / `.surface--chrome` composables + tone modifiers

**Files:**
- Modify: `src/components/shared/shared.module.css`
- Create: `src/components/shared/surface.module.css.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `src/components/shared/surface.module.css.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "shared.module.css"), "utf8");

describe("shared.module.css surface composables", () => {
  it("defines the control surface and its interaction states", () => {
    expect(css).toMatch(/\.surface--control\s*\{/);
    expect(css).toMatch(/\.surface--control:hover\s*\{/);
    expect(css).toMatch(/\.surface--control:focus-within\s*\{/);
  });

  it("defines the chrome surface and its hover state", () => {
    expect(css).toMatch(/\.surface--chrome\s*\{/);
    expect(css).toMatch(/\.surface--chrome:hover\s*\{/);
  });

  it("defines a destructive tone modifier", () => {
    expect(css).toMatch(/\.tone--destructive\s*\{/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/shared/surface.module.css.test.ts`
Expected: FAIL — classes do not exist yet.

- [ ] **Step 3: Add the composables to `src/components/shared/shared.module.css`**

Insert near the top of the file (after the existing token-comment header, before `.toggle-group`):

```css
/* ===== Composable control surfaces =====
   Single source of truth for control chrome. Components compose one of these
   via `composes:` rather than re-implementing the dc-*/surface-control-* chain.
   `.surface--control` = inline form controls (steppers, selects, toggle bars).
   `.surface--chrome`   = standalone chrome icon buttons (header, modal close). */
.surface--control {
  background-color: var(--dc-bg);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius);
  transition: var(--dc-transition);
}
.surface--control:hover {
  background-color: var(--dc-bg-hover);
  border-color: var(--dc-border-hover);
}
.surface--control:focus-within {
  border-color: var(--dc-border-active);
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.surface--chrome {
  background-color: var(--surface-control);
  background-image: var(--surface-control-bg-image);
  border: 1px solid var(--surface-control-border);
  box-shadow: var(--elevation-card);
  color: var(--surface-control-fg-muted);
  transition: var(--transition-surface), transform var(--transition-fast);
}
.surface--chrome:hover {
  background-color: var(--surface-control-hover-bg);
  background-image: var(--surface-control-hover-bg-image);
  color: var(--surface-control-hover-fg);
  border-color: var(--surface-control-hover-border);
  transform: translateY(-1px);
}

/* Tone modifiers — layer on top of either surface to recolor without
   redefining the whole chrome. */
.tone--destructive {
  background: var(--destructive-control-bg);
  border-color: var(--destructive-control-border);
  color: var(--destructive-control-fg);
}
.tone--destructive:hover {
  background: var(--destructive-control-hover-bg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/components/shared/surface.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Run lint then commit**

```bash
pnpm run lint
git add src/components/shared/shared.module.css src/components/shared/surface.module.css.test.ts
git commit -m "style(shared): add .surface--control/.surface--chrome composables + tone modifiers"
```

---

### Task 3: Unify the icon-button size scale

**Files:**
- Modify: `src/components/shared/shared.module.css` (`.icon-button` block, ~lines 452–535)
- Modify: `src/components/shared/surface.module.css.test.ts` (extend)

- [ ] **Step 1: Extend the contract test**

Append to `src/components/shared/surface.module.css.test.ts`:

```ts
describe("shared.module.css icon-button size scale", () => {
  const css = readFileSync(join(__dirname, "shared.module.css"), "utf8");
  it("defines sm/md/lg size variants", () => {
    expect(css).toMatch(/\.icon-button--sm\s*\{[^}]*width:\s*2rem;[^}]*height:\s*2rem;/s);
    expect(css).toMatch(/\.icon-button--md\s*\{[^}]*width:\s*2\.75rem;/s);
    expect(css).toMatch(/\.icon-button--lg\s*\{[^}]*width:\s*2\.95rem;/s);
  });
  it("makes .icon-button compose the chrome surface", () => {
    expect(css).toMatch(/\.icon-button\s*\{[^}]*composes:\s*surface--chrome/s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/shared/surface.module.css.test.ts`
Expected: FAIL — `--sm` / `--md` and the `composes:` line do not exist.

- [ ] **Step 3: Refactor the `.icon-button` block**

In `src/components/shared/shared.module.css`, replace the `.icon-button` base rule (currently `width: 2.75rem; height: 2.75rem;` plus inline bg/border/box-shadow/color/transition) so it composes the chrome surface and drops its own chrome props:

```css
.icon-button {
  composes: surface--chrome;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
```

Delete the now-duplicated `.icon-button:hover` chrome rule (the `transform: translateY(-1px)` and bg/border/color lines now come from `.surface--chrome:hover`). Keep `.icon-button:active`, `.icon-button:focus-visible`, the `[data-theme="modern-dark"] .icon-button:focus-visible`, and the `.icon-button :global(.icon*)` rules unchanged.

Add the size scale immediately after the base rule (replacing the existing `.icon-button--lg` definition):

```css
.icon-button--sm { width: 2rem;    height: 2rem;    }
.icon-button--md { width: 2.75rem; height: 2.75rem; }
.icon-button--lg { width: 2.95rem; height: 2.95rem; }

.icon-button--sm :global(.icon) { width: 1rem;    height: 1rem;    }
.icon-button--lg :global(.icon) { width: 1.25rem; height: 1.25rem; }
```

Keep the existing responsive `@media (max-width: 1079px)` and mobile-tier `.icon-button--lg` overrides as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/components/shared/surface.module.css.test.ts`
Expected: PASS

- [ ] **Step 5: Run lint then commit**

```bash
pnpm run lint
git add src/components/shared/shared.module.css src/components/shared/surface.module.css.test.ts
git commit -m "style(shared): unify icon-button size scale (sm/md/lg) on the chrome surface composable"
```

---

### Task 4: Route StepperShell + LabeledSelect through `.surface--control`

**Files:**
- Modify: `src/components/StepperShell/StepperShell.module.css` (`.shell`)
- Modify: `src/components/LabeledSelect/LabeledSelect.module.css` (`.labeled-select-trigger`)

- [ ] **Step 1: Add a contract test for both modules**

Create `src/components/StepperShell/StepperShell.module.css.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("control-surface composition", () => {
  it("StepperShell .shell composes surface--control", () => {
    const css = readFileSync(join(__dirname, "StepperShell.module.css"), "utf8");
    expect(css).toMatch(/\.shell\s*\{[^}]*composes:\s*surface--control\s+from/s);
  });
  it("LabeledSelect trigger composes surface--control", () => {
    const css = readFileSync(
      join(__dirname, "../LabeledSelect/LabeledSelect.module.css"),
      "utf8",
    );
    expect(css).toMatch(/composes:\s*surface--control\s+from/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/StepperShell/StepperShell.module.css.test.ts`
Expected: FAIL.

- [ ] **Step 3: Edit `StepperShell.module.css`**

Change `.shell` to compose the surface and drop the duplicated chrome props:

```css
.shell {
  composes: surface--control from "../shared/shared.module.css";
  min-width: 0;
  min-height: var(--control-height);
  display: flex;
  align-items: stretch;
  gap: 0.22rem;
  padding: 2px;
}
```

Delete the `.shell:hover` and `.shell:focus-within` rules (now inherited). Keep `.button`, `.value`, `.slot`, `.icon` unchanged.

- [ ] **Step 4: Edit `LabeledSelect.module.css`**

Change the trigger rule (currently `background-color: var(--dc-bg); border: 1px solid var(--dc-border); border-radius: var(--dc-radius);` at ~lines 26–28) to:

```css
.labeled-select-trigger {
  composes: surface--control from "../shared/shared.module.css";
  /* layout-only props remain below */
}
```

Keep the layout props (display, padding, height, font, etc.) that follow. Remove the now-duplicated `:hover` bg/border (~lines 55–56) and `:focus`/`:focus-visible` border-color (~line 66) lines that only set the dc hover/active border — leave any non-chrome focus styling intact. Run `pnpm run test` for LabeledSelect afterward to confirm `getComputedStyle` assertions still hold.

- [ ] **Step 5: Run tests, lint, commit**

```bash
pnpm run test -- src/components/StepperShell/StepperShell.module.css.test.ts src/components/LabeledSelect/LabeledSelect.test.tsx
pnpm run lint
git add src/components/StepperShell/StepperShell.module.css src/components/LabeledSelect/LabeledSelect.module.css src/components/StepperShell/StepperShell.module.css.test.ts
git commit -m "style(controls): route StepperShell + LabeledSelect through .surface--control"
```

---

### Task 5: Route ToggleBar default/chip through the surface + add `pip` variant

**Files:**
- Modify: `src/components/ToggleBar/ToggleBar.tsx`
- Modify: `src/components/ToggleBar/ToggleBar.module.css`
- Modify: `src/components/shared/shared.module.css` (`.toggle-group--default`, `.toggle-btn--chip`)
- Modify: `src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Write failing tests for the `pip` variant**

Append to `src/components/ToggleBar/ToggleBar.test.tsx`:

```tsx
describe("ToggleBar pip variant", () => {
  const opts = [
    { value: 0, label: "I" },
    { value: 1, label: "V" },
  ];

  it("renders a tablist with mono degree labels", () => {
    render(<ToggleBar variant="pip" options={opts} value={0} onChange={vi.fn()} label="nav" />);
    expect(screen.getByRole("tablist", { name: "nav" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the active pip with aria-selected", () => {
    render(<ToggleBar variant="pip" options={opts} value={1} onChange={vi.fn()} label="nav" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange with the selected value", () => {
    const onChange = vi.fn();
    render(<ToggleBar variant="pip" options={opts} value={0} onChange={onChange} label="nav" />);
    fireEvent.click(screen.getByText("V"));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/ToggleBar/ToggleBar.test.tsx`
Expected: FAIL — `pip` is not an accepted variant; no tablist rendered.

- [ ] **Step 3: Add the `pip` variant to `ToggleBar.tsx`**

In `toggleBarVariants`, add `pip: styles["pip-group"]`. In `toggleButtonVariants`, add `pip: styles["pip-btn"]`. Extend the `variant` prop union to `"default" | "chip" | "tabs" | "pip"`. Treat `pip` like `tabs` for ARIA — change `const isTabs = variant === "tabs";` to:

```tsx
const isTablist = variant === "tabs" || variant === "pip";
```

and use `isTablist` everywhere `isTabs` was used (the `role`, `aria-selected` vs `aria-pressed` branch, and the container `role`).

- [ ] **Step 4: Add the pip CSS + route default/chip through the surface**

In `src/components/ToggleBar/ToggleBar.module.css` add:

```css
.pip-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pip-btn {
  composes: surface--control from "../shared/shared.module.css";
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.2rem;
  height: 1.8rem;
  padding: 0 0.4rem;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
}

.pip-btn[aria-selected="true"] {
  background-color: color-mix(in srgb, var(--faceplate-accent) 10%, transparent);
  border-color: var(--faceplate-accent);
  color: var(--faceplate-accent);
  font-weight: 700;
  box-shadow: 0 0 8px color-mix(in srgb, var(--faceplate-accent) 18%, transparent);
}

.pip-btn:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
  box-shadow: var(--focus-ring-glow);
}
```

In `src/components/shared/shared.module.css`, change `.toggle-btn--chip` so its bg/border come from the surface (remove the inline `background`/`border` it currently sets and compose instead):

```css
.toggle-btn--chip {
  composes: surface--control from "./shared.module.css";
}
```

(Self-composition within the same file is valid in CSS Modules.) Leave `.toggle-btn--chip.active` as-is. The `.toggle-group--default` already wraps a `--dc-*` shell; convert it too:

```css
.toggle-group--default {
  composes: surface--control from "./shared.module.css";
  width: 100%;
}
```

Remove any now-duplicated bg/border declarations left in those two rules.

- [ ] **Step 5: Run tests, lint, commit**

```bash
pnpm run test -- src/components/ToggleBar/ToggleBar.test.tsx
pnpm run lint
git add src/components/ToggleBar/ src/components/shared/shared.module.css
git commit -m "feat(togglebar): add pip variant; route default/chip through .surface--control"
```

---

### Task 6: Migrate AppHeader actions + modal close buttons to `.icon-button--sm`

**Files:**
- Modify: `src/components/AppHeader/AppHeader.tsx`, `src/components/AppHeader/AppHeader.module.css`
- Modify: `src/components/HelpModal/HelpModal.tsx`, `src/components/HelpModal/HelpModal.module.css`
- Modify: `src/components/SettingsOverlay/SettingsOverlay.tsx`, `src/components/SettingsOverlay/SettingsOverlay.module.css`
- Modify: `src/components/HelpModal/HelpModal.test.tsx` (assert size class)

- [ ] **Step 1: Write a failing test for the modal close size**

Append to `src/components/HelpModal/HelpModal.test.tsx` (adapt the existing render helper in that file to open the modal):

```tsx
it("renders the close button at the sm icon-button size", () => {
  // (use the file's existing setup to render the open modal)
  const close = screen.getByRole("button", { name: /close/i });
  expect(close.className).toMatch(/icon-button--sm/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/HelpModal/HelpModal.test.tsx`
Expected: FAIL — close button currently has only `icon-button` + local `help-modal-close`.

- [ ] **Step 3: Update the three components**

`HelpModal.tsx` (~line 58): add the size class to the close button:

```tsx
className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"], styles["help-modal-close"])}
```

In `HelpModal.module.css`, delete the `width`/`height` from `.help-modal-close.help-modal-close` (keep `box-shadow: none` if still desired).

`SettingsOverlay.tsx` (~line 100): same — add `sharedStyles["icon-button--sm"]`. In `SettingsOverlay.module.css`, delete the `width`/`height` from `.settings-overlay-close.settings-overlay-close`.

`AppHeader.tsx`: wrap each utility action button's className with the shared icon-button classes. Import shared styles (`import sharedStyles from "../shared/shared.module.css";`) and apply `clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"], styles["..."])` to the action buttons rendered inside `.app-header-actions`. In `AppHeader.module.css`, delete the bespoke `.app-header-actions button { width/height/border-radius }` rule (~lines 181–185); the icon-button classes now own size + round shape.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/components/HelpModal/HelpModal.test.tsx src/components/SettingsOverlay/SettingsOverlay.test.tsx src/components/AppHeader/AppHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Lint + commit**

```bash
pnpm run lint
git add src/components/AppHeader/ src/components/HelpModal/ src/components/SettingsOverlay/
git commit -m "style(chrome): align header actions + modal close buttons to icon-button--sm (32x32)"
```

---

### Task 7: Migrate SongControls toolbar/grouped/delete buttons to the surface composable

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx` (toolbar/grouped/delete button classNames)
- Modify: `src/components/SongControls/SongControls.module.css`

- [ ] **Step 1: Add a contract test**

Create `src/components/SongControls/SongControls.module.css.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "SongControls.module.css"), "utf8");

describe("SongControls button chrome", () => {
  it("toolbar + grouped buttons compose the control surface", () => {
    expect(css).toMatch(/\.toolbar-button\s*\{[^}]*composes:\s*surface--control/s);
    expect(css).toMatch(/\.grouped-button\s*\{[^}]*composes:\s*surface--control/s);
  });
  it("delete button uses the destructive tone modifier via class composition", () => {
    expect(css).toMatch(/\.delete-button\s*\{[^}]*composes:\s*surface--control\s+tone--destructive/s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/SongControls/SongControls.module.css.test.ts`
Expected: FAIL.

- [ ] **Step 3: Edit `SongControls.module.css`**

For `.toolbar-button` and `.grouped-button`, replace their local `var(--dc-bg)` / `var(--dc-border)` declarations with:

```css
.toolbar-button {
  composes: surface--control from "../shared/shared.module.css";
  /* keep existing layout props (padding, gap, font, etc.) */
}
.grouped-button {
  composes: surface--control from "../shared/shared.module.css";
  /* keep existing layout props */
}
```

For `.delete-button`, compose both the surface and the destructive tone (drop the local red rgba values):

```css
.delete-button {
  composes: surface--control tone--destructive from "../shared/shared.module.css";
  /* keep existing layout props */
}
```

Remove the now-dead `.delete-button:hover` red override if `.tone--destructive:hover` covers it; keep `.delete-button:disabled`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/components/SongControls/SongControls.module.css.test.ts src/components/SongControls/SongControls.test.tsx`
Expected: PASS

- [ ] **Step 5: Lint + commit**

```bash
pnpm run lint
git add src/components/SongControls/SongControls.tsx src/components/SongControls/SongControls.module.css src/components/SongControls/SongControls.module.css.test.ts
git commit -m "style(songcontrols): route toolbar/grouped/delete buttons through surface composable + destructive tone"
```

---

**Phase A checkpoint:** Run `pnpm run lint && pnpm run test && pnpm run build`. All green before starting Phase B. Visual snapshots are refreshed at the end (Task 16).

(Phase B tasks follow in the next section of this document.)

## Phase B — Chord-editor restructure

### Task 8: Create `packages/core/src/keyHarmony.ts` (root classification)

**Files:**
- Create: `packages/core/src/keyHarmony.ts`
- Create: `packages/core/src/keyHarmony.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/keyHarmony.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getScaleRoots, getHarmonyParentScale, type ScaleRootInfo } from "./keyHarmony";

function byClass(roots: ScaleRootInfo[], cls: ScaleRootInfo["rootClass"]) {
  return roots.filter((r) => r.rootClass === cls).map((r) => r.note);
}

describe("getHarmonyParentScale", () => {
  it("maps pentatonic/blues to their parent", () => {
    expect(getHarmonyParentScale("major pentatonic")).toBe("major");
    expect(getHarmonyParentScale("minor blues")).toBe("minor");
  });
  it("passes through 7-note scales", () => {
    expect(getHarmonyParentScale("dorian")).toBe("dorian");
  });
});

describe("getScaleRoots — C major", () => {
  const roots = getScaleRoots("major", "C");
  it("returns 12 notes ordered by offset", () => {
    expect(roots).toHaveLength(12);
    expect(roots[0]).toMatchObject({ note: "C", offset: 0, rootClass: "diatonic" });
  });
  it("classifies the 7 diatonic roots with their default quality", () => {
    expect(byClass(roots, "diatonic")).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(roots[5]).toMatchObject({ note: "A", defaultQuality: "m" }); // vi
    expect(roots[11]).toMatchObject({ note: "B", defaultQuality: "dim" }); // vii°
  });
  it("classifies the common borrowed roots (bIII, bVI, bVII)", () => {
    expect(byClass(roots, "borrowed").sort()).toEqual(["A#", "D#", "G#"].sort());
  });
  it("leaves the remaining notes chromatic", () => {
    expect(byClass(roots, "chromatic").sort()).toEqual(["C#", "F#"].sort());
  });
});

describe("getScaleRoots — major pentatonic routes through parent major", () => {
  it("matches the major-key classification", () => {
    const penta = getScaleRoots("major pentatonic", "C");
    const major = getScaleRoots("major", "C");
    expect(penta).toEqual(major);
  });
});

describe("getScaleRoots — modes pick the right parallel pool", () => {
  it("D dorian (minor-flavored) borrows from parallel major", () => {
    const roots = getScaleRoots("dorian", "D");
    expect(roots).toHaveLength(12);
    expect(roots.filter((r) => r.rootClass === "borrowed").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- packages/core/src/keyHarmony.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `packages/core/src/keyHarmony.ts`**

```ts
import * as Key from "@tonaljs/key";
import * as Mode from "@tonaljs/mode";
import * as Chord from "@tonaljs/chord";
import * as Note from "@tonaljs/note";
import { NOTES } from "./constants";
import { getDegreeSequence } from "./degrees";
import { getDiatonicChord } from "./theory";

/** Pentatonic/blues scales borrow their harmonic context from a parent scale. */
export const HARMONY_PARENT_SCALE: Record<string, string> = {
  "major pentatonic": "major",
  "major blues": "major",
  "minor pentatonic": "minor",
  "minor blues": "minor",
};

export function getHarmonyParentScale(scaleName: string): string {
  return HARMONY_PARENT_SCALE[scaleName] ?? scaleName;
}

export type RootClass = "diatonic" | "borrowed" | "chromatic";

export interface ScaleRootInfo {
  /** Sharps-form note name (FretFlow contract). */
  note: string;
  /** Semitone distance from the tonic, 0-11. */
  offset: number;
  rootClass: RootClass;
  /** FretFlow quality key for diatonic roots; null otherwise. */
  defaultQuality: string | null;
}

/** Which parallel key the scale borrows from: "minor" for major-flavored
 *  scales, "major" for minor-flavored, "both" for diminished-flavored. */
function parallelKeyFor(scaleName: string): "minor" | "major" | "both" {
  if (scaleName === "major" || scaleName === "ionian") return "minor";
  if (
    scaleName === "minor" ||
    scaleName === "aeolian" ||
    scaleName === "harmonic minor" ||
    scaleName === "melodic minor"
  ) {
    return "major";
  }
  const mode = Mode.get(scaleName);
  if (!mode.empty) {
    if (mode.triad === "M") return "minor";
    if (mode.triad === "m") return "major";
    return "both";
  }
  return "minor";
}

function chromaOffset(note: string, tonicChroma: number): number | null {
  const c = Note.chroma(note);
  if (c == null) return null;
  return ((c - tonicChroma) % 12 + 12) % 12;
}

function parallelRoots(parentScale: string, tonic: string): string[] {
  const which = parallelKeyFor(parentScale);
  const out: string[] = [];
  const collect = (chordNames: readonly string[] = []) => {
    for (const name of chordNames) {
      const t = Chord.get(name).tonic;
      if (t) out.push(t);
    }
  };
  if (which === "major" || which === "both") {
    collect(Key.majorKey(tonic).triads);
  }
  if (which === "minor" || which === "both") {
    const mk = Key.minorKey(tonic);
    collect(mk.natural?.triads);
    collect(mk.harmonic?.triads);
  }
  return out;
}

export function getScaleRoots(scaleName: string, tonicNote: string): ScaleRootInfo[] {
  const parent = getHarmonyParentScale(scaleName);
  const tonicChroma = Note.chroma(tonicNote) ?? 0;
  const tonicIdx = NOTES.indexOf(tonicNote);

  const diatonicQualityByOffset = new Map<number, string>();
  for (const degree of getDegreeSequence(parent)) {
    const chord = getDiatonicChord(degree, parent, tonicNote);
    if (!chord) continue;
    const off = chromaOffset(chord.root, tonicChroma);
    if (off != null && !diatonicQualityByOffset.has(off)) {
      diatonicQualityByOffset.set(off, chord.quality);
    }
  }

  const borrowedOffsets = new Set<number>();
  for (const root of parallelRoots(parent, tonicNote)) {
    const off = chromaOffset(root, tonicChroma);
    if (off != null && !diatonicQualityByOffset.has(off)) {
      borrowedOffsets.add(off);
    }
  }

  return Array.from({ length: 12 }, (_, offset): ScaleRootInfo => {
    const note = NOTES[(tonicIdx + offset) % 12];
    if (diatonicQualityByOffset.has(offset)) {
      return { note, offset, rootClass: "diatonic", defaultQuality: diatonicQualityByOffset.get(offset)! };
    }
    if (borrowedOffsets.has(offset)) {
      return { note, offset, rootClass: "borrowed", defaultQuality: null };
    }
    return { note, offset, rootClass: "chromatic", defaultQuality: null };
  });
}

/** Conventional harmonic-move names, keyed by quality-neutral chromatic numeral.
 *  Used to annotate borrowed-group options. Scale-agnostic; returns null for
 *  numerals without an established colloquial name. */
const HARMONIC_MOVES: Record<string, string> = {
  "bII": "Neapolitan",
  "bIII": "Mediant lift",
  "bVI": "Aeolian cadence",
  "bVII": "Modal cadence",
};

export function getHarmonicMoveAnnotation(plainNumeral: string): string | null {
  return HARMONIC_MOVES[plainNumeral] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- packages/core/src/keyHarmony.test.ts`
Expected: PASS. If the borrowed/chromatic note names differ in spelling (e.g. `Bb` vs `A#`), the test uses sharps-form (`A#`, `D#`, `G#`) because `getScaleRoots` derives names from `NOTES` (sharps) by offset — confirm the assertion matches.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/keyHarmony.ts packages/core/src/keyHarmony.test.ts
git commit -m "feat(core): add keyHarmony — Tonal-backed diatonic/borrowed/chromatic root classification"
```

---

### Task 8b: Export keyHarmony from core + dedupe the parent-scale map

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `src/progressions/progressionDomain.ts` (delete private `PROGRESSION_HARMONY_SCALE`, use core)

- [ ] **Step 1: Write a failing test for the dedupe**

Append to `src/progressions/progressionDomain.test.ts`:

```ts
import { getHarmonyParentScale } from "@fretflow/core";

describe("harmony parent-scale source of truth", () => {
  it("resolveProgressionStep uses the shared core parent map for pentatonic", () => {
    // C major pentatonic should resolve the I chord like C major does.
    const step = { id: "x", degree: "I", duration: { value: 1, unit: "bar" as const }, qualityOverride: null, manualRoot: null };
    const penta = resolveProgressionStep(step, "major pentatonic", "C");
    const major = resolveProgressionStep(step, "major", "C");
    expect(penta.root).toBe(major.root);
    expect(getHarmonyParentScale("major pentatonic")).toBe("major");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/progressions/progressionDomain.test.ts`
Expected: FAIL — `getHarmonyParentScale` not exported from `@fretflow/core`.

- [ ] **Step 3: Export from core + re-point the domain helper**

In `packages/core/src/index.ts` add:

```ts
export {
  getScaleRoots,
  getHarmonyParentScale,
  getHarmonicMoveAnnotation,
  HARMONY_PARENT_SCALE,
  type ScaleRootInfo,
  type RootClass,
} from "./keyHarmony";
```

In `src/progressions/progressionDomain.ts`, delete the private `PROGRESSION_HARMONY_SCALE` object and the local `getProgressionHarmonyScaleName` body; import and delegate:

```ts
import { getHarmonyParentScale } from "@fretflow/core";
// ...
function getProgressionHarmonyScaleName(scaleName: string): string {
  return getHarmonyParentScale(scaleName);
}
```

(Keep the local wrapper name so existing call sites are untouched.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/progressions/progressionDomain.test.ts`
Expected: PASS. Also run `pnpm run build` to confirm the core package re-exports resolve.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts src/progressions/progressionDomain.ts src/progressions/progressionDomain.test.ts
git commit -m "refactor(core): export keyHarmony; dedupe progression parent-scale map to single core source"
```

---

### Task 9: Chord-root dropdown option builder

**Files:**
- Create: `src/components/SongControls/chordRootOptions.ts`
- Create: `src/components/SongControls/chordRootOptions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/SongControls/chordRootOptions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildChordRootGroups } from "./chordRootOptions";

describe("buildChordRootGroups — C major", () => {
  const groups = buildChordRootGroups("major", "C", false);

  it("emits Diatonic, Borrowed, Chromatic groups in order", () => {
    expect(groups.map((g) => g.groupLabel)).toEqual(["Diatonic", "Borrowed", "Chromatic"]);
  });

  it("diatonic options carry numeral · note · quality-hint labels", () => {
    const diatonic = groups[0].options;
    expect(diatonic[0].label).toBe("I · C · maj");
    expect(diatonic.find((o) => o.value === "F")?.label).toBe("IV · F · maj");
    expect(diatonic.find((o) => o.value === "A")?.label).toBe("vi · A · min");
  });

  it("borrowed options append a harmonic-move annotation when known", () => {
    const borrowed = groups[1].options;
    const bVII = borrowed.find((o) => o.value === "A#");
    expect(bVII?.label).toContain("Modal cadence");
  });

  it("every value is a sharps-form note name", () => {
    const all = groups.flatMap((g) => g.options.map((o) => o.value));
    expect(all).toContain("C");
    expect(all).toContain("A#");
    expect(all).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/SongControls/chordRootOptions.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/components/SongControls/chordRootOptions.ts`**

```ts
import {
  getScaleRoots,
  getHarmonyParentScale,
  getHarmonicMoveAnnotation,
  getDegreesForScale,
  getNoteDisplay,
  formatAccidental,
  NOTES,
} from "@fretflow/core";
import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { guessQualityForBorrowedRoot, qualityShortForm } from "../../progressions/progressionDomain";

const QUALITY_HINT: Record<string, string> = { M: "maj", m: "min", dim: "dim", aug: "aug" };

// Quality-neutral chromatic numerals by semitone offset (lowercase = convention
// neutral). Diatonic-position offsets reuse the scale's own numeral map.
const FLAT_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "♭ii", 3: "♭iii", 6: "♭v", 8: "♭vi", 10: "♭vii",
};
const SHARP_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "♯i", 3: "♯ii", 6: "♯iv", 8: "♯v", 10: "♯vi",
};
// Plain (accidental-keyed, uppercase) numerals for annotation lookup.
const PLAIN_NUMERAL_BY_OFFSET: Record<number, string> = {
  1: "bII", 3: "bIII", 6: "bV", 8: "bVI", 10: "bVII",
};

function nonDiatonicNumeral(offset: number, preferFlats: boolean): string {
  const map = preferFlats ? FLAT_NUMERAL_BY_OFFSET : SHARP_NUMERAL_BY_OFFSET;
  return map[offset] ?? "";
}

export function buildChordRootGroups(
  scaleName: string,
  tonicNote: string,
  preferFlats: boolean,
): LabeledSelectGroup[] {
  const parent = getHarmonyParentScale(scaleName);
  const degreesMap = getDegreesForScale(parent);
  const roots = getScaleRoots(scaleName, tonicNote);

  const diatonic: LabeledSelectGroup["options"] = [];
  const borrowed: LabeledSelectGroup["options"] = [];
  const chromatic: LabeledSelectGroup["options"] = [];

  for (const r of roots) {
    const display = formatAccidental(getNoteDisplay(r.note, tonicNote, preferFlats));
    if (r.rootClass === "diatonic") {
      const numeral = degreesMap[r.offset] ?? "";
      const hint = QUALITY_HINT[r.defaultQuality ?? "M"] ?? r.defaultQuality ?? "";
      diatonic.push({ value: r.note, label: `${numeral} · ${display} · ${hint}` });
    } else if (r.rootClass === "borrowed") {
      const numeral = nonDiatonicNumeral(r.offset, preferFlats);
      const guessed = qualityShortForm(guessQualityForBorrowedRoot(r.note, scaleName, tonicNote)) || "maj";
      const move = getHarmonicMoveAnnotation(PLAIN_NUMERAL_BY_OFFSET[r.offset] ?? "");
      const suffix = move ? ` — ${move}` : "";
      borrowed.push({ value: r.note, label: `${numeral} · ${display} · ${guessed}${suffix}` });
    } else {
      const numeral = nonDiatonicNumeral(r.offset, preferFlats);
      chromatic.push({ value: r.note, label: `${numeral} · ${display}` });
    }
  }

  const groups: LabeledSelectGroup[] = [{ groupLabel: "Diatonic", options: diatonic }];
  if (borrowed.length) groups.push({ groupLabel: "Borrowed", options: borrowed });
  if (chromatic.length) groups.push({ groupLabel: "Chromatic", options: chromatic });
  return groups;
}

/** Classify a chosen root note (used by the selection handler to decide
 *  diatonic vs manual-root). */
export function classifyRoot(
  scaleName: string,
  tonicNote: string,
  note: string,
): { inScale: boolean; numeral: string } {
  const parent = getHarmonyParentScale(scaleName);
  const degreesMap = getDegreesForScale(parent);
  const roots = getScaleRoots(scaleName, tonicNote);
  const match = roots.find((r) => r.note === note);
  if (match?.rootClass === "diatonic") {
    return { inScale: true, numeral: degreesMap[match.offset] ?? "" };
  }
  const offset = match?.offset ?? ((NOTES.indexOf(note) - NOTES.indexOf(tonicNote) + 12) % 12);
  return { inScale: false, numeral: PLAIN_NUMERAL_BY_OFFSET[offset] ?? "" };
}
```

Note: confirm `formatAccidental`, `getNoteDisplay`, `getDegreesForScale`, and `NOTES` are exported from `@fretflow/core` (they are used by the existing `DegreeGrid`). If `qualityShortForm`/`guessQualityForBorrowedRoot` import from `progressionDomain` causes a cycle warning, they are pure functions and safe to import.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/components/SongControls/chordRootOptions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/chordRootOptions.ts src/components/SongControls/chordRootOptions.test.ts
git commit -m "feat(songcontrols): chord-root dropdown option builder (Diatonic/Borrowed/Chromatic)"
```

---

### Task 10: Quality dropdown — prepend the dynamic Diatonic group

**Files:**
- Modify: `src/components/SongControls/qualityGroups.ts`
- Modify: `src/components/SongControls/qualityGroups.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create or append `src/components/SongControls/qualityGroups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildQualityGroupsWithDiatonic } from "./qualityGroups";

const labels = {
  diatonic: "Diatonic",
  triads: "Triads",
  sus: "Sus",
  sixths: "Sixths",
  sevenths: "Sevenths",
};

describe("buildQualityGroupsWithDiatonic — in-key root", () => {
  const groups = buildQualityGroupsWithDiatonic("major", "C", "F", labels);
  it("puts Diatonic first with triad + seventh entries", () => {
    expect(groups[0].groupLabel).toBe("Diatonic");
    const vals = groups[0].options.map((o) => o.value);
    expect(vals).toContain("M");    // IV triad
    expect(vals).toContain("maj7"); // IV seventh
  });
  it("keeps the existing quality groups after Diatonic", () => {
    expect(groups.map((g) => g.groupLabel)).toEqual(
      ["Diatonic", "Triads", "Sus", "Sixths", "Sevenths"],
    );
  });
});

describe("buildQualityGroupsWithDiatonic — borrowed root falls back to guess", () => {
  it("uses the borrowed-quality guess for an out-of-scale root", () => {
    const groups = buildQualityGroupsWithDiatonic("major", "C", "A#", labels);
    expect(groups[0].groupLabel).toBe("Diatonic");
    expect(groups[0].options.map((o) => o.value)).toContain("M");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/components/SongControls/qualityGroups.test.ts`
Expected: FAIL — `buildQualityGroupsWithDiatonic` does not exist.

- [ ] **Step 3: Extend `src/components/SongControls/qualityGroups.ts`**

Add (keeping the existing `buildQualitySelectGroups`):

```ts
import { getScaleRoots, getHarmonyParentScale, getDiatonicChord, getDegreeSequence } from "@fretflow/core";
import { guessQualityForBorrowedRoot } from "../../progressions/progressionDomain";

const SEVENTH_FOR_TRIAD: Record<string, string> = {
  M: "maj7",
  m: "m7",
  dim: "m7b5",
  aug: "maj7",
};

export interface QualityGroupLabelsWithDiatonic extends QualityGroupLabels {
  diatonic: string;
}

/** Builds the quality groups with a leading "Diatonic" group reflecting the
 *  triad + seventh for the active root in the active scale. For out-of-scale
 *  roots it falls back to guessQualityForBorrowedRoot. Omits the Diatonic group
 *  when no quality can be derived. */
export function buildQualityGroupsWithDiatonic(
  scaleName: string,
  tonicNote: string,
  rootNote: string,
  labels: QualityGroupLabelsWithDiatonic,
): LabeledSelectGroup[] {
  const base = buildQualitySelectGroups(labels);

  const roots = getScaleRoots(scaleName, tonicNote);
  const match = roots.find((r) => r.note === rootNote);

  let triadQuality: string | null = null;
  if (match?.rootClass === "diatonic" && match.defaultQuality) {
    triadQuality = match.defaultQuality;
  } else {
    const guessed = guessQualityForBorrowedRoot(rootNote, scaleName, tonicNote);
    triadQuality = guessed || null;
  }
  if (!triadQuality) return base;

  const diatonicOptions = [
    { value: triadQuality, label: CHORD_TYPE_SHORT_LABELS[triadQuality] ?? triadQuality },
  ];
  const seventh = SEVENTH_FOR_TRIAD[triadQuality];
  if (seventh && seventh !== triadQuality) {
    diatonicOptions.push({ value: seventh, label: CHORD_TYPE_SHORT_LABELS[seventh] ?? seventh });
  }

  return [{ groupLabel: labels.diatonic, options: diatonicOptions }, ...base];
}
```

Add the import of `CHORD_TYPE_SHORT_LABELS` if not already present (it is imported at the top of the existing file).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/components/SongControls/qualityGroups.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SongControls/qualityGroups.ts src/components/SongControls/qualityGroups.test.ts
git commit -m "feat(songcontrols): prepend dynamic Diatonic group to the quality dropdown"
```

---

### Task 11: Add `qualityLockAtom` + `selectProgressionStepRootAtom`

**Files:**
- Modify: `src/store/progressionAtoms.ts`
- Create: `src/store/progressionRootSelection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/progressionRootSelection.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import {
  progressionStepsAtom,
  qualityLockAtom,
  selectProgressionStepRootAtom,
} from "./progressionAtoms";

function seed(store: ReturnType<typeof createStore>) {
  store.set(progressionStepsAtom, [
    { id: "s1", degree: "I", duration: { value: 1, unit: "bar" }, qualityOverride: "maj7", manualRoot: null },
  ]);
}

describe("selectProgressionStepRootAtom", () => {
  let store: ReturnType<typeof createStore>;
  beforeEach(() => {
    store = createStore();
    seed(store);
  });

  it("in-scale selection clears manualRoot, sets degree, clears qualityOverride (lock off)", () => {
    store.set(selectProgressionStepRootAtom, { id: "s1", root: "F", numeral: "IV", inScale: true });
    const step = store.get(progressionStepsAtom)[0];
    expect(step.manualRoot).toBeNull();
    expect(step.degree).toBe("IV");
    expect(step.qualityOverride).toBeNull();
  });

  it("borrowed selection sets manualRoot + cached numeral, clears qualityOverride (lock off)", () => {
    store.set(selectProgressionStepRootAtom, { id: "s1", root: "A#", numeral: "bVII", inScale: false });
    const step = store.get(progressionStepsAtom)[0];
    expect(step.manualRoot).toBe("A#");
    expect(step.degree).toBe("bVII");
    expect(step.qualityOverride).toBeNull();
  });

  it("preserves qualityOverride when the lock is on", () => {
    store.set(qualityLockAtom, true);
    store.set(selectProgressionStepRootAtom, { id: "s1", root: "G", numeral: "V", inScale: true });
    const step = store.get(progressionStepsAtom)[0];
    expect(step.qualityOverride).toBe("maj7");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/store/progressionRootSelection.test.ts`
Expected: FAIL — atoms do not exist.

- [ ] **Step 3: Add the atoms to `src/store/progressionAtoms.ts`**

```ts
/** Session-only: when true, changing a step's root preserves its
 *  qualityOverride (jazz/comping "color holds, root walks"). Not persisted. */
export const qualityLockAtom = atom(false);

/** Orchestrates a chord-root selection from the editor dropdown. In-scale
 *  selections revert to diatonic resolution (clear manualRoot, set degree);
 *  borrowed/chromatic selections pin manualRoot and cache the numeral as the
 *  degree hint. Clears qualityOverride unless qualityLockAtom is true. */
export const selectProgressionStepRootAtom = atom(
  null,
  (get, set, update: { id: string; root: string; numeral: string; inScale: boolean }) => {
    const locked = get(qualityLockAtom);
    set(
      progressionStepsAtom,
      get(progressionStepsAtom).map((step) => {
        if (step.id !== update.id) return step;
        const next = { ...step, degree: update.numeral };
        next.manualRoot = update.inScale ? null : update.root;
        if (!locked) next.qualityOverride = null;
        return next;
      }),
    );
  },
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/store/progressionRootSelection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/progressionAtoms.ts src/store/progressionRootSelection.test.ts
git commit -m "feat(store): add session-only qualityLockAtom + selectProgressionStepRootAtom"
```

---

### Task 12: Expose the new atom + lock via useProgressionState

**Files:**
- Modify: `src/hooks/useProgressionState.ts`

- [ ] **Step 1: Add the wiring (no separate test; covered by Task 13's component test)**

In `src/hooks/useProgressionState.ts`, add to the import list from `../store/progressionAtoms`: `qualityLockAtom`, `selectProgressionStepRootAtom`. Add to the returned object (after `updateProgressionStepQuality`):

```ts
    selectProgressionStepRoot: useSetAtom(selectProgressionStepRootAtom),
    qualityLock: useAtomValue(qualityLockAtom),
    setQualityLock: useSetAtom(qualityLockAtom),
```

Ensure `useAtomValue` is imported from `jotai` at the top of the file (add it if only `useSetAtom` is imported).

- [ ] **Step 2: Verify it compiles**

Run: `pnpm run build`
Expected: PASS (type-checks).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProgressionState.ts
git commit -m "feat(hooks): expose selectProgressionStepRoot + qualityLock via useProgressionState"
```

---

### Task 13: Rewrite the SongControls chord editor (root dropdown, quality + lock, pip nav)

**Files:**
- Modify: `src/components/SongControls/SongControls.tsx`
- Modify: `src/components/SongControls/SongControls.module.css` (delete `.pip-*` classes)
- Modify: `src/components/SongControls/SongControls.test.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`

- [ ] **Step 1: Add i18n strings**

In `src/i18n/en.ts` under `controls`, add: `qualityGroupDiatonic: "Diatonic"`, `lockQuality: "Lock quality"`, `lockQualityHint: "Keep this quality when changing the chord root"`, `chordRootLabel: "Chord root"`, `chordRootGroupDiatonic: "Diatonic"`, `chordRootGroupBorrowed: "Borrowed"`, `chordRootGroupChromatic: "Chromatic"`. Mirror in `src/i18n/es.ts` (translated). Add matching keys to `src/i18n/types.ts` if it enumerates keys.

- [ ] **Step 2: Write the failing component test**

Append to `src/components/SongControls/SongControls.test.tsx` (reuse the file's existing render helper that mounts `SongControls` with atoms):

```tsx
it("renders the chord root as a grouped dropdown (no DegreeGrid)", () => {
  // render via the file's existing helper
  expect(screen.queryByRole("group", { name: /chord root/i })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /chord root/i })).toBeInTheDocument();
});

it("renders a quality lock toggle", () => {
  expect(screen.getByRole("button", { name: /lock quality/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test -- src/components/SongControls/SongControls.test.tsx`
Expected: FAIL — DegreeGrid group still present; no combobox / lock button.

- [ ] **Step 4: Rewrite the editor body**

In `SongControls.tsx`:

1. Replace the `DegreeGrid` import with the builder + classifier:

```tsx
import { buildChordRootGroups, classifyRoot } from "./chordRootOptions";
import { buildQualityGroupsWithDiatonic } from "./qualityGroups";
import { Pin, PinOff } from "lucide-react";
```

2. Pull the new bits from `useProgressionState()`: add `selectProgressionStepRoot, qualityLock, setQualityLock` to the destructure (around line 122–140). Remove `updateProgressionStepRoot`/`updateProgressionStepDegree` usage in the editor body if no longer needed (keep the `updateProgressionStepRootAtom` import only if still used elsewhere — it is no longer used in the editor, so drop the `useSetAtom(updateProgressionStepRootAtom)` line at 142 and its import at 28).

3. Replace the `qualityGroups` memo to be root-aware:

```tsx
const activeRoot = activeResolvedProgressionStep?.root ?? rootNote;
const qualityGroups: LabeledSelectGroup[] = useMemo(
  () =>
    buildQualityGroupsWithDiatonic(scaleName, rootNote, activeRoot, {
      diatonic: t("controls.qualityGroupDiatonic"),
      triads: t("controls.qualityGroupTriads"),
      sus: t("controls.qualityGroupSus"),
      sixths: t("controls.qualityGroupSixths"),
      sevenths: t("controls.qualityGroupSevenths"),
    }),
  [scaleName, rootNote, activeRoot, t],
);

const chordRootGroups: LabeledSelectGroup[] = useMemo(
  () => buildChordRootGroups(scaleName, rootNote, preferFlats),
  [scaleName, rootNote, preferFlats],
);
```

4. Replace the `DegreeGrid` block (the `<div className={shared["control-section"]}>` wrapping `<DegreeGrid ... />`, ~lines 372–387) with:

```tsx
<div className={shared["control-section"]}>
  <span className={styles["field-label"]}>{t("controls.chordRootLabel")}</span>
  <LabeledSelect
    label={t("controls.chordRootLabel")}
    hideLabel
    width="fill"
    value={activeResolvedProgressionStep?.root ?? rootNote}
    groups={chordRootGroups}
    onChange={(note) => {
      const { inScale, numeral } = classifyRoot(scaleName, rootNote, note);
      selectProgressionStepRoot({ id: activeStep.id, root: note, numeral, inScale });
    }}
    data-testid="chord-root-select"
  />
</div>
```

5. Wrap the Quality field label + lock toggle. Replace the `<span className={styles["field-label"]}>Quality</span>` line with:

```tsx
<div className={styles["field-label-row"]}>
  <span className={styles["field-label"]}>{t("controls.quality")}</span>
  <button
    type="button"
    className={clsx(shared["icon-button"], shared["icon-button--sm"], styles["lock-toggle"])}
    onClick={() => setQualityLock(!qualityLock)}
    aria-pressed={qualityLock}
    aria-label={t("controls.lockQuality")}
    title={t("controls.lockQualityHint")}
  >
    {qualityLock ? <Pin size={14} aria-hidden="true" /> : <PinOff size={14} aria-hidden="true" />}
  </button>
</div>
```

Ensure `shared` (shared.module.css) is imported (it already is) and `clsx` is imported (add if missing).

6. Replace the pip-nav block (~lines 350–370) with the ToggleBar pip variant:

```tsx
<div className={styles["pip-nav-container"]}>
  <span className={styles["chords-label"]}>CHORDS</span>
  <ToggleBar
    variant="pip"
    label="Progression navigation"
    options={resolvedProgressionSteps.map((step, idx) => ({ value: idx, label: step.degree }))}
    value={activeProgressionStepIndex}
    onChange={setActiveProgressionStepIndex}
  />
</div>
```

(`ToggleBar` and `setActiveProgressionStepIndex` are already in scope.)

7. In `SongControls.module.css`, delete `.pip`, `.pip:hover`, `.pip:focus-visible`, `.pip.active-pip`, and `.pip-row`. Keep `.pip-nav-container` and `.chords-label`. Add a small layout rule:

```css
.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.lock-toggle {
  width: 1.75rem;
  height: 1.75rem;
}
```

- [ ] **Step 5: Run tests, lint, build, commit**

```bash
pnpm run test -- src/components/SongControls/SongControls.test.tsx
pnpm run lint && pnpm run build
git add src/components/SongControls/ src/i18n/
git commit -m "feat(songcontrols): replace DegreeGrid with grouped root dropdown; add quality lock + pip nav"
```

---

### Task 14: Delete the DegreeGrid component

**Files:**
- Delete: `src/components/shared/DegreeGrid.tsx`, `src/components/shared/DegreeGrid.module.css`, `src/components/shared/DegreeGrid.test.tsx`

- [ ] **Step 1: Confirm no remaining importers**

Run: `grep -rn "DegreeGrid" src/ packages/`
Expected: only matches inside the three files being deleted (and possibly stale snapshot text). If any other source file imports it, stop and resolve first.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/shared/DegreeGrid.tsx src/components/shared/DegreeGrid.module.css src/components/shared/DegreeGrid.test.tsx
```

- [ ] **Step 3: Run the full unit suite + build**

Run: `pnpm run test && pnpm run build`
Expected: PASS — no broken imports.

- [ ] **Step 4: Lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(songcontrols): remove DegreeGrid — superseded by the chord-root dropdown"
```

---

### Task 15: Refresh visual regression baselines

**Files:**
- Modify: committed snapshots under `e2e/` (darwin + linux)

- [ ] **Step 1: Build + run the visual suite to see the diffs**

Run: `pnpm run test:visual`
Expected: FAILs on the surfaces touched (toggle bars, dropdowns, steppers, modal close buttons, header actions, song editor). This is expected.

- [ ] **Step 2: Review diffs**

Inspect the Playwright diff report. Confirm every change is limited to the intended surfaces (control chrome legibility, 32px modal/header buttons, the new dropdown-based editor). Investigate anything outside those areas before updating.

- [ ] **Step 3: Update darwin baselines**

Run: `pnpm run test:visual:update`

- [ ] **Step 4: Update linux baselines**

Run: `pnpm run test:visual:update:linux`

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test(visual): refresh baselines for control-surface unification + chord-editor restructure"
```

---

## Self-review

**Spec coverage:**
- Surface composables + tone modifiers → Task 2. ✓
- Token re-tune + contract test → Task 1. ✓
- Icon-button size scale (sm/md/lg) → Task 3. ✓
- StepperShell / LabeledSelect migration → Task 4. ✓
- ToggleBar chip-through-surface + new pip variant → Task 5. ✓
- AppHeader + modal close → sm → Task 6. ✓
- Inspector toolbar/grouped/delete buttons → Task 7. ✓
- keyHarmony (Tonal-backed classification) → Task 8; export + dedupe → Task 8b. ✓
- Chord-root dropdown builder → Task 9. ✓
- Quality Diatonic group (in-key triad+seventh; borrowed guess fallback) → Task 10. ✓
- qualityLock (session-only) + root-driven default → Tasks 11–12. ✓
- SongControls rewrite (root dropdown, quality+lock, pip nav) → Task 13. ✓
- DegreeGrid deletion → Task 14. ✓
- Terminology (Diatonic/Borrowed/Chromatic) → Tasks 9, 13 (i18n). ✓
- Visual snapshot refresh → Task 15. ✓

**Type consistency:**
- `ScaleRootInfo` shape used identically in Tasks 8/9/10.
- `selectProgressionStepRootAtom` payload `{ id, root, numeral, inScale }` matches between Task 11 (definition) and Task 13 (call site via `classifyRoot` returning `{ inScale, numeral }`).
- `buildQualityGroupsWithDiatonic(scaleName, tonicNote, rootNote, labels)` signature matches between Task 10 and Task 13.
- `buildChordRootGroups(scaleName, tonicNote, preferFlats)` matches between Task 9 and Task 13.

**Out of scope (Phase 2, not in this plan):** Extensions/Altered quality groups + audio-engine support, mode-specific borrowed curation, pentatonic in-pentatonic badge, secondary-dominant/tritone-sub surfacing.
