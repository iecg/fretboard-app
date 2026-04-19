import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { 
  CAGED_SHAPES, 
  getCagedCoordinates, 
  get3NPSCoordinates, 
  findMainShape, 
  getShapeCenterFret, 
  type CagedShape,
  type ShapePolygon,
} from "../shapes";
import { normalizeScaleName, type ScaleBrowseMode, getActiveScaleBrowseOption } from "../theoryCatalog";
import { k, STORAGE_PREFIX } from "../utils/storage";
import {
  resolveAccidentalMode,
  SCALES,
  NOTES,
  ENHARMONICS,
  INTERVAL_NAMES,
  CHORD_DEFINITIONS,
  getScaleNotes,
  getChordNotes,
  getNoteDisplay,
  getNoteDisplayInScale,
  getDivergentNotes,
  formatAccidental,
  getAvailableFocusPresets,
  applyFocusPreset,
} from "../theory";
import type {
  ViewMode,
  FocusPreset,
  ChordMemberName,
  ResolvedChordMember,
  NoteRole,
  NoteSemantics,
  PracticeLens,
  PracticeCue,
  PracticeCueNote,
  ChordRowEntry,
  LegendItem,
  PracticeBarColorNote,
} from "../theory";
import { TUNINGS, STANDARD_TUNING, getFretNote } from "../guitar";
import { 
  MAX_FRET, 
  FRET_ZOOM_MIN, 
  FRET_ZOOM_MAX, 
  FRET_ZOOM_DEFAULT 
} from "../constants";

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
  max: MAX_FRET,
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
  min: FRET_ZOOM_MIN,
  max: FRET_ZOOM_MAX,
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
// Primary scale setter: resets CAGED shapes to "E" when scale changes, matching old useDisplayState useEffect
export const scaleNameAtom = atom(
  (get) => get(baseScaleNameAtom),
  (get, set, value: string) => {
    const nextScale = normalizeScaleName(value);
    const prevScale = get(baseScaleNameAtom);
    if (nextScale !== prevScale) {
      set(baseScaleNameAtom, nextScale);
      if (get(fingeringPatternAtom) === "caged") {
        set(cagedShapesAtom, new Set<CagedShape>(["E"]));
      }
    }
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
export const chordFretSpreadAtom = atomWithStorage(
  k("chordFretSpread"),
  0,
  chordFretSpreadStorage,
  GET_ON_INIT,
);

// Targets lens hides scale-only notes so only chord tones are shown.
export const hideNonChordNotesAtom = atom((get) => get(practiceLensAtom) === "targets");

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

// ---------------------------------------------------------------------------
// Practice lens storage — with one-time migration from old viewMode key
// ---------------------------------------------------------------------------

const PRACTICE_LENS_VALUES: PracticeLens[] = [
  "targets",
  "guide-tones",
  "color",
  "targets-color",
  "tension",
];

function migrateViewModeToLens(viewMode: string): PracticeLens {
  switch (viewMode) {
    case "chord": return "targets";
    case "outside": return "tension";
    default: return "targets-color";
  }
}

const practiceLensStorage = {
  getItem(key: string, initialValue: PracticeLens): PracticeLens {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        if ((PRACTICE_LENS_VALUES as string[]).includes(stored))
          return stored as PracticeLens;
        localStorage.setItem(key, initialValue);
        return initialValue;
      }
      // One-time migration: map old viewMode to a lens on first access
      const oldViewMode = localStorage.getItem(k("viewMode"));
      if (oldViewMode) {
        const migrated = migrateViewModeToLens(oldViewMode);
        localStorage.setItem(key, migrated);
        return migrated;
      }
      localStorage.setItem(key, initialValue);
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: PracticeLens): void {
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
// Primary user-facing practice state — replaces viewMode as the UI concept.
// Stored separately; migrates from old viewMode on first access.
export const practiceLensAtom = atomWithStorage<PracticeLens>(
  k("practiceLens"),
  "targets-color",
  practiceLensStorage,
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

export const toggleCagedShapeAtom = atom(null, (get, set, shape: CagedShape) => {
  const prev = get(cagedShapesAtom);
  const next = new Set(prev);
  if (next.has(shape)) {
    if (next.size > 1) next.delete(shape);
  } else {
    next.add(shape);
  }
  set(cagedShapesAtom, next);
});

export const selectSingleCagedShapeAtom = atom(
  null,
  (_get, set, shape: CagedShape) => {
    set(cagedShapesAtom, new Set([shape]));
  },
);

export const npsPositionAtom = atomWithStorage(
  k("npsPosition"),
  1,
  npsPositionStorage,
  GET_ON_INIT,
);

// UI/Transient state
const internalHiddenNotesAtom = atom<{
  root: string;
  scale: string;
  notes: Set<string>;
} | null>(null);

export const hiddenNotesAtom = atom(
  (get) => {
    const state = get(internalHiddenNotesAtom);
    const root = get(rootNoteAtom);
    const scale = get(scaleNameAtom);
    if (state && state.root === root && state.scale === scale) {
      return state.notes;
    }
    return new Set<string>();
  },
  (get, set, update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const root = get(rootNoteAtom);
    const scale = get(scaleNameAtom);
    const currentNotes = get(hiddenNotesAtom);
    const nextNotes =
      typeof update === "function" ? update(currentNotes) : update;
    set(internalHiddenNotesAtom, { root, scale, notes: nextNotes });
  },
);

export const toggleHiddenNoteAtom = atom(null, (_get, set, note: string) => {
  set(hiddenNotesAtom, (prev) => {
    const next = new Set(prev);
    if (next.has(note)) next.delete(note);
    else next.add(note);
    return next;
  });
});

export const clickedShapeAtom = atom<CagedShape | null>(null);
export const recenterKeyAtom = atom<number>(0);

// Display
export const displayFormatAtom = atomWithStorage<"notes" | "degrees" | "none">(
  k("displayFormat"),
  "notes",
  rawStringStorage<"notes" | "degrees" | "none">(),
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
  FRET_ZOOM_DEFAULT,
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
  MAX_FRET,
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

export const toggleMuteAtom = atom(null, (get, set) => {
  set(isMutedAtom, !get(isMutedAtom));
});
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

// Derived read atoms
export const useFlatsAtom = atom((get) =>
  resolveAccidentalMode(
    get(rootNoteAtom),
    get(scaleNameAtom),
    get(accidentalModeAtom),
  ),
);

export const currentTuningAtom = atom(
  (get) => TUNINGS[get(tuningNameAtom)] || STANDARD_TUNING,
);

// --- Scale Derived Atoms ---

export const scaleNotesAtom = atom((get) =>
  getScaleNotes(get(rootNoteAtom), get(scaleNameAtom)),
);

export const colorNotesAtom = atom((get) => {
  const scaleName = get(scaleNameAtom);
  const rootNote = get(rootNoteAtom);
  const intervals = SCALES[scaleName];
  if (!intervals) return [];
  // Minor Blues: blue note is b5 (interval 6)
  if (scaleName === "Minor Blues") {
    const rootIdx = NOTES.indexOf(rootNote);
    return rootIdx >= 0 ? [NOTES[(rootIdx + 6) % 12]] : [];
  }
  // Major Blues: blue note is b3 (interval 3)
  if (scaleName === "Major Blues") {
    const rootIdx = NOTES.indexOf(rootNote);
    return rootIdx >= 0 ? [NOTES[(rootIdx + 3) % 12]] : [];
  }
  // Modal scales: notes that diverge from the reference major/minor
  return getDivergentNotes(rootNote, scaleName);
});

export const activeBrowseOptionAtom = atom((get) =>
  getActiveScaleBrowseOption(
    get(rootNoteAtom),
    get(scaleNameAtom),
    get(scaleBrowseModeAtom),
    get(useFlatsAtom),
  ),
);

export const scaleLabelAtom = atom(
  (get) => `${formatAccidental(get(activeBrowseOptionAtom).label)}`,
);

export const degreeChipsAtom = atom((get) => {
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const scaleNotes = get(scaleNotesAtom);
  const useFlats = get(useFlatsAtom);
  const intervals = SCALES[scaleName] || [];

  const rootIdx = NOTES.indexOf(rootNote);
  return scaleNotes.map((note) => {
    const noteIdx = NOTES.indexOf(note);
    const chromaticInterval =
      rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : 0;
    const interval = INTERVAL_NAMES[chromaticInterval] ?? "1";
    return {
      internalNote: note,
      note: formatAccidental(
        getNoteDisplayInScale(note, rootNote, intervals, useFlats),
      ),
      interval: formatAccidental(interval),
      inScale: true,
      isTonic: note === rootNote,
    };
  });
});

// --- Chord Derived Atoms ---

export const chordTonesAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [];
  return getChordNotes(chordRoot, chordType);
});

export const availableFocusPresetsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return ["all", "custom"] as FocusPreset[];
  return getAvailableFocusPresets(chordType);
});

export const chordMembersAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as ResolvedChordMember[];
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return [] as ResolvedChordMember[];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return [] as ResolvedChordMember[];
  return def.members.map((m) => ({
    ...m,
    note: NOTES[(rootIndex + m.semitone) % 12],
  }));
});

