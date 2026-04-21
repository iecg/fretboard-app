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
import { k, rawStringStorage, booleanStorage, GET_ON_INIT } from "../utils/storage";
import { fingeringPatternAtom, cagedShapesAtom } from "./fingeringAtoms";
import type { CagedShape } from "../shapes";

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
    } catch {}
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
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
    } catch {}
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

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

// Resets CAGED shapes to "E" when scale changes to maintain position consistency.
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

// Translates legacy "useFlats" to new mode and clears the stale key.
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

// Session-only: "auto" picks best enharmonic spelling per root+scale.
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

export const scaleNotesAtom = atom((get) =>
  getScaleNotes(get(rootNoteAtom), get(scaleNameAtom)),
);

export const colorNotesAtom = atom((get) => {
  const scaleName = get(scaleNameAtom);
  const rootNote = get(rootNoteAtom);
  const intervals = SCALES[scaleName];
  if (!intervals) return [];
  // Blue note is b5 in Minor Blues, b3 in Major Blues.
  if (scaleName === "Minor Blues") {
    const rootIdx = NOTES.indexOf(rootNote);
    return rootIdx >= 0 ? [NOTES[(rootIdx + 6) % 12]] : [];
  }
  if (scaleName === "Major Blues") {
    const rootIdx = NOTES.indexOf(rootNote);
    return rootIdx >= 0 ? [NOTES[(rootIdx + 3) % 12]] : [];
  }
  // Modal scales: notes that diverge from the reference major/minor.
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

// Transient: resets when root or scale changes.
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

// Maps old tri-state "off" → false and removes the stale key.
function readLegacyScaleVisibility(): boolean {
  try {
    const legacy = localStorage.getItem(k("scaleVisibilityMode"));
    if (legacy === null) return true;
    localStorage.removeItem(k("scaleVisibilityMode"));
    return legacy !== "off";
  } catch {
    return true;
  }
}

export const scaleVisibleAtom = atomWithStorage<boolean>(
  k("scaleVisible"),
  readLegacyScaleVisibility(),
  booleanStorage,
  GET_ON_INIT,
);

// Toggling off also clears per-note hidden state so that re-enabling shows the full scale.
export const toggleScaleVisibleAtom = atom(null, (get, set) => {
  const visible = get(scaleVisibleAtom);
  if (visible) {
    set(hiddenNotesAtom, new Set<string>());
    set(scaleVisibleAtom, false);
  } else {
    set(scaleVisibleAtom, true);
  }
});
