import { STORAGE_PREFIX, LEGACY_KEYS } from "./storageConstants";

export { STORAGE_PREFIX, LEGACY_KEYS };

export const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;
export const k = storageKey;

/**
 * Single uniform error boundary around localStorage.
 *
 * Handles, in one place:
 *  - SSR / `window` absence (returns the default, never throws),
 *  - JSON parse failures (`schema.parse` may throw — caught and warned),
 *  - quota / serialization failures on write,
 *  - any other unexpected `localStorage` exception.
 *
 * Use this from migrate/read helpers and atom storage adapters so they
 * never need their own try/catch ladder.
 */
export interface StorageBoundarySchema<T> {
  parse?: (raw: string) => T;
  serialize?: (value: T) => string;
}

export interface StorageBoundary<T> {
  get(): T;
  getRaw(): string | null;
  set(value: T): void;
  remove(): void;
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== "undefined"
      && typeof (globalThis as { localStorage?: Storage }).localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function withStorageErrorBoundary<T>(
  key: string,
  defaultValue: T,
  schema: StorageBoundarySchema<T> = {},
): StorageBoundary<T> {
  const parse = schema.parse ?? ((raw: string) => raw as unknown as T);
  const serialize = schema.serialize ?? ((v: T) => String(v));

  return {
    get(): T {
      if (!hasLocalStorage()) return defaultValue;
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return parse(raw);
      } catch (e) {
        console.warn("localStorage.getItem failed", { key, e });
        return defaultValue;
      }
    },
    getRaw(): string | null {
      if (!hasLocalStorage()) return null;
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn("localStorage.getItem failed", { key, e });
        return null;
      }
    },
    set(value: T): void {
      if (!hasLocalStorage()) return;
      try {
        localStorage.setItem(key, serialize(value));
      } catch (e) {
        console.warn("localStorage.setItem failed", { key, e });
      }
    },
    remove(): void {
      if (!hasLocalStorage()) return;
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("localStorage.removeItem failed", { key, e });
      }
    },
  };
}

// Migrate legacy keys on module load.
function migrateLegacyKeys() {
  if (!hasLocalStorage()) return;
  for (const legacyKey of LEGACY_KEYS) {
    const prefixedKey = k(legacyKey);
    const prefixed = withStorageErrorBoundary<string>(prefixedKey, "");
    const legacy = withStorageErrorBoundary<string>(legacyKey, "");
    if (prefixed.getRaw() !== null) {
      legacy.remove();
      continue;
    }
    const legacyValue = legacy.getRaw();
    if (legacyValue === null) continue;
    prefixed.set(legacyValue);
    // Only drop the legacy key once the new write is observable — otherwise
    // a quota/security failure on set() would silently lose the user's data.
    if (prefixed.getRaw() === legacyValue) legacy.remove();
  }
}
migrateLegacyKeys();

// Sync read from localStorage on atom initialization to prevent default flash.
export const GET_ON_INIT = { getOnInit: true } as const;

export interface StorageOptions<T> {
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  validate?: (value: T) => boolean;
  onRead?: (value: T) => T;
  onWrite?: (value: T) => T;
  migrate?: () => T | undefined;
}

/**
 * Factory for creating Jotai atomWithStorage adapters with consistent error handling
 * and lifecycle hooks for validation, migration, and serialization.
 */
export function createStorage<T>(options: StorageOptions<T> = {}) {
  const {
    serialize = (v: unknown) => String(v),
    deserialize = (v: string) => v as unknown as T,
    validate = () => true,
    onRead = (v: T) => v,
    onWrite = (v: T) => v,
    migrate,
  } = options;

  const save = (key: string, value: T) => {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(key, serialize(onWrite(value)));
    } catch (e) {
      console.warn("localStorage.setItem failed", { key, e });
    }
  };

  return {
    getItem(key: string, initialValue: T): T {
      if (!hasLocalStorage()) return initialValue;
      try {
        const stored = localStorage.getItem(key);
        if (stored === null) {
          const migrated = migrate?.();
          if (migrated !== undefined) {
            save(key, migrated);
            return migrated;
          }
          save(key, initialValue);
          return initialValue;
        }

        const processed = onRead(deserialize(stored));
        if (!validate(processed)) {
          save(key, initialValue);
          return initialValue;
        }
        // Self-heal: persist the normalized form (e.g. legacy scale names).
        if (serialize(processed) !== stored) save(key, processed);
        return processed;
      } catch (e) {
        console.warn("localStorage.getItem failed", { key, e });
        return initialValue;
      }
    },
    setItem(key: string, value: T): void {
      save(key, value);
    },
    removeItem(key: string): void {
      if (!hasLocalStorage()) return;
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("localStorage.removeItem failed", { key, e });
      }
    },
  };
}

export function rawStringStorage<T extends string>() {
  return createStorage<T>();
}

export const booleanStorage = createStorage<boolean>({
  serialize: (v) => String(v),
  deserialize: (v) => {
    if (v === "true") return true;
    if (v === "false") return false;
    return undefined as unknown as boolean;
  },
  validate: (v) => typeof v === "boolean",
});

export type NumberConstraints = {
  min?: number;
  max?: number;
  integer?: boolean;
};

export function constrainedNumberStorage(constraints: NumberConstraints) {
  return createStorage<number>({
    serialize: (v) => String(v),
    deserialize: (v) => {
      const num = Number(v);
      return Number.isNaN(num) ? (undefined as unknown as number) : num;
    },
    validate: (num) => {
      if (typeof num !== "number" || !Number.isFinite(num)) return false;
      if (constraints.integer && !Number.isInteger(num)) return false;
      if (constraints.min !== undefined && num < constraints.min) return false;
      if (constraints.max !== undefined && num > constraints.max) return false;
      return true;
    },
  });
}