export const activeChordMembersAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const focusPreset = get(focusPresetAtom);
  const customMembers = get(customMembersAtom);
  const availablePresets = get(availableFocusPresetsAtom);

  if (!chordType) return [] as ResolvedChordMember[];
  const def = CHORD_DEFINITIONS[chordType];
  if (!def) return [] as ResolvedChordMember[];
  const rootIndex = NOTES.indexOf(chordRoot);
  if (rootIndex === -1) return [] as ResolvedChordMember[];
  const effectivePreset = availablePresets.includes(focusPreset)
    ? focusPreset
    : "all";
  const members = applyFocusPreset(def, effectivePreset, customMembers);
  return members.map((m) => ({
    ...m,
    note: NOTES[(rootIndex + m.semitone) % 12],
  }));
});

export const activeChordTonesAtom = atom((get) =>
  get(activeChordMembersAtom).map((m) => m.note),
);

export const hasOutsideChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordTones = get(chordTonesAtom);
  if (!chordType || chordTones.length === 0) return false;
  const scaleNotes = get(scaleNotesAtom);
  const scaleNoteSet = new Set(scaleNotes);
  return chordTones.some((note) => !scaleNoteSet.has(note));
});

export const chordLabelAtom = atom((get) => {
  const chordRoot = get(chordRootAtom);
  const chordType = get(chordTypeAtom);
  const useFlats = get(useFlatsAtom);
  if (!chordType) return null;
  return `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`;
});

