# Storage Migration Strategy

This document describes the canonical pattern for handling storage migrations in the Jotai store.

## Overview

Storage migrations enable the app to evolve data formats over time while maintaining backward compatibility. The pattern used here leverages Jotai's `atomWithStorage` hook with a `createStorage` factory that provides consistent error handling and migration lifecycle hooks.

## Key Concepts

### Storage Prefix

All persisted keys are prefixed with `"fretflow:"` to namespace app data and avoid collisions:

```ts
import { k, STORAGE_PREFIX } from "../utils/storage";

k("rootNote")        // → "fretflow:rootNote"
k("scaleName")       // → "fretflow:scaleName"
```

The `k()` function is the canonical way to generate storage keys. It ensures consistency across atoms and makes it easy to reference keys in migrations.

### Legacy Keys

Keys that lack the `"fretflow:"` prefix are considered legacy. The storage module automatically migrates these on app load via `migrateLegacyKeys()` in `src/utils/storage.ts`.

**Legacy keys tracked in `LEGACY_KEYS` constant:**

```ts
export const LEGACY_KEYS = [
  "rootNote",
  "scaleName",
  "chordRoot",
  "chordType",
  "linkChordRoot",
  // ... others
];
```

When the app boots, any legacy key is moved to its prefixed equivalent:
- If the prefixed version already exists, the legacy key is removed (prefixed takes precedence).
- If the prefixed version doesn't exist, the legacy value is copied to the prefixed key, then the legacy key is removed.
- This happens **only if the write is observable** — if the write fails, the legacy key is retained to prevent data loss.

## The Canonical Pattern

### Step 1: Define a Storage Config

Use `createStorage<T>()` to define how to serialize, deserialize, validate, and migrate a value:

```ts
const practiceLensStorage = createStorage<PracticeLens>({
  // Validate the deserialized value
  validate: (v) => (PRACTICE_LENS_VALUES as string[]).includes(v),
  
  // Migrate from legacy format (only runs on first access if key doesn't exist)
  migrate: () => {
    const oldViewMode =
      readLocalStorage(k("viewMode")) ?? readLocalStorage("viewMode");
    if (oldViewMode) return migrateViewModeToLens(oldViewMode);
    return undefined;
  },
});
```

### Step 2: Create the Atom

Use `atomWithStorage` with the storage config and the `GET_ON_INIT` flag:

```ts
import { atomWithStorage } from "jotai/utils";
import { GET_ON_INIT } from "../utils/storage";

export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "targets",                    // fallback default value
  practiceLensStorage,          // storage config
  GET_ON_INIT,                  // sync read on initialization
);
```

**Why `GET_ON_INIT`?** It prevents a visual flash when the app first renders. Without it, the atom would use the default value until a subsequent effect re-reads localStorage.

### Step 3: Implement Migration Logic

Migrations run inside the `migrate()` callback. They must:
- **Not subscribe to atoms** — migrate callbacks are pure functions with no access to Jotai state
- Use `readLocalStorage()` helper to safely read raw localStorage values
- Return `undefined` if no migration applies, so the fallback default is used

**Safe localStorage reading:**

```ts
/**
 * Helper: read a raw localStorage string value without subscribing to atoms.
 * Used inside migrate() callbacks where atom subscriptions are not allowed.
 */
function readLocalStorage(key: string): string | null {
  const raw = withStorageErrorBoundary<string | null>(key, null).getRaw();
  if (raw === null) return null;
  return raw === "" ? null : raw;
}
```

Always use `readLocalStorage()` inside migrations — never call `localStorage.getItem()` directly.

## Real-World Examples

### Example 1: Simple Enum Migration (`uiAtoms.ts`)

Migrate old tab names to new ones using `onRead`:

```ts
const mobileTabStorage = createStorage<MobileTab>({
  validate: (v) => (MOBILE_TABS as readonly string[]).includes(v),
  
  onRead: (v) => {
    // Normalize legacy values on every read
    if (v === ("key" as unknown as string) || 
        v === ("scale" as unknown as string) || 
        v === ("theory" as unknown as string)) {
      return "scales";
    }
    if (v === ("settings" as unknown as string) || 
        v === ("fretboard" as unknown as string)) {
      return "view";
    }
    return v;
  },
});
```

**When to use `onRead`:** When you need normalization on every read (e.g., enum renames, simple transformations).

### Example 2: Complex Cross-Atom Migration (`chordOverlayAtoms.ts`)

