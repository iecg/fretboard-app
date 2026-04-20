import { atom } from "jotai";
import { RESET } from "jotai/utils";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
} from "../shapes";
import { getFretNote } from "../guitar";
import { STORAGE_PREFIX } from "../utils/storage";
import { getScaleNotes, formatAccidental, NOTES } from "../theory";
import type {
  NoteRole,
  ChordRowEntry,
  LegendItem,
} from "../theory";

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
  scaleVisibleAtom,
  toggleScaleVisibleAtom,
} from "./scaleAtoms";

export {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  practiceLensAtom,
  hideNonChordNotesAtom,
  chordTonesAtom,
  chordMembersAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  chordSummaryNotesAtom,
  allChordMembersAtom,
  chordMemberFactsAtom,
} from "./chordOverlayAtoms";

export {
  practiceBarColorNotesAtom,
  practiceBarColorNotesFilteredAtom,
  noteSemanticMapAtom,
  practiceCuesAtom,
  showChordPracticeBarAtom,
  practiceBarTitleAtom,
  practiceBarBadgeAtom,
  practiceBarLensLabelAtom,
  practiceBarSharedMembersAtom,
  practiceBarOutsideMembersAtom,
  lensAvailabilityContextAtom,
  lensAvailabilityAtom,
} from "./practiceLensAtoms";

export {
  tuningNameAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  currentTuningAtom,
} from "./layoutAtoms";

export {
  displayFormatAtom,
  mobileTabAtom,
  tabletTabAtom,
  landscapeNarrowTabAtom,
  settingsOverlayOpenAtom,
  type LandscapeNarrowTab,
} from "./uiAtoms";

export {
  enharmonicDisplayAtom,
  isMutedAtom,
  toggleMuteAtom,
} from "./audioAtoms";

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
  hiddenNotesAtom,
  colorNotesAtom,
  scaleVisibleAtom,
} from "./scaleAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  practiceLensAtom,
  chordTonesAtom,
  chordMembersAtom,
  hasOutsideChordMembersAtom,
  chordLabelAtom,
  allChordMembersAtom,
} from "./chordOverlayAtoms";
import {
  practiceCuesAtom,
  practiceBarColorNotesAtom,
} from "./practiceLensAtoms";
import {
  tuningNameAtom,
  fretZoomAtom,
  fretStartAtom,
  fretEndAtom,
  currentTuningAtom,
} from "./layoutAtoms";
import {
  displayFormatAtom,
  mobileTabAtom,
  tabletTabAtom,
  landscapeNarrowTabAtom,
} from "./uiAtoms";
import {
  enharmonicDisplayAtom,
  isMutedAtom,
} from "./audioAtoms";

// Legacy key migration is performed by utils/storage.ts at module load,
// before any atomWithStorage({ getOnInit: true }) reads. No action needed here.

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

// Effective shape data: eye-off returns empty highlightNotes so the fretboard
// renders no scale notes, while chord overlay continues to work via chordTones.
export const effectiveShapeDataAtom = atom((get) => {
  const visible = get(scaleVisibleAtom);
  const data = get(shapeDataAtom);
  if (!visible) return { ...data, highlightNotes: [] as string[] };
  return data;
});

// Effective hidden notes: returns actual hidden notes when scale is visible.
export const effectiveHiddenNotesAtom = atom((get) => {
  const visible = get(scaleVisibleAtom);
  if (!visible) return new Set<string>();
  return get(hiddenNotesAtom);
});

// Effective color notes: cleared when scale is off since color notes are
// part of the scale (blue notes, modal characteristic tones).
export const effectiveColorNotesAtom = atom((get) => {
  const visible = get(scaleVisibleAtom);
  if (!visible) return [] as string[];
  return get(colorNotesAtom);
});

export interface AutoCenterTarget {
  centerFret: number;
  minFret: number;
  maxFret: number;
}

export const autoCenterTargetAtom = atom((get) => {
  const fingeringPattern = get(fingeringPatternAtom);
  const { shapePolygons, boxBounds, wrappedNotes } = get(shapeDataAtom);
  const clickedShape = get(clickedShapeAtom);
  const startFret = get(fretStartAtom);
  const endFret = get(fretEndAtom);

  let target: AutoCenterTarget | undefined;

  if (fingeringPattern === "caged" && shapePolygons.length > 0) {
    if (clickedShape) {
      const clickedPoly = shapePolygons.find((p) => p.shape === clickedShape);
      if (clickedPoly && !clickedPoly.truncated) {
        target = {
          centerFret: getShapeCenterFret(clickedPoly),
          minFret: clickedPoly.intendedMin,
          maxFret: clickedPoly.intendedMax,
        };
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
        target = {
          centerFret: getShapeCenterFret(mainShape),
          minFret: mainShape.intendedMin,
          maxFret: mainShape.intendedMax,
        };
      }
    }
  } else if (fingeringPattern === "3nps" && boxBounds.length > 0) {
    const lowestBounds = boxBounds.reduce((a, b) =>
      a.minFret <= b.minFret ? a : b,
    );
    target = {
      centerFret: lowestBounds.minFret,
      minFret: lowestBounds.minFret,
      maxFret: lowestBounds.maxFret,
    };
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
  const chordTones = get(chordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);

  if (!shapeHighlightedNoteSet) return [] as typeof practiceBarColorNotes;

  const chordToneSet = new Set(chordTones);
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
  const activeChordTones = get(chordTonesAtom);

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
  const noteRoleMap = get(noteRoleMapAtom);

  const rolesPresent = new Set(summaryChordRow.map((e) => e.role));
  const items: LegendItem[] = [];
  if (rolesPresent.has("chord-root"))
    items.push({ role: "chord-root", label: "Chord root" });
  if (rolesPresent.has("chord-tone-in-scale"))
    items.push({ role: "chord-tone-in-scale", label: "Chord tone" });
  if (rolesPresent.has("chord-tone-outside-scale"))
    items.push({ role: "chord-tone-outside-scale", label: "Outside scale" });
  // Scale-only notes are always visible — no lens hides them.
  const hasScaleOnly = Array.from(noteRoleMap.values()).includes("scale-only");
  if (hasScaleOnly) {
    items.push({ role: "scale-only", label: "Scale only" });
  }
  return items;
});

export const showRelationshipRowAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordRoot = get(chordRootAtom);
  const rootNote = get(rootNoteAtom);
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);

  return !!(
    chordType &&
    (chordRoot !== rootNote || hasOutsideChordMembers)
  );
});

export const summaryNotesAtom = atom((get) => get(scaleNotesAtom));

export const chordMemberLabelsAtom = atom((get) =>
  get(chordMembersAtom)
    .map((m) => (m.name === "root" ? "1" : formatAccidental(m.name)))
    .join(" "),
);

export const summaryHeaderLeftAtom = atom((get) => {
  const scaleLabel = get(scaleLabelAtom);
  return scaleLabel;
});

export const summaryHeaderRightAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);

  if (!chordType || !chordLabel) return null;
  return chordLabel;
});

export const summaryPrimaryModeAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return "scale";
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
  set(scaleVisibleAtom, RESET);
  set(chordRootAtom, RESET);
  set(chordTypeAtom, RESET);
  set(linkChordRootAtom, RESET);
  set(chordFretSpreadAtom, RESET);
  set(practiceLensAtom, RESET);
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