export const chordSummaryNotesAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordTones = get(chordTonesAtom);
  const chordRoot = get(chordRootAtom);
  if (!chordType || chordTones.length === 0) return [] as string[];
  const chordRootIdx = NOTES.indexOf(chordRoot);
  const chordToneSet = new Set(chordTones);
  return NOTES.slice(chordRootIdx)
    .concat(NOTES.slice(0, chordRootIdx))
    .filter((n) => chordToneSet.has(n));
});

// --- UI Logic & Combined Derived Atoms ---

export const noteRoleMapAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const activeChordTones = get(activeChordTonesAtom);

  if (!chordType) return new Map<string, NoteRole>();
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const activeChordToneSet = new Set(activeChordTones);
  const map = new Map<string, NoteRole>();
  for (const note of NOTES) {
    const isInScale = scaleNoteSet.has(note);
    const isActiveChordTone = activeChordToneSet.has(note);
    const isChordRootNote = note === chordRoot;
    if (isChordRootNote && isActiveChordTone) {
      map.set(note, "chord-root");
    } else if (isActiveChordTone && isInScale) {
      map.set(note, "chord-tone-in-scale");
    } else if (isActiveChordTone && !isInScale) {
      map.set(note, "chord-tone-outside-scale");
    } else if (isInScale) {
      map.set(note, "scale-only");
    }
  }
  return map;
});

