import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { CAGED_SHAPES, type CagedShape } from "../shapes";
import { k, STORAGE_PREFIX } from "../utils/storage";

export type FingeringPattern = "all" | "caged" | "3nps";

const LEGACY_KEYS = [
  "rootNote",
  "scaleName",
  "chordRoot",
  "chordType",
  "linkChordRoot",
  "hideNonChordNotes",
  "chordFretSpread",
  "chordIntervalFilter",
  "fingeringPattern",
  "cagedShapes",
  "npsPosition",
  "displayFormat",
  "shapeLabels",
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

// ---------------------------------------------------------------------------
// Raw storage helpers — match the old localStorage.setItem(key, String(value))
// format and write defaults on first access (matching old useEffect-on-mount).
// ---------------------------------------------------------------------------

function rawStringStorage<T extends string>() {
  return {
    getItem(key: string, initialValue: T): T {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      return stored as T;
    },
    setItem(key: string, value: T): void {
      localStorage.setItem(key, value);
    },
    removeItem(key: string): void {
      localStorage.removeItem(key);
    },
  };
}

const booleanStorage = {
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

type NumberConstraints = {
  min?: number;
  max?: number;
  integer?: boolean;
};

function constrainedNumberStorage(constraints: NumberConstraints) {
  return {
    getItem(key: string, initialValue: number): number {
      try {
        const stored = localStorage.getItem(key);
        if (stored === null) {
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

const fretCountStorage = constrainedNumberStorage({ min: 0, max: 24, integer: true });
const chordFretSpreadStorage = constrainedNumberStorage({
  min: 0,
  max: 24,
  integer: true,
});
const npsPositionStorage = constrainedNumberStorage({ min: 0, max: 12, integer: true });
const fretZoomStorage = constrainedNumberStorage({ min: 50, max: 200, integer: true });

const MOBILE_TABS = ["key", "scale", "fretboard"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

const mobileTabStorage = {
  getItem(key: string, initialValue: MobileTab): MobileTab {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, initialValue);
      return initialValue;
    }
    if (stored === "settings") {
      localStorage.setItem(key, "fretboard");
      return "fretboard";
    }
    if ((MOBILE_TABS as readonly string[]).includes(stored)) {
      return stored as MobileTab;
    }
    localStorage.setItem(key, initialValue);
    return initialValue;
  },
  setItem(key: string, value: MobileTab): void {
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
};

// chordType is stored as '' when null (matching old behavior)
const chordTypeStorage = {
  getItem(key: string, initialValue: string | null): string | null {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, "");
      return initialValue;
    }
    return stored === "" ? null : stored;
  },
  setItem(key: string, value: string | null): void {
    localStorage.setItem(key, value ?? "");
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
};

// cagedShapes stored as JSON array
const cagedShapesStorage = {
  getItem(key: string, initialValue: Set<CagedShape>): Set<CagedShape> {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, JSON.stringify(Array.from(initialValue)));
      return initialValue;
    }
    try {
      return new Set(JSON.parse(stored) as CagedShape[]);
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: Set<CagedShape>): void {
    localStorage.setItem(key, JSON.stringify(Array.from(value)));
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
};

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

// Scale
export const rootNoteAtom = atomWithStorage(
  k("rootNote"),
  "C",
  rawStringStorage(),
);
export const scaleNameAtom = atomWithStorage(
  k("scaleName"),
  "Major",
  rawStringStorage(),
);

// Chord overlay
export const chordRootAtom = atomWithStorage(
  k("chordRoot"),
  "C",
  rawStringStorage(),
);
export const chordTypeAtom = atomWithStorage<string | null>(
  k("chordType"),
  null,
  chordTypeStorage,
);
export const linkChordRootAtom = atomWithStorage(
  k("linkChordRoot"),
  true,
  booleanStorage,
);
export const hideNonChordNotesAtom = atomWithStorage(
  k("hideNonChordNotes"),
  false,
  booleanStorage,
);
export const chordFretSpreadAtom = atomWithStorage(
  k("chordFretSpread"),
  0,
  chordFretSpreadStorage,
);
export const chordIntervalFilterAtom = atomWithStorage(
  k("chordIntervalFilter"),
  "All",
  rawStringStorage(),
);

// Fingering
export const fingeringPatternAtom = atomWithStorage<FingeringPattern>(
  k("fingeringPattern"),
  "all",
  rawStringStorage<FingeringPattern>(),
);
export const cagedShapesAtom = atomWithStorage<Set<CagedShape>>(
  k("cagedShapes"),
  new Set(CAGED_SHAPES),
  cagedShapesStorage,
);
export const npsPositionAtom = atomWithStorage(
  k("npsPosition"),
  0,
  npsPositionStorage,
);

// Display
export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  k("displayFormat"),
  "notes",
  rawStringStorage<"notes" | "degrees" | "none">(),
);
export const shapeLabelsAtom = atomWithStorage<"modal" | "caged" | "none">(
  k("shapeLabels"),
  "none",
  rawStringStorage<"modal" | "caged" | "none">(),
);
export const tuningNameAtom = atomWithStorage(
  k("tuningName"),
  "Standard",
  rawStringStorage(),
);
export const fretZoomAtom = atomWithStorage(k("fretZoom"), 100, fretZoomStorage);
export const fretStartAtom = atomWithStorage(k("fretStart"), 0, fretCountStorage);
export const fretEndAtom = atomWithStorage(k("fretEnd"), 24, fretCountStorage);

// Accidentals / Audio / Mobile tab
// accidentalModeAtom is intentionally non-persisted: "auto" is a smart default
// that picks the best enharmonic spelling per root+scale, so session-only state
// is sufficient and avoids sticking a stale user choice across sessions.
// One-time migration: if the legacy "useFlats" key exists in localStorage
// (from older versions), translate it once and clear the key. Fall-open on
// error so a broken localStorage never blocks app boot.
function readLegacyAccidentalMode(): "sharps" | "flats" | "auto" {
  try {
    const legacy = localStorage.getItem("useFlats");
    if (legacy === null) return "auto";
    localStorage.removeItem("useFlats");
    return legacy === "true" ? "flats" : "sharps";
  } catch {
    return "auto";
  }
}
export const accidentalModeAtom = atom<"sharps" | "flats" | "auto">(
  readLegacyAccidentalMode(),
);
// enharmonicDisplayAtom is intentionally non-persisted: "auto" preserves the
// pre-existing CoF enharmonic-display behavior by default.
export const enharmonicDisplayAtom = atom<"auto" | "on" | "off">("auto");
export const isMutedAtom = atomWithStorage(k("isMuted"), false, booleanStorage);
export const mobileTabAtom = atomWithStorage<"key" | "scale" | "fretboard">(
  k("mobileTab"),
  "key",
  mobileTabStorage,
);
export const tabletTabAtom = atomWithStorage<"settings" | "scales">(
  k("tabletTab"),
  "settings",
  rawStringStorage<"settings" | "scales">(),
);

export type LandscapeNarrowTab = "fretboard" | "scaleChord" | "key";

export const landscapeNarrowTabAtom = atomWithStorage<LandscapeNarrowTab>(
  k("landscapeNarrowTab"),
  "fretboard",
  rawStringStorage<LandscapeNarrowTab>(),
);

// settingsOverlayOpenAtom is intentionally non-persisted and always starts closed.
export const settingsOverlayOpenAtom = atom<boolean>(false);

// ---------------------------------------------------------------------------
// Write atoms (actions)
// ---------------------------------------------------------------------------

// Sets rootNote and syncs chordRoot when linkChordRoot is enabled
export const setRootNoteAtom = atom(null, (get, set, note: string) => {
  set(rootNoteAtom, note);
  if (get(linkChordRootAtom)) set(chordRootAtom, note);
});

// Resets all persisted state to defaults and clears localStorage
export const resetAtom = atom(null, (_get, set) => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    // If storage is blocked or throws, still reset atoms in-memory.
  }
  set(rootNoteAtom, RESET);
  set(scaleNameAtom, RESET);
  set(chordRootAtom, RESET);
  set(chordTypeAtom, RESET);
  set(linkChordRootAtom, RESET);
  set(hideNonChordNotesAtom, RESET);
  set(chordFretSpreadAtom, RESET);
  set(chordIntervalFilterAtom, RESET);
  set(fingeringPatternAtom, RESET);
  set(cagedShapesAtom, RESET);
  set(npsPositionAtom, RESET);
  set(displayFormatAtom, RESET);
  set(shapeLabelsAtom, RESET);
  set(tuningNameAtom, RESET);
  set(fretZoomAtom, RESET);
  set(fretStartAtom, RESET);
  set(fretEndAtom, RESET);
  set(accidentalModeAtom, "auto");
  set(enharmonicDisplayAtom, "auto");
  set(isMutedAtom, RESET);
  set(mobileTabAtom, RESET);
  set(tabletTabAtom, RESET);
  set(landscapeNarrowTabAtom, RESET);
});
