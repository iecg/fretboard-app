# Storage Validator Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three tiny validator factories (`stringValidator`, `numberValidator`, `enumValidator`) to `src/utils/storage.ts` and collapse inline `typeof v === …` predicates at the four current `validate:` call sites. Net change: ~10–20 LOC reduction plus a clearer convention for future atoms.

**Architecture:** Investigation found only 4 inline-validator call sites, not "dozens" — the codebase already routes most persistence through `createStorage`, `booleanStorage`, and `constrainedNumberStorage`. The factories therefore double as future-proofing: any new `validate:` inlined as `typeof v === "string"` (etc.) should use a factory. The plan keeps `booleanStorage`/`constrainedNumberStorage` as-is — they're already idiomatic — and only adds the three missing primitives.

**Tech Stack:** TypeScript, Jotai, vitest.

---

## File Structure

- Modify: `src/utils/storage.ts` — add 3 exported helpers (`stringValidator`, `numberValidator`, `enumValidator`)
- Create: `src/utils/storage.test.ts` — unit tests for the new helpers (or extend an existing test file if found)
- Modify: `src/store/progressionAtoms.ts` — replace 3 inline validators (lines 42, 55, 126)
- Modify: `src/store/chordOverlayAtoms.ts` — replace 1 inline validator (line 103)

---

### Task 1: Add `stringValidator`

**Files:**
- Modify: `src/utils/storage.ts`
- Create or modify: `src/utils/storage.test.ts`

- [ ] **Step 1: Check if `src/utils/storage.test.ts` exists**

Run: `ls src/utils/storage.test.ts 2>/dev/null && echo EXISTS || echo MISSING`

If MISSING, create it with this header:

```ts
import { describe, it, expect } from "vitest";
```

- [ ] **Step 2: Write the failing test**

Append:

```ts
import { stringValidator } from "./storage";

describe("stringValidator", () => {
  const isStr = stringValidator();
  it("accepts strings", () => expect(isStr("hello")).toBe(true));
  it("accepts empty strings", () => expect(isStr("")).toBe(true));
  it("rejects non-strings", () => {
    expect(isStr(1)).toBe(false);
    expect(isStr(null)).toBe(false);
    expect(isStr(undefined)).toBe(false);
    expect(isStr({})).toBe(false);
  });
  it("supports nullable variant", () => {
    const nullable = stringValidator({ nullable: true });
    expect(nullable(null)).toBe(true);
    expect(nullable("x")).toBe(true);
    expect(nullable(1)).toBe(false);
  });
});
```

- [ ] **Step 3: Verify failure**

Run: `pnpm vitest run src/utils/storage.test.ts`
Expected: FAIL — `stringValidator` not exported.

- [ ] **Step 4: Implement**

Append to `src/utils/storage.ts`:

```ts
export function stringValidator(opts: { nullable?: boolean } = {}) {
  return (v: unknown): v is string | null =>
    typeof v === "string" || (opts.nullable === true && v === null);
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/utils/storage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/storage.ts src/utils/storage.test.ts
git commit -m "feat(storage): add stringValidator helper"
```

---

### Task 2: Add `numberValidator`

**Files:**
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/utils/storage.test.ts`:

```ts
import { numberValidator } from "./storage";

