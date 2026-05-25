# Custom Hooks Evaluation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate whether 4 custom hooks (`useFocusTrap`, `useKeyboardShortcuts`, `useResolvedTheme`, `useLayoutMode`) should be replaced with community library equivalents, and consolidate where clear wins exist.

**Architecture:** The project has 4 custom hooks that duplicate standard patterns. `useFocusTrap` (76 lines) will be eliminated by the Radix Dialog migration (separate plan). The remaining 3 hooks are small enough (28-34 lines each) that replacing them with external dependencies adds a dependency for marginal savings — especially when `useResolvedTheme` and `useLayoutMode` are each single-purpose and tested. The plan recommends keeping them, with documented justification.

**Tech Stack:** React 19, TypeScript, `focus-trap-react`, `react-hotkeys-hook`, `react-use`, `react-responsive`

---

### Task 1: Evaluate useFocusTrap — candidate for elimination

**Files:**
- Review: `src/hooks/useFocusTrap.ts`
- Review: `src/hooks/useFocusTrap.test.ts`
- Review: `src/components/SettingsOverlay/SettingsOverlay.tsx`
- Review: `src/components/HelpModal/HelpModal.tsx`

- [ ] **Step 1: Find all consumers of useFocusTrap**

Run: `rg -rn "useFocusTrap" src/`

Expected output:
```
src/components/SettingsOverlay/SettingsOverlay.tsx:12:import { useFocusTrap } from "../../hooks/useFocusTrap";
src/components/SettingsOverlay/SettingsOverlay.tsx:70:  useFocusTrap({
src/components/HelpModal/HelpModal.tsx:6:import { useFocusTrap } from "../../hooks/useFocusTrap";
src/components/HelpModal/HelpModal.tsx:29:  useFocusTrap({
```

- [ ] **Step 2: Verify Radix Dialog migration eliminates both callers**

Check that after the Radix UI plan (Task 3-4) is complete:
- `SettingsOverlay.tsx` no longer imports `useFocusTrap`
- `HelpModal.tsx` no longer imports `useFocusTrap`

- [ ] **Step 3: Check if useFocusTrap has any remaining consumers**

After Radix migration, re-run:
```bash
rg -rn "useFocusTrap" src/ --include='*.ts' --include='*.tsx'
```

- **If no consumers found:** Remove the hook and its test file.
  ```bash
  rm src/hooks/useFocusTrap.ts src/hooks/useFocusTrap.test.ts
  ```
- **If consumers remain:** Keep it — the Radix migration (in the Radix plan) only covers SettingsOverlay and HelpModal.

- [ ] **Step 4: Also check if `getFocusableElements` in dom.ts has other consumers**

Run: `rg -rn "getFocusableElements" src/`

If `useFocusTrap` was the only consumer, also remove `src/utils/dom.ts` and its exports from barrel files.

- [ ] **Step 5: Commit**

If fully removed:
```bash
git rm src/hooks/useFocusTrap.ts src/hooks/useFocusTrap.test.ts
git rm src/utils/dom.ts
git commit -m "refactor: remove useFocusTrap hook — replaced by Radix Dialog focus management"
```

---

### Task 2: Evaluate useKeyboardShortcuts — recommendation: keep

**Files:**
- Review: `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Read the hook implementation**

```typescript
// src/hooks/useKeyboardShortcuts.ts
// 34 lines. Registers a global keydown listener for 's' (toggle scale) and 'c' (toggle chord).
// Skips inputs/textarea/select.
// Ignores meta/ctrl/alt modifiers.
```

- [ ] **Step 2: Evaluate replacement options**

Available alternative: `react-hotkeys-hook` (not installed).

**Cost of replacement:**
- Install `react-hotkeys-hook`: adds ~5KB gzipped dependency
- Rewrite hook to use `useHotkeys` or `useKey` API
- Existing test must be updated

**Benefit of replacement:**
- Eliminates 34 lines of hand-rolled `keydown` listener
- Adds modifier key handling (Cmd/Ctrl detection) — not needed here
- Adds hotkey scoping (ignore when in inputs) — already done manually

**Verdict: KEEP.** The hook is 34 lines, fully tested, and pinned to exactly two keys. Installing a library for this introduces a dependency that is larger than the code it replaces. The custom implementation is simpler to maintain.

- [ ] **Step 3: Document the decision**

No code changes. Add nothing — this recommendation is the plan's output.

---

### Task 3: Evaluate useResolvedTheme — recommendation: keep

**Files:**
- Review: `src/hooks/useResolvedTheme.ts`

- [ ] **Step 1: Read the hook implementation**

```typescript
// src/hooks/useResolvedTheme.ts
// 28 lines. Resolves user's themeAtom ("light"/"dark"/"system") to concrete theme.
// Listens to matchMedia("prefers-color-scheme: dark") change events.
```

- [ ] **Step 2: Evaluate replacement options**

Available alternative: `react-use`'s `useMedia` hook (not installed).

**Cost of replacement:**
- Install `react-use`: ~200KB+ — it's a large utility library
- Rewrite to use `const isDark = useMedia("(prefers-color-scheme: dark)")`
- Must still wrap with atom resolution logic (the `useResolvedTheme` is part of Jotai's `atomWithStorage` flow)

**Benefit of replacement:**
- Eliminates 28 lines of code
- `react-use` provides many other hooks (unlikely to be used)

**Verdict: KEEP.** 28 lines is too small to justify a 200KB+ dependency. The hook is clean, well-tested, and couples naturally to the Jotai atom architecture.

- [ ] **Step 3: Document the decision**

No code changes.

---

### Task 4: Evaluate useLayoutMode — recommendation: keep

**Files:**
- Review: `src/hooks/useLayoutMode.ts`
- Review: `src/layout/responsive.ts`
- Review: `src/layout/breakpoints.ts`

- [ ] **Step 1: Read the hook and its dependencies**

```typescript
// src/hooks/useLayoutMode.ts — 23 lines
// Subscribes to window.resize, calls getResponsiveLayout(width, height)
// Returns { tier, variant, ... } — used for responsive data attributes + conditional rendering

