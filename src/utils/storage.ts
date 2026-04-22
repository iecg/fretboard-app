import { STORAGE_PREFIX, LEGACY_KEYS } from "./storageConstants";

export { STORAGE_PREFIX, LEGACY_KEYS };

export const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;
export const k = storageKey;

// Migrate legacy keys on module load.
function migrateLegacyKeys() {
  try {
    for (const legacyKey of LEGACY_KEYS) {
      const prefixedKey = k(legacyKey);
      if (localStorage.getItem(prefixedKey) !== null) {
        localStorage.removeItem(legacyKey);
        continue;
      }
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;
      localStorage.setItem(prefixedKey, legacyValue);
      localStorage.removeItem(legacyKey);
    }
  } catch (e) {
    console.warn("Legacy key migration failed", e);
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
    localStorage.setItem(key, serialize(onWrite(value)));
  };

  return {
    getItem(key: string, initialValue: T): T {
      try {
        const stored = localStorage.getItem(key);
        if (stored === null) {
          if (migrate) {
            const migrated = migrate();
            if (migrated !== undefined) {
              save(key, migrated);
              return migrated;
            }
          }
          save(key, initialValue);
          return initialValue;
        }

        const deserialized = deserialize(stored);
        const processed = onRead(deserialized);

        if (!validate(processed)) {
          save(key, initialValue);
          return initialValue;
        }

        // Self-heal: if onRead normalized the value (e.g. legacy scale names), save it.
        // We use serialize(processed) to ensure we compare with the string form in localStorage.
        if (serialize(processed) !== stored) {
          save(key, processed);
        }

        return processed;
      } catch (e) {
        console.warn("localStorage.getItem failed", { key, e });
        return initialValue;
      }
    },
    setItem(key: string, value: T): void {
      try {
        save(key, value);
      } catch (e) {
        console.warn("localStorage.setItem failed", { key, e });
      }
    },
    removeItem(key: string): void {
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