export const allChordMembersAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as ChordRowEntry[];

  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const activeChordMembers = get(activeChordMembersAtom);
  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));

  return activeChordMembers.map((m): ChordRowEntry => {
    const inScale = scaleNoteSet.has(m.note);
    const isRoot = m.name === "root";
    let role: ChordRowEntry["role"];
    if (isRoot) {
      role = "chord-root";
    } else if (inScale) {
      role = "chord-tone-in-scale";
    } else {
      role = "chord-tone-outside-scale";
    }
    return {
      internalNote: m.note,
      displayNote: formatAccidental(getNoteDisplay(m.note, chordRoot, useFlats)),
      memberName: m.name === "root" ? "1" : formatAccidental(m.name),
      role,
      inScale,
    };
  });
});

// All chord members — tension lens shows all notes (not just outside ones).
export const summaryChordRowAtom = atom((get) => get(allChordMembersAtom));

export const summaryLegendItemsAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as LegendItem[];

  const summaryChordRow = get(summaryChordRowAtom);
  const practiceLens = get(practiceLensAtom);
  const noteRoleMap = get(noteRoleMapAtom);

  const rolesPresent = new Set(summaryChordRow.map((e) => e.role));
  const items: LegendItem[] = [];
  if (rolesPresent.has("chord-root"))
    items.push({ role: "chord-root", label: "Chord root" });
  if (rolesPresent.has("chord-tone-in-scale"))
    items.push({ role: "chord-tone-in-scale", label: "Chord tone" });
  if (rolesPresent.has("chord-tone-outside-scale"))
    items.push({ role: "chord-tone-outside-scale", label: "Outside scale" });
  // Show scale-only legend entry when the lens is not targets (which hides them).
  const hasScaleOnly = Array.from(noteRoleMap.values()).includes("scale-only");
  if (practiceLens !== "targets" && hasScaleOnly) {
    items.push({ role: "scale-only", label: "Scale only" });
  }
  return items;
});

export const showRelationshipRowAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const practiceLens = get(practiceLensAtom);
  const chordRoot = get(chordRootAtom);
  const rootNote = get(rootNoteAtom);
  const focusPreset = get(focusPresetAtom);
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);

  return !!(
    chordType &&
    practiceLens !== "targets" &&
    (chordRoot !== rootNote || focusPreset !== "all" || hasOutsideChordMembers)
  );
});

export const summaryNotesAtom = atom((get) => get(scaleNotesAtom));

export const chordMemberLabelsAtom = atom((get) =>
  get(activeChordMembersAtom)
    .map((m) => (m.name === "root" ? "1" : formatAccidental(m.name)))
    .join(" "),
);

export const summaryHeaderLeftAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const practiceLens = get(practiceLensAtom);
  const scaleLabel = get(scaleLabelAtom);
  const chordLabel = get(chordLabelAtom);

  if (!chordType) return scaleLabel;
  // Targets lens is chord-focused: show the chord name as the primary header.
  if (practiceLens === "targets") return chordLabel ?? scaleLabel;
  return scaleLabel;
});

export const summaryHeaderRightAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);
  const practiceLens = get(practiceLensAtom);

  if (!chordType || !chordLabel) return null;
  // Targets lens already shows the chord in the left header.
  if (practiceLens === "targets") return null;
  return chordLabel;
});

