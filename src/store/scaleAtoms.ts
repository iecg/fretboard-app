import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  normalizeScaleName,
  type ScaleBrowseMode,
  getActiveScaleBrowseOption,
} from "../theoryCatalog";
import {
  resolveAccidentalMode,
  SCALES,
  NOTES,
  INTERVAL_NAMES,
  getScaleNotes,
  getNoteDisplayInScale,
  getDivergentNotes,
  formatAccidental,
} from "../theory";
import { k, rawStringStorage, GET_ON_INIT } from "../utils/storage";
import { fingeringPatternAtom, cagedShapesAtom } from "./fingeringAtoms";
import type { CagedShape } from "../shapes";

// ---------------------------------------------------------------------------
// Scale-specific storage adapters
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scale base atoms
// ---------------------------------------------------------------------------

export const rootNoteAtom = atomWithStorage(
  k("rootNote"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);

export const baseScaleNameAtom = atomWithStorage(
  k("scaleName"),
  "Major",
  scaleNameStorage,
  GET_ON_INIT,
);

// Primary scale setter: resets CAGED shapes to "E" when scale changes,
// matching old useDisplayState useEffect.
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

// ---------------------------------------------------------------------------
// Accidentals — session-only, not persisted
// ---------------------------------------------------------------------------

// Reads a one-time legacy "useFlats" key from localStorage and translates it
// to the new mode. Clears the legacy key so subsequent loads start at "auto".
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

// Non-persisted: "auto" is a smart default that picks the best enharmonic
// spelling per root+scale, so session-only state avoids sticking a stale
// user choice across sessions.
export const accidentalModeAtom = atom<"sharps" | "flats" | "auto">(
  readLegacyAccidentalMode(),
);

export const useFlatsAtom = atom((get) =>
  resolveAccidentalMode(
    get(rootNoteAtom),
    get(scaleNameAtom),
    get(accidentalModeAtom),
  ),
);

// ---------------------------------------------------------------------------
// Scale derived atoms
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hidden notes — transient (resets when root or scale changes)
// ---------------------------------------------------------------------------

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
