# Reduce LCP Render Delay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut initial-bundle LCP render delay from ~737ms by deferring non-essential UI components (`Inspector`, `StatusBar`, `ProgressionSummarySlot`) from eager static imports to `React.lazy` dynamic imports, while keeping all Suspense boundaries and fallbacks already in place.

**Architecture:** Three statically-imported components that are not visible on first paint are switched to `React.lazy`. All three are already wrapped in `<Suspense>` with proper fallbacks — the lazy boundary infrastructure is in place and just needs the code-split trigger. The `integration.test.tsx` pre-imports must be updated to point at the lazy-wrapped module paths.

**Tech Stack:** React 19 `lazy` + Vite dynamic `import()`, currently used for `SettingsOverlay` and `HelpModal`. Named exports use the `.then((m) => ({ default: m.Name }))` pattern.

**Files touched:**
- `src/App.tsx` — add 3 `lazy()` declarations, remove 3 static imports
- `src/integration.test.tsx` — update pre-import for Inspector lazy path

---

### Task 1: Lazy-load `Inspector`

- [ ] **Step 1: Add `lazy` import and remove static import in `App.tsx`**

Replace the static import on line 23 and add a `lazy()` declaration alongside the existing ones (lines 35-38).

```typescript
// REMOVE line 23:
// import { Inspector } from "./components/Inspector/Inspector";

// ADD after line 38 (after HelpModal lazy):
const Inspector = lazy(() =>
  import("./components/Inspector/Inspector").then((m) => ({ default: m.Inspector }))
);
```

- [ ] **Step 2: Update the test pre-import in `integration.test.tsx`**

The test on line 9 pre-imports the component so `React.lazy` resolves synchronously. The static import path is fine as-is — it pre-warms the module cache before the `lazy()` resolver runs. No change needed.

- [ ] **Step 3: Run tests to verify**

Run: `pnpm run test`
Expected: All tests pass. The existing Suspense boundaries (lines 202-204, 207-209) handle loading state.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load Inspector component to reduce initial bundle size"
```

---

### Task 2: Lazy-load `StatusBar`

- [ ] **Step 1: Add `lazy` import and remove static import in `App.tsx`**

Replace the static import on line 25 and add a `lazy()` declaration.

```typescript
// REMOVE line 25:
// import { StatusBar } from "./components/StatusBar/StatusBar";

// ADD after the Inspector lazy declaration:
const StatusBar = lazy(() =>
  import("./components/StatusBar/StatusBar").then((m) => ({ default: m.StatusBar }))
);
```

`StatusBar` is rendered at line 191 inside `MainLayoutWrapper` without a `Suspense` boundary. Since `statusBar` is a `ReactNode` prop, the parent needs to wrap it.

- [ ] **Step 2: Wrap `StatusBar` in a Suspense boundary in `App.tsx`**

```typescript
// Line 191: replace:
//   statusBar={<StatusBar />}
// with:
statusBar={
  <Suspense fallback={null}>
    <StatusBar />
  </Suspense>
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load StatusBar component to reduce initial bundle size"
```

---

### Task 3: Lazy-load `ProgressionSummarySlot`

- [ ] **Step 1: Add `lazy` import and remove static import in `App.tsx`**

Replace the static import on line 26 and add a `lazy()` declaration.

```typescript
// REMOVE line 26:
// import { ProgressionSummarySlot } from "./components/ProgressionSummarySlot/ProgressionSummarySlot";

// ADD after the StatusBar lazy declaration:
const ProgressionSummarySlot = lazy(() =>
  import("./components/ProgressionSummarySlot/ProgressionSummarySlot").then((m) => ({ default: m.ProgressionSummarySlot }))
);
```

`ProgressionSummarySlot` is rendered at line 190 inside `MainLayoutWrapper` as a `ReactNode` prop without a `Suspense` boundary.

- [ ] **Step 2: Wrap `ProgressionSummarySlot` in a Suspense boundary in `App.tsx`**

```typescript
// Line 190: replace:
//   summary={<ProgressionSummarySlot />}
// with:
summary={
  <Suspense fallback={null}>
    <ProgressionSummarySlot />
  </Suspense>
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load ProgressionSummarySlot to reduce initial bundle size"
```

---

### Task 4: Verify build output

- [ ] **Step 1: Run production build and check chunk splitting**

```bash
pnpm run build
```

Expected: Build succeeds. The output shows separate chunks for `Inspector`, `StatusBar`, and `ProgressionSummarySlot` alongside the existing `SettingsOverlay` and `HelpModal` lazy chunks.

- [ ] **Step 2: Run lint**

```bash
pnpm run lint
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify production build with lazy-loaded components"
```
