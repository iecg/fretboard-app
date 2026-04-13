import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { CAGED_SHAPES, type CagedShape } from "../shapes";

export type FingeringPattern = "all" | "caged" | "3nps";

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
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, String(initialValue));
      return initialValue;
    }
    return stored === "true";
  },
  setItem(key: string, value: boolean): void {
    localStorage.setItem(key, String(value));
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
};

const numberStorage = {
  getItem(key: string, initialValue: number): number {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, String(initialValue));
      return initialValue;
    }
    return Number(stored);
  },
  setItem(key: string, value: number): void {
    localStorage.setItem(key, String(value));
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
};

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
  "rootNote",
  "C",
  rawStringStorage(),
);
export const scaleNameAtom = atomWithStorage(
  "scaleName",
  "Major",
  rawStringStorage(),
);

// Chord overlay
export const chordRootAtom = atomWithStorage(
  "chordRoot",
  "C",
  rawStringStorage(),
);
export const chordTypeAtom = atomWithStorage<string | null>(
  "chordType",
  null,
  chordTypeStorage,
);
export const linkChordRootAtom = atomWithStorage(
  "linkChordRoot",
  true,
  booleanStorage,
);
export const hideNonChordNotesAtom = atomWithStorage(
  "hideNonChordNotes",
  false,
  booleanStorage,
);
export const chordFretSpreadAtom = atomWithStorage(
  "chordFretSpread",
  0,
  numberStorage,
);
export const chordIntervalFilterAtom = atomWithStorage(
  "chordIntervalFilter",
  "All",
  rawStringStorage(),
);

// Fingering
export const fingeringPatternAtom = atomWithStorage<FingeringPattern>(
  "fingeringPattern",
  "all",
  rawStringStorage<FingeringPattern>(),
);
export const cagedShapesAtom = atomWithStorage<Set<CagedShape>>(
  "cagedShapes",
  new Set(CAGED_SHAPES),
  cagedShapesStorage,
);
export const npsPositionAtom = atomWithStorage("npsPosition", 0, numberStorage);

// Display
export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  "displayFormat",
  "notes",
  rawStringStorage<"notes" | "degrees" | "none">(),
);
export const shapeLabelsAtom = atomWithStorage<"modal" | "caged" | "none">(
  "shapeLabels",
  "none",
  rawStringStorage<"modal" | "caged" | "none">(),
);
export const tuningNameAtom = atomWithStorage(
  "tuningName",
  "Standard",
  rawStringStorage(),
);
export const fretZoomAtom = atomWithStorage("fretZoom", 100, numberStorage);
export const fretStartAtom = atomWithStorage("fretStart", 0, numberStorage);
export const fretEndAtom = atomWithStorage("fretEnd", 24, numberStorage);

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
export const isMutedAtom = atomWithStorage("isMuted", false, booleanStorage);
export const mobileTabAtom = atomWithStorage<"key" | "scale" | "fretboard">(
  "mobileTab",
  "key",
  mobileTabStorage,
);
export const tabletTabAtom = atomWithStorage<"settings" | "scales">(
  "tabletTab",
  "settings",
  rawStringStorage<"settings" | "scales">(),
);

export type LandscapeNarrowTab = "fretboard" | "scaleChord" | "key";

export const landscapeNarrowTabAtom = atomWithStorage<LandscapeNarrowTab>(
  "landscapeNarrowTab",
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
  localStorage.clear();
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
});
