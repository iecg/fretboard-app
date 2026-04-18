import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { CAGED_SHAPES, type CagedShape } from "../shapes";
import { normalizeScaleName, type ScaleBrowseMode } from "../theoryCatalog";
import { k, STORAGE_PREFIX } from "../utils/storage";
import type {
  ViewMode,
  FocusPreset,
  ChordMemberName,
} from "../theory";

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

const scaleNameStorage = {
  getItem(key: string, initialValue: string): string {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      const normalized = normalizeScaleName(stored);
      if (normalized !== stored) {
        localStorage.setItem(key, normalized);
      }
      return normalized;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, normalizeScaleName(value));
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

const fretCountStorage = constrainedNumberStorage({
  min: 0,
  max: 25,
  integer: true,
});
const chordFretSpreadStorage = constrainedNumberStorage({
  min: 0,
  max: 4,
  integer: true,
});
const npsPositionStorage = constrainedNumberStorage({
  min: 1,
  max: 12,
  integer: true,
});
const fretZoomStorage = constrainedNumberStorage({
  min: 50,
  max: 200,
  integer: true,
});

const MOBILE_TABS = ["theory", "view"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

const mobileTabStorage = {
  getItem(key: string, initialValue: MobileTab): MobileTab {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if (stored === "key" || stored === "scale") {
        localStorage.setItem(key, "theory");
        return "theory";
      }
      if (stored === "settings") {
        localStorage.setItem(key, "view");
        return "view";
      }
      if (stored === "fretboard") {
        localStorage.setItem(key, "view");
        return "view";
      }
      if ((MOBILE_TABS as readonly string[]).includes(stored)) {
        return stored as MobileTab;
      }
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: MobileTab): void {
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

const SCALE_BROWSE_MODES = ["parallel", "relative"] as const;

const scaleBrowseModeStorage = {
  getItem(key: string, initialValue: ScaleBrowseMode): ScaleBrowseMode {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if ((SCALE_BROWSE_MODES as readonly string[]).includes(stored)) {
        return stored as ScaleBrowseMode;
      }
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: ScaleBrowseMode): void {
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

const SHAPE_LABEL_VALUES = ["none", "caged"] as const;
type ShapeLabelValue = (typeof SHAPE_LABEL_VALUES)[number];

const shapeLabelsStorage = {
  getItem(key: string, initialValue: ShapeLabelValue): ShapeLabelValue {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if (stored === "modal") {
        localStorage.setItem(key, "caged");
        return "caged";
      }
      if ((SHAPE_LABEL_VALUES as readonly string[]).includes(stored)) {
        return stored as ShapeLabelValue;
      }
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: ShapeLabelValue): void {
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

// chordType is stored as '' when null (matching old behavior)
const chordTypeStorage = {
  getItem(key: string, initialValue: string | null): string | null {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, "");
        return initialValue;
      }
      return stored === "" ? null : stored;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: string | null): void {
    try {
      localStorage.setItem(key, value ?? "");
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

// cagedShapes stored as JSON array
const cagedShapesStorage = {
  getItem(key: string, initialValue: Set<CagedShape>): Set<CagedShape> {
    try {
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
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: Set<CagedShape>): void {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(value)));
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

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

// All persisted atoms use { getOnInit: true } so Jotai reads from localStorage
// synchronously during atom initialization rather than defaulting to initialValue
// first. Without this, atoms start with their hardcoded default on the first
// render and then update after mount, causing a visible flash on page load.
const GET_ON_INIT = { getOnInit: true } as const;

// Scale
export const rootNoteAtom = atomWithStorage(
  k("rootNote"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);
const baseScaleNameAtom = atomWithStorage(
  k("scaleName"),
  "Major",
  scaleNameStorage,
  GET_ON_INIT,
);
export const scaleNameAtom = atom(
  (get) => get(baseScaleNameAtom),
  (_get, set, value: string) => {
    set(baseScaleNameAtom, normalizeScaleName(value));
  },
);
export const scaleBrowseModeAtom = atomWithStorage<ScaleBrowseMode>(
  k("scaleBrowseMode"),
  "parallel",
  scaleBrowseModeStorage,
  GET_ON_INIT,
);

// Chord overlay
export const chordRootAtom = atomWithStorage(
  k("chordRoot"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);
export const chordTypeAtom = atomWithStorage<string | null>(
  k("chordType"),
  null,
  chordTypeStorage,
  GET_ON_INIT,
);
export const linkChordRootAtom = atomWithStorage(
  k("linkChordRoot"),
  true,
  booleanStorage,
  GET_ON_INIT,
);
export const hideNonChordNotesAtom = atomWithStorage(
  k("hideNonChordNotes"),
  false,
  booleanStorage,
  GET_ON_INIT,
);
export const chordFretSpreadAtom = atomWithStorage(
  k("chordFretSpread"),
  0,
  chordFretSpreadStorage,
  GET_ON_INIT,
);

const VIEW_MODE_VALUES: ViewMode[] = ["compare", "chord", "outside"];

const viewModeStorage = {
  getItem(key: string, initialValue: ViewMode): ViewMode {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if ((VIEW_MODE_VALUES as string[]).includes(stored))
        return stored as ViewMode;
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: ViewMode): void {
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

const FOCUS_PRESET_VALUES: FocusPreset[] = [
  "all",
  "triad",
  "shell",
  "guide-tones",
  "rootless",
  "custom",
];

const focusPresetStorage = {
  getItem(key: string, initialValue: FocusPreset): FocusPreset {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      if ((FOCUS_PRESET_VALUES as string[]).includes(stored))
        return stored as FocusPreset;
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: FocusPreset): void {
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

const customMembersStorage = {
  getItem(key: string, initialValue: ChordMemberName[]): ChordMemberName[] {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        localStorage.setItem(key, JSON.stringify(initialValue));
        return initialValue;
      }
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed as ChordMemberName[];
        return initialValue;
      } catch {
        return initialValue;
      }
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: ChordMemberName[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
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

export const viewModeAtom = atomWithStorage<ViewMode>(
  k("viewMode"),
  "compare",
  viewModeStorage,
  GET_ON_INIT,
);
export const focusPresetAtom = atomWithStorage<FocusPreset>(
  k("focusPreset"),
  "all",
  focusPresetStorage,
  GET_ON_INIT,
);
export const customMembersAtom = atomWithStorage<ChordMemberName[]>(
  k("customMembers"),
  [],
  customMembersStorage,
  GET_ON_INIT,
);

// Fingering
export const fingeringPatternAtom = atomWithStorage<FingeringPattern>(
  k("fingeringPattern"),
  "all",
  rawStringStorage<FingeringPattern>(),
  GET_ON_INIT,
);
export const cagedShapesAtom = atomWithStorage<Set<CagedShape>>(
  k("cagedShapes"),
  new Set(CAGED_SHAPES),
  cagedShapesStorage,
  GET_ON_INIT,
);
export const npsPositionAtom = atomWithStorage(
  k("npsPosition"),
  1,
  npsPositionStorage,
  GET_ON_INIT,
);

// Display
export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  k("displayFormat"),
  "notes",
  rawStringStorage<"notes" | "degrees" | "none">(),
  GET_ON_INIT,
);
export const shapeLabelsAtom = atomWithStorage<"caged" | "none">(
  k("shapeLabels"),
  "none",
  shapeLabelsStorage,
  GET_ON_INIT,
);
export const tuningNameAtom = atomWithStorage(
  k("tuningName"),
  "Standard",
  rawStringStorage(),
  GET_ON_INIT,
);
export const fretZoomAtom = atomWithStorage(
  k("fretZoom"),
  100,
  fretZoomStorage,
  GET_ON_INIT,
);
export const fretStartAtom = atomWithStorage(
  k("fretStart"),
  0,
  fretCountStorage,
  GET_ON_INIT,
);
export const fretEndAtom = atomWithStorage(
  k("fretEnd"),
  25,
  fretCountStorage,
  GET_ON_INIT,
);

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
export const isMutedAtom = atomWithStorage(
  k("isMuted"),
  false,
  booleanStorage,
  GET_ON_INIT,
);
export const mobileTabAtom = atomWithStorage<"theory" | "view">(
  k("mobileTab"),
  "theory",
  mobileTabStorage,
  GET_ON_INIT,
);
export const tabletTabAtom = atomWithStorage<"settings" | "scales">(
  k("tabletTab"),
  "settings",
  rawStringStorage<"settings" | "scales">(),
  GET_ON_INIT,
);

export type LandscapeNarrowTab = "fretboard" | "scaleChord" | "key";

export const landscapeNarrowTabAtom = atomWithStorage<LandscapeNarrowTab>(
  k("landscapeNarrowTab"),
  "fretboard",
  rawStringStorage<LandscapeNarrowTab>(),
  GET_ON_INIT,
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
  set(baseScaleNameAtom, RESET);
  set(scaleBrowseModeAtom, RESET);
  set(chordRootAtom, RESET);
  set(chordTypeAtom, RESET);
  set(linkChordRootAtom, RESET);
  set(hideNonChordNotesAtom, RESET);
  set(chordFretSpreadAtom, RESET);
  set(viewModeAtom, RESET);
  set(focusPresetAtom, RESET);
  set(customMembersAtom, RESET);
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