export const summaryPrimaryModeAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const practiceLens = get(practiceLensAtom);
  if (!chordType) return "scale";
  if (practiceLens === "targets") return "chord";
  return "scale";
});

export const sharedChordMembersAtom = atom((get) =>
  get(summaryChordRowAtom).filter((e) => e.inScale),
);

export const outsideChordMembersAtom = atom((get) =>
  get(summaryChordRowAtom).filter((e) => !e.inScale),
);

export const practiceBarSharedMembersAtom = atom((get) =>
  get(allChordMembersAtom).filter((e) => e.inScale),
);

export const practiceBarOutsideMembersAtom = atom((get) =>
  get(allChordMembersAtom).filter((e) => !e.inScale),
);

// --- Shape Derived Atoms ---

export const shapeDataAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const currentTuning = get(currentTuningAtom);
  const cagedShapes = get(cagedShapesAtom);
  const npsPosition = get(npsPositionAtom);

  let coords: string[] = [];
  let bounds: { minFret: number; maxFret: number }[] = [];
  let polygons: ShapePolygon[] = [];
  const mergedWrappedNotes = new Set<string>();

  if (fingeringPattern === "caged") {
    const shapesToRender = CAGED_SHAPES.filter((s) => cagedShapes.has(s));
    const allCoords = new Set<string>();
    const allBounds: { minFret: number; maxFret: number }[] = [];
    const allPolygons: ShapePolygon[] = [];
    for (const shape of shapesToRender) {
      const res = getCagedCoordinates(
        rootNote,
        shape,
        scaleName,
        currentTuning,
        24,
      );
      res.coordinates.forEach((c) => allCoords.add(c));
      allBounds.push(...res.bounds);
      allPolygons.push(...res.polygons);
      res.wrappedNotes.forEach((k) => mergedWrappedNotes.add(k));
    }

    coords = Array.from(allCoords);
    bounds = allBounds;
    polygons = allPolygons;
  } else if (fingeringPattern === "3nps") {
    const res = get3NPSCoordinates(
      rootNote,
      scaleName,
      currentTuning,
      24,
      npsPosition,
    );
    coords = res.coordinates;
    bounds = res.bounds;
  } else {
    coords = getScaleNotes(rootNote, scaleName);
  }

  return {
    highlightNotes: coords,
    boxBounds: bounds,
    shapePolygons: polygons,
    wrappedNotes: mergedWrappedNotes,
  };
});

export const autoCenterTargetAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const { shapePolygons, boxBounds, wrappedNotes } = get(shapeDataAtom);
  const clickedShape = get(clickedShapeAtom);
  const startFret = get(fretStartAtom);
  const endFret = get(fretEndAtom);

  let target: number | undefined;

  if (fingeringPattern === "caged" && shapePolygons.length > 0) {
    if (clickedShape) {
      const clickedPoly = shapePolygons.find((p) => p.shape === clickedShape);
      if (clickedPoly && !clickedPoly.truncated) {
        target = getShapeCenterFret(clickedPoly);
      }
    }
    if (target === undefined) {
      const mainShape = findMainShape(
        shapePolygons,
        wrappedNotes,
        startFret,
        endFret,
      );
      if (mainShape) {
        target = getShapeCenterFret(mainShape);
      }
    }
  } else if (fingeringPattern === "3nps" && boxBounds.length > 0) {
    const lowestBounds = boxBounds.reduce((a, b) =>
      a.minFret <= b.minFret ? a : b,
    );
    target = lowestBounds.minFret;
  }

  return target;
});

export const isShapeLocalContextAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const cagedShapes = get(cagedShapesAtom);
  if (fingeringPattern === "3nps") return true;
  if (fingeringPattern === "caged" && cagedShapes.size === 1) return true;
  return false;
});