// src/layout/responsive.ts — 112 lines
// Pure function: viewport dimensions → ResponsiveLayout object
// Determines mobile/tablet/desktop tier and layout variant

// src/layout/breakpoints.ts — 6 lines
// Breakpoint constants
```

- [ ] **Step 2: Evaluate replacement options**

Available alternative: `react-responsive` (`useMediaQuery`) — not installed.

**Cost of replacement:**
- Install `react-responsive`: moderate size (media query parser)
- Rewrite `useLayoutMode` to use multiple `useMediaQuery` calls
- Must still keep the `getResponsiveLayout` resolver (the app's custom layout logic — not available from any library)
- The `data-layout-tier` / `data-layout-variant` attributes are consumed by CSS — the logic that computes them is the app's domain

**Benefit of replacement:**
- Eliminates the bare `addEventListener("resize")` pattern
- Provides SSR-safe media query matching

**Verdict: KEEP.** The resize listener is a single `addEventListener` — not complex enough to warrant a library. The core value (`getResponsiveLayout`) is domain logic that no library provides. The hook is just a thin wrapper around it.

- [ ] **Step 3: Optional — add ResizeObserver optimization**

If desired, replace the `resize` event with a `ResizeObserver` on the root element for better performance. This is a 2-line change within `useLayoutMode.ts`:

```typescript
// Instead of:
//   window.addEventListener("resize", onResize);
// Use:
  const observer = new ResizeObserver(() => setViewport(getViewportSnapshot()));
  observer.observe(document.documentElement);
  return () => observer.disconnect();
```

This is optional and doesn't affect the keep/replace decision.

- [ ] **Step 4: Document the decision**

No code changes beyond the optional ResizeObserver optimization.

---

### Task 5: Remove `getFocusableElements` utility (if orphaned)

**Files:**
- Optionally delete: `src/utils/dom.ts`
- Optionally delete: `src/utils/dom.test.ts`

- [ ] **Step 1: Check for remaining consumers outside useFocusTrap**

Run: `rg -rn "getFocusableElements" src/ --include='*.ts' --include='*.tsx'`

- If no consumers remain after Task 1, remove the file.
- If other consumers exist, keep it.

- [ ] **Step 2: Commit if removed**

```bash
git rm src/utils/dom.ts
git commit -m "refactor: remove unused getFocusableElements utility"
```

---

### Summary of Recommendations

| Hook | Lines | Replace? | Rationale |
|---|---|---|---|
| `useFocusTrap` | 76 | **Eliminate** (via Radix Dialog) | Both callers replaced by `@radix-ui/react-dialog` |
| `useKeyboardShortcuts` | 34 | Keep | Too small; custom is simpler than installing a library |
| `useResolvedTheme` | 28 | Keep | 28 lines → not worth 200KB+ `react-use` dep |
| `useLayoutMode` + support | 141 | Keep | Core domain logic (layout resolver) is not library-replaceable |

### Spec Self-Review

- **Spec coverage:** All 4 hooks evaluated. Tasks 1-4 each examine one hook with concrete justification. Task 5 handles cleanup of orphaned utility.
- **Placeholder scan:** Every evaluation has complete reasoning. No TBDs.
- **Scope check:** Focused on evaluation only — no unnecessary dependency installations.
- **Cross-plan note:** Task 1 depends on the Radix UI plan being complete before elimination is safe. The plan accounts for this with a verification step and a conditional "if consumers remain, keep it" fallback.