describe("numberValidator", () => {
  it("accepts finite numbers by default", () => {
    const isNum = numberValidator();
    expect(isNum(0)).toBe(true);
    expect(isNum(-1.5)).toBe(true);
    expect(isNum(NaN)).toBe(false);
    expect(isNum(Infinity)).toBe(false);
    expect(isNum("1")).toBe(false);
  });
  it("supports an additional guard", () => {
    const isPositiveInt = numberValidator((n) => Number.isInteger(n) && n > 0);
    expect(isPositiveInt(3)).toBe(true);
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm vitest run src/utils/storage.test.ts`
Expected: FAIL — `numberValidator` not exported.

- [ ] **Step 3: Implement**

Append to `src/utils/storage.ts`:

```ts
export function numberValidator(guard?: (n: number) => boolean) {
  return (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && (guard ? guard(v) : true);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/utils/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.ts src/utils/storage.test.ts
git commit -m "feat(storage): add numberValidator helper"
```

---

### Task 3: Add `enumValidator`

**Files:**
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { enumValidator } from "./storage";

describe("enumValidator", () => {
  const isDirection = enumValidator(["up", "down"] as const);
  it("accepts members", () => {
    expect(isDirection("up")).toBe(true);
    expect(isDirection("down")).toBe(true);
  });
  it("rejects non-members", () => {
    expect(isDirection("left")).toBe(false);
    expect(isDirection(1)).toBe(false);
    expect(isDirection(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm vitest run src/utils/storage.test.ts`
Expected: FAIL — `enumValidator` not exported.

- [ ] **Step 3: Implement**

Append:

```ts
export function enumValidator<const T extends readonly (string | number)[]>(
  values: T,
) {
  const set = new Set<T[number]>(values);
  return (v: unknown): v is T[number] => set.has(v as T[number]);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/utils/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.ts src/utils/storage.test.ts
git commit -m "feat(storage): add enumValidator helper"
```

---

### Task 4: Migrate `progressionAtoms.ts:55` (string validator)

**Files:**
- Modify: `src/store/progressionAtoms.ts:55`

- [ ] **Step 1: Read the call site**

Open `src/store/progressionAtoms.ts` at lines 50–60. Identify the `validate: (v): v is string => typeof v === "string"` predicate inside the `stringStorage` factory call.

- [ ] **Step 2: Replace**

Add to the imports at the top of the file (or extend the existing `src/utils/storage` import):

```ts
import { stringValidator } from "../utils/storage";
```

Replace `validate: (v): v is string => typeof v === "string",` with:

```ts
validate: stringValidator(),
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/store/progressionAtoms.test.ts` (or the closest test file if it has a different name).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/progressionAtoms.ts
git commit -m "refactor(progressionAtoms): use stringValidator at stringStorage"
```

---

### Task 5: Migrate `progressionAtoms.ts:42` (number + guard)

**Files:**
- Modify: `src/store/progressionAtoms.ts:42`

- [ ] **Step 1: Read the call site**

Open lines 38–48. Identify `validate: (v): v is number => typeof v === "number" && isBeatsPerBar(v)`.

- [ ] **Step 2: Replace**

Add `numberValidator` to the imports (combine with the import added in Task 4). Replace the predicate with:

```ts
validate: numberValidator(isBeatsPerBar),
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/store/progressionAtoms`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/progressionAtoms.ts
git commit -m "refactor(progressionAtoms): use numberValidator at beatsPerBarStorage"
```

---

### Task 6: Migrate `progressionAtoms.ts:126` (boolean — leave as `booleanStorage`)

**Files:**
- Modify: `src/store/progressionAtoms.ts:120-130`

- [ ] **Step 1: Read the call site**

Open lines 120–130. Find the `chordEnabledStorage` definition that uses `validate: (v) => typeof v === "boolean"`.

- [ ] **Step 2: Decide replacement**

If the surrounding `createStorage<boolean>` call is otherwise identical to the existing `booleanStorage` constant (lines 190–198 of `storage.ts`), replace the whole adapter with `booleanStorage` (import it). Otherwise, leave the predicate alone — booleans are already a one-token check and don't benefit from a wrapping factory.

- [ ] **Step 3: Apply chosen replacement**

If using `booleanStorage`: import it and assign `const chordEnabledStorage = booleanStorage;` (or use it directly at the `atomWithStorage` call site).

If leaving as-is: skip this task entirely and move on. Skipping is acceptable — boolean is already minimal.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/store/progressionAtoms`
Expected: PASS.

- [ ] **Step 5: Commit (only if a change was made)**

```bash
git add src/store/progressionAtoms.ts
git commit -m "refactor(progressionAtoms): reuse booleanStorage for chordEnabled"
```

---

### Task 7: Migrate `chordOverlayAtoms.ts:103` (nullable string)

**Files:**
- Modify: `src/store/chordOverlayAtoms.ts:103`

- [ ] **Step 1: Read the call site**

Open lines 98–108. Identify the `v === null || typeof v === "string"` predicate.

- [ ] **Step 2: Replace**

Add `stringValidator` to the imports. Replace the predicate with:

```ts
validate: stringValidator({ nullable: true }),
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/store/chordOverlayAtoms`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/chordOverlayAtoms.ts
git commit -m "refactor(chordOverlayAtoms): use stringValidator (nullable) helper"
```

---

### Task 8: Full verification

- [ ] **Step 1: Lint + test + build**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: all green.

- [ ] **Step 2: Audit for missed inline validators**

Run:
```bash
grep -rn 'typeof v === "string"\|typeof v === "number"\|typeof v === "boolean"' src/store src/utils
```
Expected: only the new helper definitions (in `src/utils/storage.ts`) and `booleanStorage` should match. Any remaining `src/store/*` hit means an unmigrated site — handle it in this PR or note it for follow-up.