export const shapeContextLabelAtom = atom((get) => {
  const isShapeLocalContext = get(isShapeLocalContextAtom);
  if (!isShapeLocalContext) return null;

  const fingeringPattern = get(fingeringPatternAtom);
  if (fingeringPattern === "3nps") {
    return `In 3NPS position ${get(npsPositionAtom)}`;
  }
  if (fingeringPattern === "caged") {
    const shape = Array.from(get(cagedShapesAtom))[0];
    return shape ? `In ${shape} shape` : null;
  }
  return null;
});

// --- Practice Bar Derived Atoms ---

export const practiceBarColorNotesAtom = atom((get) => {
  const colorNotes = get(colorNotesAtom);
  const rootNote = get(rootNoteAtom);
  const useFlats = get(useFlatsAtom);

  if (colorNotes.length === 0) return [] as PracticeBarColorNote[];
  const rootIdx = NOTES.indexOf(rootNote);
  if (rootIdx === -1) return [] as PracticeBarColorNote[];
  return colorNotes.map((note) => {
    const noteIdx = NOTES.indexOf(note);
    const interval = (noteIdx - rootIdx + 12) % 12;
    const intervalName = INTERVAL_NAMES[interval] ?? "";
    return {
      internalNote: note,
      displayNote: formatAccidental(getNoteDisplay(note, rootNote, useFlats)),
      intervalName: formatAccidental(intervalName),
    };
  });
});

export const showChordPracticeBarAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return false;

  const practiceLens = get(practiceLensAtom);

  // Non-default lenses always show — user explicitly chose a practice focus.
  if (practiceLens !== "targets-color") return true;

  // For targets-color (default): suppress the bar for the diatonic simple case
  // where the chord is fully in-scale, root is linked, and no color tones exist
  // (nothing interesting to coach about).
  const focusPreset = get(focusPresetAtom);
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);
  const colorNotes = get(colorNotesAtom);
  const chordRoot = get(chordRootAtom);
  const rootNote = get(rootNoteAtom);

  const isDiatonicSimpleCase =
    focusPreset === "all" &&
    !hasOutsideChordMembers &&
    colorNotes.length === 0 &&
    chordRoot === rootNote;

  return !isDiatonicSimpleCase;
});

export const practiceBarTitleAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);
  if (!chordType) return "";
  return chordLabel ?? "";
});

// Badge is now minimal — always null (lens context shown via title + shape subtitle).
export const practiceBarBadgeAtom = atom(() => null as string | null);

export const shapeHighlightedNoteSetAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const { highlightNotes } = get(shapeDataAtom);
  const currentTuning = get(currentTuningAtom);

  if (fingeringPattern === "all") return null;
  const noteSet = new Set<string>();
  for (const coord of highlightNotes) {
    const dashIdx = coord.indexOf("-");
    if (dashIdx === -1) continue; // note name, not a coord
    const stringIdx = parseInt(coord.slice(0, dashIdx), 10);
    const fretIdx = parseInt(coord.slice(dashIdx + 1), 10);
    const openNote = currentTuning[stringIdx];
    if (openNote) noteSet.add(getFretNote(openNote, fretIdx));
  }
  return noteSet;
});

export const shapeLocalTargetMembersAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const chordType = get(chordTypeAtom);
  const allChordMembers = get(allChordMembersAtom);
  if (!shapeHighlightedNoteSet || !chordType) return [] as ChordRowEntry[];
  return allChordMembers.filter((m) =>
    shapeHighlightedNoteSet.has(m.internalNote),
  );
});

export const shapeLocalOutsideMembersAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const chordType = get(chordTypeAtom);
  const allChordMembers = get(allChordMembersAtom);
  if (!shapeHighlightedNoteSet || !chordType) return [] as ChordRowEntry[];
  return allChordMembers.filter((m) =>
    !m.inScale && shapeHighlightedNoteSet.has(m.internalNote),
  );
});

