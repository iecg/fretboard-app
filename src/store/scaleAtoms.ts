import { atom, type Atom, type Getter, type Setter } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import {
  normalizeScaleName,
  type ScaleBrowseMode,
  getActiveScaleBrowseOption,
} from "@fretflow/core";
import {
  resolveAccidentalMode,
  SCALES,
  NOTES,
  INTERVAL_NAMES,
  getScaleNotes,
  getNoteDisplay, getNoteDisplayInScale,
  getDivergentNotes,
  formatAccidental,
} from "@fretflow/core";
import { DEGREE_COLORS, getDegreesForScale } from "@fretflow/core";
import { k, createStorage, rawStringStorage, booleanStorage, GET_ON_INIT, withStorageErrorBoundary } from "../utils/storage";
import { fingeringPatternAtom, cagedShapesAtom } from "./fingeringAtoms";
import { gatedAtom, EMPTY_SET, setsEqual } from "./atomUtils";
import type { CagedShape } from "@fretflow/core";
import type { PracticeBarColorNote } from "@fretflow/core";

const SCALE_BROWSE_MODES = ["parallel", "relative"] as const;

const scaleBrowseModeStorage = createStorage<ScaleBrowseMode>({
  validate: (v) => (SCALE_BROWSE_MODES as readonly string[]).includes(v),
});

const scaleNameStorage = createStorage<string>({
  onRead: normalizeScaleName,
  onWrite: normalizeScaleName,
});

export const baseRootNoteAtom = atomWithStorage(
  k("rootNote"),
  "C",
  rawStringStorage(),
  GET_ON_INIT,
);

/**
 * Side-effect listeners invoked when `rootNoteAtom` is written with a value
 * that differs from the current root. Modules wanting to react to a root
 * change (e.g. transposing manual-root progression steps) register here at
 * module load. Listeners run inside the same setter as the atom write, so
 * they share the same store / transaction.
 */
type RootChangeListener = (
  prevRoot: string,
  nextRoot: string,
  get: Getter,
  set: Setter,
) => void;

const rootChangeListeners: RootChangeListener[] = [];

export function registerRootChangeListener(listener: RootChangeListener): () => void {
  rootChangeListeners.push(listener);
  return () => {
    const idx = rootChangeListeners.indexOf(listener);
    if (idx !== -1) rootChangeListeners.splice(idx, 1);
  };
}

/**
 * Writable wrapper around `baseRootNoteAtom` that fans out to registered
 * listeners on change. Direct writes (e.g. `store.set(rootNoteAtom, "G")`)
 * trigger the side effects, so reactions stay wired regardless of whether
 * callers go through the `setRootNoteAtom` action.
 */
export const rootNoteAtom = atom(
  (get) => get(baseRootNoteAtom),
  (get, set, value: string | typeof RESET) => {
    const prev = get(baseRootNoteAtom);
    set(baseRootNoteAtom, value);
    const next = get(baseRootNoteAtom);
    if (prev === next) return;
    for (const listener of rootChangeListeners) {
      listener(prev, next, get, set);
    }
  },
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
  const legacy = withStorageErrorBoundary<string | null>("useFlats", null);
  const raw = legacy.getRaw();
  if (raw === null) return "auto";
  legacy.remove();
  return raw === "true" ? "flats" : "sharps";
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
  const degreesMap = getDegreesForScale(scaleName);

  const rootIdx = NOTES.indexOf(rootNote);
  return scaleNotes.map((note) => {
    const noteIdx = NOTES.indexOf(note);
    const chromaticInterval =
      rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : 0;
    const interval = INTERVAL_NAMES[chromaticInterval] ?? "1";
    const scaleDegree = degreesMap[chromaticInterval] ?? interval;
    const degreeColor = DEGREE_COLORS[scaleDegree] ?? undefined;
    return {
      internalNote: note,
      note: formatAccidental(
        getNoteDisplayInScale(note, rootNote, intervals, useFlats),
      ),
      interval: formatAccidental(interval),
      scaleDegree,
      degreeColor,
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
    return EMPTY_SET;
  },
  (get, set, update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const root = get(rootNoteAtom);
    const scale = get(scaleNameAtom);
    const currentNotes = get(hiddenNotesAtom);
    const nextNotes =
      typeof update === "function" ? update(currentNotes) : update;
    if (setsEqual(currentNotes, nextNotes)) return;
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
  const legacy = withStorageErrorBoundary<string | null>(k("scaleVisibilityMode"), null);
  const raw = legacy.getRaw();
  if (raw === null) return true;
  legacy.remove();
  return raw !== "off";
}

export const scaleVisibleAtom = atomWithStorage<boolean>(
  k("scaleVisible"),
  readLegacyScaleVisibility(),
  booleanStorage,
  GET_ON_INIT,
);

// Returns a set of notes that are hidden in the current scale.
export const effectiveHiddenNotesAtom = gatedAtom(
  hiddenNotesAtom,
  scaleVisibleAtom,
  new Set<string>(),
);

// Color notes (blue notes, characteristic tones) are cleared when scale is off.
export const effectiveColorNotesAtom: Atom<string[]> = gatedAtom(
  colorNotesAtom,
  scaleVisibleAtom,
  [] as string[],
);

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
