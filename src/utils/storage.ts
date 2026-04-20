export const STORAGE_PREFIX = "fretflow:";
export const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;
// Shorthand alias for convenience
export const k = storageKey;

// ---------------------------------------------------------------------------
// Legacy key migration — runs once at module load, before any atom reads.
// This module is imported by every domain atom file, so the migration is
// guaranteed to finish before any atomWithStorage({ getOnInit: true }) reads.
// ---------------------------------------------------------------------------

const LEGACY_KEYS = [
  "rootNote",
  "scaleName",
  "chordRoot",
  "chordType",
  "linkChordRoot",
  "chordFretSpread",
  "chordIntervalFilter",
  "fingeringPattern",
  "cagedShapes",
  "npsPosition",
  "displayFormat",
  "tuningName",
  "fretZoom",
  "fretStart",
  "fretEnd",
  "isMuted",
  "mobileTab",
  "tabletTab",
  "landscapeNarrowTab",
] as const;

function migrateLegacyKeys() {
  // Idempotent: only migrates when prefixed key doesn't exist.
  // Also removes the legacy key after copying to reduce drift.
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
  } catch {
    // If storage is blocked or throws (Safari private mode, etc), ignore.
  }
}
migrateLegacyKeys();

// Passed to atomWithStorage to read localStorage synchronously on atom
// initialization, preventing a visible flash from the hardcoded default.
export const GET_ON_INIT = { getOnInit: true } as const;

// ---------------------------------------------------------------------------
// Generic localStorage adapters — match the old localStorage.setItem(key, String(value))
// format and write defaults on first access.
// ---------------------------------------------------------------------------

export function rawStringStorage<T extends string>() {
  return {
    getItem(key: string, initialValue: T): T {
      try {
        const stored = localStorage.getItem(key);
        if (stored === null) {
          localStorage.setItem(key, initialValue);
          return initialValue;
        }
        return stored as T;
      } catch {
        return initialValue;
      }
    },
    setItem(key: string, value: T): void {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage blocked or unavailable; ignore.
      }
    },
    removeItem(key: string): void {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage blocked or unavailable; ignore.
      }
    },
  };
}

export const booleanStorage = {
  getItem(key: string, initialValue: boolean): boolean {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, String(initialValue));
        return initialValue;
      }
      if (stored === "true") return true;
      if (stored === "false") return false;
      localStorage.setItem(key, String(initialValue));
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: boolean): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked or unavailable; ignore.
    }
  },
};

export type NumberConstraints = {
  min?: number;
  max?: number;
  integer?: boolean;
};

export function constrainedNumberStorage(constraints: NumberConstraints) {
  return {
    getItem(key: string, initialValue: number): number {
      try {
        const stored = localStorage.getItem(key);
        if (stored === null) {
          localStorage.setItem(key, String(initialValue));
          return initialValue;
        }
        if (stored.trim() === "") {
          localStorage.setItem(key, String(initialValue));
          return initialValue;
        }
        const num = Number(stored);
        if (!Number.isFinite(num)) {
          localStorage.setItem(key, String(initialValue));
          return initialValue;
        }
        if (constraints.integer && !Number.isInteger(num)) {
          localStorage.setItem(key, String(initialValue));
          return initialValue;
        }
        if (constraints.min !== undefined && num < constraints.min) {
          localStorage.setItem(key, String(initialValue));
          return initialValue;
        }
        if (constraints.max !== undefined && num > constraints.max) {
          localStorage.setItem(key, String(initialValue));
          return initialValue;
        }
        return num;
      } catch {
        return initialValue;
      }
    },
    setItem(key: string, value: number): void {
      try {
        localStorage.setItem(key, String(value));
      } catch {
        // Storage blocked or unavailable; ignore.
      }
    },
    removeItem(key: string): void {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage blocked or unavailable; ignore.
      }
    },
  };
}