export const practiceBarColorNotesFilteredAtom = atom((get) => {
  const activeChordTones = get(activeChordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);
  const chordToneSet = new Set(activeChordTones);
  return practiceBarColorNotes.filter((n) => !chordToneSet.has(n.internalNote));
});

export const shapeLocalColorNotesFilteredAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const activeChordTones = get(activeChordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);

  if (!shapeHighlightedNoteSet) return [] as PracticeBarColorNote[];

  const chordToneSet = new Set(activeChordTones);
  return practiceBarColorNotes.filter(
    (n) =>
      shapeHighlightedNoteSet.has(n.internalNote) &&
      !chordToneSet.has(n.internalNote),
  );
});

export const shapeLocalColorNotesAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);
  if (!shapeHighlightedNoteSet) return [] as PracticeBarColorNote[];
  return practiceBarColorNotes.filter((n) =>
    shapeHighlightedNoteSet.has(n.internalNote),
  );
});

// ---------------------------------------------------------------------------
// Note Semantic Map — composable properties per note (multiple can coexist)
// ---------------------------------------------------------------------------

// Guide tone member names: 3rd and 7th (before formatAccidental)
const GUIDE_TONE_RAW = new Set(["b3", "3", "b7", "7"]);
// After formatAccidental: "b3"→"♭3", "b7"→"♭7"
const GUIDE_TONE_FORMATTED = new Set(["♭3", "3", "♭7", "7"]);

/**
 * Returns a map of note → NoteSemantics where multiple boolean properties can
 * coexist on one note. Crucially, a chord root that is outside the scale will
 * have both isChordRoot=true and isTension=true — something the old single-role
 * enum (NoteRole) could not represent.
 */
export const noteSemanticMapAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return new Map<string, NoteSemantics>();

  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const activeChordMembers = get(activeChordMembersAtom);
  const colorNotes = get(colorNotesAtom);

  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const colorNoteSet = new Set(colorNotes);

  const memberByNote = new Map<string, ResolvedChordMember>();
  for (const m of activeChordMembers) memberByNote.set(m.note, m);
  const activeChordToneSet = new Set(activeChordMembers.map((m) => m.note));

  const map = new Map<string, NoteSemantics>();
  for (const note of NOTES) {
    const isInScale = scaleNoteSet.has(note);
    const isChordRoot = note === chordRoot;
    const isChordTone = activeChordToneSet.has(note);
    const enh = ENHARMONICS[note];
    const isColorTone = colorNoteSet.has(note) || (!!enh && colorNoteSet.has(enh));
    const member = memberByNote.get(note);
    const isGuideTone = !!(member && GUIDE_TONE_RAW.has(member.name));
    const isTension = isChordTone && !isInScale;
    const isScaleRoot =
      note === rootNote ||
      ENHARMONICS[note] === rootNote ||
      ENHARMONICS[rootNote] === note;

    if (isInScale || isChordTone || isColorTone) {
      map.set(note, {
        isScaleRoot: !!isScaleRoot,
        isChordRoot,
        isChordTone,
        isInScale,
        isColorTone,
        isGuideTone,
        isTension,
        memberName: member?.name as ChordMemberName | undefined,
      });
    }
  }
  return map;
});

// ---------------------------------------------------------------------------
// Practice Cues — coaching lines derived from the active practice lens
// ---------------------------------------------------------------------------

/**
 * Derives ordered coaching cues for the practice bar based on the active lens.
 * Each cue has a label ("Land on", "Guide tones", "Color note", "Tension") and
 * a list of notes with styling hints and optional resolution targets.
 */
