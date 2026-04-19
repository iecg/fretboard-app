import { atom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
} from "../shapes";
import { k, STORAGE_PREFIX, rawStringStorage, booleanStorage, constrainedNumberStorage, GET_ON_INIT } from "../utils/storage";
import {
  NOTES,
  getScaleNotes,
  formatAccidental,
} from "../theory";
import type {
  NoteRole,
  ChordRowEntry,
  LegendItem,
} from "../theory";
import { TUNINGS, STANDARD_TUNING, getFretNote } from "../guitar";
import {
  MAX_FRET,
  FRET_ZOOM_MIN,
  FRET_ZOOM_MAX,
  FRET_ZOOM_DEFAULT,
} from "../constants";

// ---------------------------------------------------------------------------
// Domain module re-exports — all public atoms flow through atoms.ts so
// existing import paths (from "../store/atoms") continue to work unchanged.
// ---------------------------------------------------------------------------

export type { FingeringPattern } from "./fingeringAtoms";
export {
  fingeringPatternAtom,
  cagedShapesAtom,
  toggleCagedShapeAtom,
  selectSingleCagedShapeAtom,
  npsPositionAtom,
  clickedShapeAtom,
  recenterKeyAtom,
} from "./fingeringAtoms";

export {
  rootNoteAtom,
  baseScaleNameAtom,
  scaleNameAtom,
  scaleBrowseModeAtom,
  accidentalModeAtom,
  useFlatsAtom,
  scaleNotesAtom,
  colorNotesAtom,
  activeBrowseOptionAtom,
  scaleLabelAtom,
  degreeChipsAtom,
  hiddenNotesAtom,
  toggleHiddenNoteAtom,
} from "./scaleAtoms";

export {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  viewModeAtom,
  practiceLensAtom,
  focusPresetAtom,
  customMembersAtom,
  hideNonChordNotesAtom,
  chordTonesAtom,
  availableFocusPresetsAtom,
  chordMembersAtom,
  activeChordMembersAtom,
  activeChordTonesAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  chordSummaryNotesAtom,
  allChordMembersAtom,
} from "./chordOverlayAtoms";

export {
  practiceBarColorNotesAtom,
  practiceBarColorNotesFilteredAtom,
  noteSemanticMapAtom,
  practiceCuesAtom,
  showChordPracticeBarAtom,
  practiceBarTitleAtom,
  practiceBarBadgeAtom,
  practiceBarSharedMembersAtom,
  practiceBarOutsideMembersAtom,
} from "./practiceLensAtoms";

// ---------------------------------------------------------------------------
// Local imports from domain modules (for use in atoms defined below)
// ---------------------------------------------------------------------------

import {
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  clickedShapeAtom,
} from "./fingeringAtoms";
import {
  rootNoteAtom,
  scaleNameAtom,
  accidentalModeAtom,
  scaleNotesAtom,
  scaleLabelAtom,
  baseScaleNameAtom,
  scaleBrowseModeAtom,
} from "./scaleAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  viewModeAtom,
  practiceLensAtom,
  focusPresetAtom,
  customMembersAtom,
  activeChordTonesAtom,
  activeChordMembersAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  allChordMembersAtom,
} from "./chordOverlayAtoms";
import {
  practiceCuesAtom,
  practiceBarColorNotesAtom,
} from "./practiceLensAtoms";

// Legacy key migration is performed by utils/storage.ts at module load,
// before any atomWithStorage({ getOnInit: true }) reads. No action needed here.

// ---------------------------------------------------------------------------
// Storage helpers for remaining atoms
// ---------------------------------------------------------------------------

const fretCountStorage = constrainedNumberStorage({ min: 0, max: MAX_FRET, integer: true });
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

// ---------------------------------------------------------------------------
// Display atoms
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Audio / UI state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Derived utility atoms
// ---------------------------------------------------------------------------

export const currentTuningAtom = atom(
  (get) => TUNINGS[get(tuningNameAtom)] || STANDARD_TUNING,
);

// ---------------------------------------------------------------------------
// Shape derived atoms
// ---------------------------------------------------------------------------

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
      res.wrappedNotes.forEach((kk) => mergedWrappedNotes.add(kk));
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

// ---------------------------------------------------------------------------
// Shape-local atoms (depend on shapeHighlightedNoteSetAtom)
// ---------------------------------------------------------------------------

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

export const shapeLocalColorNotesFilteredAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const activeChordTones = get(activeChordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);

  if (!shapeHighlightedNoteSet) return [] as typeof practiceBarColorNotes;

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
  if (!shapeHighlightedNoteSet) return [] as typeof practiceBarColorNotes;
  return practiceBarColorNotes.filter((n) =>
    shapeHighlightedNoteSet.has(n.internalNote),
  );
});

export const shapeLocalPracticeCuesAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const cues = get(practiceCuesAtom);
  if (!shapeHighlightedNoteSet) return [] as typeof cues;
  return cues
    .map((cue) => ({
      ...cue,
      notes: cue.notes.filter((n) =>
        shapeHighlightedNoteSet.has(n.internalNote),
      ),
    }))
    .filter((cue) => cue.notes.length > 0);
});

// ---------------------------------------------------------------------------
// Combined / summary derived atoms
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Actions
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