Migrate from legacy chord state to a new degree-based system:

```ts
const chordDegreeStorage = createStorage<DegreeId | null>({
  serialize: (v) => v ?? "",
  deserialize: (v) => (v === "" ? null : (v as DegreeId)),
  validate: (v) => v === null || typeof v === "string",
  
  migrate: (): DegreeId | null | undefined => {
    const chordType = readLocalStorage(k("chordType"));
    
    // (a) No legacy chord — use default
    if (!chordType) return undefined;
    
    // (b) Only diatonic triads can be inferred; others fall back to manual mode
    if (!DIATONIC_TRIAD_QUALITIES.has(chordType)) return undefined;
    
    // (c) Read all required legacy state (no atom subscriptions!)
    const chordRoot = readLocalStorage(k("chordRoot")) ?? "C";
    const tonicNote = readLocalStorage(k("rootNote")) ?? "C";
    const scaleName = readLocalStorage(k("scaleName")) ?? "Major";
    
    // (d) Compute the degree from root + tonic
    const tonicIdx = NOTES.indexOf(tonicNote);
    const rootIdx = NOTES.indexOf(chordRoot);
    if (tonicIdx === -1 || rootIdx === -1) return undefined;
    
    const semitone = (rootIdx - tonicIdx + 12) % 12;
    const degreesMap = getDegreesForScale(scaleName);
    const degreeId = degreesMap[semitone] as DegreeId | undefined;
    if (!degreeId) return undefined;
    
    // (e) Validate: the diatonic quality must match exactly
    const expectedQuality = getQualityForDegree(degreeId, scaleName);
    if (expectedQuality !== chordType) return undefined;
    
    return degreeId;
  },
});
```

**When to use `migrate`:** When you need one-time initialization logic that may require cross-atom lookups or complex computation.

### Example 3: Boolean Coercion (hypothetical)

Migrate from legacy boolean storage to a string-enum value:

```ts
type DisplayDensityMode = "auto" | "compact" | "comfortable";

const displayDensityStorage = createStorage<DisplayDensityMode>({
  validate: (v) => ["auto", "compact", "comfortable"].includes(v as string),

  onRead: (v: unknown) => {
    // Coerce old boolean values stored under the same key.
    if (v === true || v === "true") return "compact";
    if (v === false || v === "false") return "auto";
    return v as DisplayDensityMode;
  },
});
```

## Storage Options Reference

`createStorage<T>()` accepts the following options:

```ts
interface StorageOptions<T> {
  // Serialize value to string before writing to localStorage
  serialize?: (value: T) => string;
  
  // Deserialize string from localStorage back to T
  deserialize?: (value: string) => T;
  
  // Validate the deserialized value (return false to use default)
  validate?: (value: T) => boolean;
  
  // Transform value on every read (normalization, coercion)
  onRead?: (value: T) => T;
  
  // Transform value on every write
  onWrite?: (value: T) => T;
  
  // Run once on first access if the key doesn't exist in localStorage
  migrate?: () => T | undefined;
}
```

## Self-Healing

The storage system automatically self-heals normalized forms:

```ts
// In createStorage.getItem():
const processed = onRead(deserialize(stored));
if (!validate(processed)) {
  save(key, initialValue);  // reject invalid values
  return initialValue;
}
// Self-heal: persist the normalized form
if (serialize(processed) !== stored) save(key, processed);
return processed;
```

If a value is normalized by `onRead`, it's re-written to localStorage in its new form. This ensures that over time, all stored values are in the current canonical format.

## Pre-Built Storage Factories

The `src/utils/storage.ts` module provides several ready-to-use factories:

### `rawStringStorage<T>()`

No special serialization. Use for string enums:

```ts
export const themeAtom = atomWithStorage<ThemePreference>(
  k("theme"),
  "system",
  rawStringStorage<ThemePreference>(),
  GET_ON_INIT,
);
```

### `booleanStorage`

Serializes booleans to `"true"` / `"false"` strings:

```ts
export const chordOverlayHiddenAtom = atomWithStorage<boolean>(
  k("chordOverlayHidden"),
  false,
  booleanStorage,
  GET_ON_INIT,
);
```

### `constrainedNumberStorage(constraints)`

Validates numbers against min/max/integer constraints:

```ts
const chordFretSpreadStorage = constrainedNumberStorage({
  min: 0,
  max: 4,
  integer: true,
});

export const chordFretSpreadAtom = atomWithStorage(
  k("chordFretSpread"),
  0,
  chordFretSpreadStorage,
  GET_ON_INIT,
);
```

## Error Handling

The `withStorageErrorBoundary()` utility wraps all localStorage access with consistent error handling:

```ts
export function withStorageErrorBoundary<T>(
  key: string,
  defaultValue: T,
  schema: StorageBoundarySchema<T> = {},
): StorageBoundary<T>
```

It handles:
- **SSR / `window` absence** — returns the default, never throws
- **JSON parse failures** — logs a warning and returns the default
- **Quota / serialization failures on write** — logs a warning and silently fails
- **Any other localStorage exception** — logs and gracefully degrades

You rarely need to call this directly; `createStorage()` already uses it internally.

## Anti-Patterns to Avoid

### ❌ Reading atoms inside `migrate()`

```ts
// WRONG: atoms cannot be accessed in migrate callbacks
migrate: () => {
  const root = get(rootNoteAtom);  // ERROR: get is not available
  return root;
}
```

**Fix:** Read localStorage directly with `readLocalStorage()`.

### ❌ Assuming legacy keys exist

```ts
// WRONG: assumes the key always exists
const oldRoot = readLocalStorage(k("rootNote"));
const idx = NOTES.indexOf(oldRoot);  // oldRoot could be null
```

**Fix:** Provide fallback defaults:

```ts
const oldRoot = readLocalStorage(k("rootNote")) ?? "C";
const idx = NOTES.indexOf(oldRoot);
```

### ❌ Not validating deserialized values

```ts
// WRONG: blindly trusts the stored value
const value = readLocalStorage(k("scaleName"));
return value;  // could be "Unknown Scale"
```

**Fix:** Use `validate()` to reject invalid values:

```ts
const scaleName = readLocalStorage(k("scaleName")) ?? "Major";
if (!SCALE_NAMES.includes(scaleName)) return undefined;
return scaleName;
```

### ❌ Forgetting `GET_ON_INIT`

```ts
// WRONG: no sync read on init, causes visual flash
export const rootNoteAtom = atomWithStorage(
  k("rootNote"),
  "C",
  rawStringStorage(),
  // Missing GET_ON_INIT!
);
```

**Fix:** Always pass `GET_ON_INIT`:

```ts
export const rootNoteAtom = atomWithStorage(
  k("rootNote"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);
```

### ❌ Storing complex JSON without schema validation

```ts
// RISKY: deserialize returns unknown, no schema validation
const questionableStorage = createStorage<ComplexObject>({
  deserialize: (v) => JSON.parse(v),  // no type safety
  // Missing validate callback
});
```

**Fix:** Add validation:

```ts
const safeStorage = createStorage<ComplexObject>({
  deserialize: (v) => {
    const parsed = JSON.parse(v);
    // Assert shape matches expected interface
    if (!isValidComplexObject(parsed)) throw new Error("Invalid shape");
    return parsed;
  },
  validate: isValidComplexObject,
});
```

## Testing Migrations

Use Vitest to test migrations in isolation. See `src/store/atoms.test.ts` for examples:

```ts
it("migrates legacy key tab values to scales", () => {
  // 1. Set up legacy localStorage state
  localStorage.setItem("key", "someOldValue");
  
  // 2. Trigger migration (e.g., access the atom)
  const result = store.get(mobileTabAtom);
  
  // 3. Verify the new value
  expect(result).toBe("scales");
  
  // 4. Verify cleanup (legacy key removed)
  expect(localStorage.getItem("key")).toBeNull();
});
```

Always test:
- The happy path (legacy key exists, valid migration)
- Edge cases (legacy key missing, invalid value)
- Cleanup (old keys are removed after migration)
- Self-healing (normalized form is re-persisted)

## Summary

1. **Use `k()` for all storage keys** — ensures the prefix is applied consistently
2. **Define a `StorageOptions<T>` config** with `validate`, `serialize`, `deserialize`, and `migrate`
3. **Use `createStorage()` factory** — it handles errors and lifecycle hooks
4. **Pass `GET_ON_INIT`** to prevent visual flashes
5. **Read legacy state via `readLocalStorage()`** inside migrations — never use `localStorage.getItem()` directly
6. **Validate all deserialized values** — assume stored values are untrusted
7. **Test migrations thoroughly** — verify the happy path, edge cases, and cleanup