export const practiceCuesAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as PracticeCue[];

  const practiceLens = get(practiceLensAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const allChordMembers = get(allChordMembersAtom);
  const colorNotesFiltered = get(practiceBarColorNotesFilteredAtom);
  const scaleNotes = get(scaleNotesAtom);

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

  const toCueNote = (e: ChordRowEntry): PracticeCueNote => ({
    internalNote: e.internalNote,
    displayNote: e.displayNote,
    intervalName: e.memberName,
    role: e.role,
  });

  // Find the nearest in-scale note (half-step up or down) as a resolution target.
  const findResolution = (
    note: string,
  ): { internalNote: string; displayNote: string } | undefined => {
    const noteIdx = NOTES.indexOf(note);
    if (noteIdx === -1) return undefined;
    const scaleNoteSet = new Set(scaleNotes);
    const up = NOTES[(noteIdx + 1) % 12];
    const down = NOTES[(noteIdx + 11) % 12];
    const resolved = scaleNoteSet.has(up)
      ? up
      : scaleNoteSet.has(down)
        ? down
        : undefined;
    if (!resolved) return undefined;
    return { internalNote: resolved, displayNote: displayNote(resolved) };
  };

  const cues: PracticeCue[] = [];

  switch (practiceLens) {
    case "targets": {
      if (allChordMembers.length > 0) {
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      break;
    }

    case "guide-tones": {
      const guideNotes = allChordMembers.filter((e) =>
        GUIDE_TONE_FORMATTED.has(e.memberName),
      );
      if (guideNotes.length > 0) {
        cues.push({
          kind: "guide-tones",
          label: "Guide tones",
          notes: guideNotes.map((e) => ({
            ...toCueNote(e),
            role: "guide-tone" as const,
          })),
        });
      } else {
        // Fallback for power chords (no 3rd/7th): show all chord tones.
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      break;
    }

    case "color": {
      if (colorNotesFiltered.length > 0) {
        cues.push({
          kind: "color-note",
          label: colorNotesFiltered.length === 1 ? "Color note" : "Color notes",
          notes: colorNotesFiltered.map((n) => ({
            internalNote: n.internalNote,
            displayNote: n.displayNote,
            intervalName: n.intervalName,
            role: "color-tone" as const,
          })),
        });
      }
      break;
    }

    case "targets-color": {
      if (allChordMembers.length > 0) {
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      if (colorNotesFiltered.length > 0) {
        cues.push({
          kind: "color-note",
          label: colorNotesFiltered.length === 1 ? "Color note" : "Color notes",
          notes: colorNotesFiltered.map((n) => ({
            internalNote: n.internalNote,
            displayNote: n.displayNote,
            intervalName: n.intervalName,
            role: "color-tone" as const,
          })),
        });
      }
      break;
    }

    case "tension": {
      if (allChordMembers.length > 0) {
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      const tensionMembers = allChordMembers.filter((e) => !e.inScale);
      if (tensionMembers.length > 0) {
        cues.push({
          kind: "tension",
          label: "Tension",
          notes: tensionMembers.map((e) => ({
            ...toCueNote(e),
            role: "chord-tone-outside-scale" as const,
            resolvesTo: findResolution(e.internalNote),
          })),
        });
      }
      break;
    }
  }

  return cues;
});

/**
 * Shape-local variant: filters each cue's notes to those present in the
 * currently-highlighted shape positions. Falls back to empty when there's no
 * shape context (fingeringPattern === "all").
 */
export const shapeLocalPracticeCuesAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const cues = get(practiceCuesAtom);
  if (!shapeHighlightedNoteSet) return [] as PracticeCue[];
  return cues
    .map((cue) => ({
      ...cue,
      notes: cue.notes.filter((n) =>
        shapeHighlightedNoteSet.has(n.internalNote),
      ),
    }))
    .filter((cue) => cue.notes.length > 0);
});

// --- Actions ---

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
  set(chordFretSpreadAtom, RESET);
  set(viewModeAtom, RESET);
  set(practiceLensAtom, RESET);
  set(focusPresetAtom, RESET);
  set(customMembersAtom, RESET);
  set(fingeringPatternAtom, RESET);
  set(cagedShapesAtom, RESET);
  set(npsPositionAtom, RESET);
  set(displayFormatAtom, RESET);
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
