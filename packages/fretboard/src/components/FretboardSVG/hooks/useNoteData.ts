import { useMemo } from "react";
import {
  type NoteSemantics,
} from "@fretflow/core";
import type { ShapePolygon, CagedShape } from "@fretflow/core";
import type { ActiveShapeType } from "../../../hooks/useFretboardState";
import {
  type BoxBound,
  type LensEmphasis,
} from "../utils/semantics";
import {
  useStaticFretboardTopology,
  type UseStaticFretboardTopologyProps,
} from "./useStaticFretboardTopology";
import { buildAnimatedFretboardNotes } from "./useAnimatedFretboardView";
import type { EmphasisContext } from "./useEmphasisContext";

// NOTE: adding a render-affecting field here? Also add it to
// `renderedNoteSignature` in useAnimatedFretboardView.ts, or cached notes will
// render stale.
export interface NoteData {
  stringIndex: number;
  fretIndex: number;
  noteName: string;
  octave: number;
  noteClass: string;
  /** Scale-aware spelled pitch (e.g. "Bb"), independent of displayFormat. The
   * visible note label in "notes" mode and the a11y aria-label both source from
   * this so screen-reader output matches what is shown. See issue #493. */
  displayName: string;
  displayValue: string;
  applyDimOpacity: boolean;
  applyLensEmphasis: LensEmphasis;
  /** Discrete voice-leading role during the lead-in window. */
  transitionRole?: import("../utils/semantics").TransitionRole;
  /** Whether this position is inside the active chord/shape region. */
  isInRegion: boolean;
  isHidden: boolean;
  isTension: boolean;
  isGuideTone: boolean;
  fullChordShape?: CagedShape;
}

export interface UseNoteDataProps {
  numStrings: UseStaticFretboardTopologyProps["numStrings"];
  fretboardLayout: UseStaticFretboardTopologyProps["fretboardLayout"];
  totalColumns: UseStaticFretboardTopologyProps["totalColumns"];
  startFret: UseStaticFretboardTopologyProps["startFret"];
  maxFret: UseStaticFretboardTopologyProps["maxFret"];
  highlightNotes: UseStaticFretboardTopologyProps["highlightNotes"];
  hasChordOverlay: boolean;
  chordTones: UseStaticFretboardTopologyProps["chordTones"];
  rootNote: UseStaticFretboardTopologyProps["rootNote"];
  chordRoot?: UseStaticFretboardTopologyProps["chordRoot"];
  colorNotes: UseStaticFretboardTopologyProps["colorNotes"];
  shapePolygons: ShapePolygon[];
  chordFretSpread: UseStaticFretboardTopologyProps["chordFretSpread"];
  activePattern?: ActiveShapeType extends never ? never : UseStaticFretboardTopologyProps["activePattern"];
  shapeScope?: UseStaticFretboardTopologyProps["shapeScope"];
  activeShape?: ActiveShapeType;
  scaleName: UseStaticFretboardTopologyProps["scaleName"];
  preferFlats: UseStaticFretboardTopologyProps["preferFlats"];
  displayFormat?: UseStaticFretboardTopologyProps["displayFormat"];
  wrappedNotes: UseStaticFretboardTopologyProps["wrappedNotes"];
  tuning: UseStaticFretboardTopologyProps["tuning"];
  noteSemantics?: Map<string, NoteSemantics>;
  fullChordPositionKeys?: Set<string>;
  fullChordShapeByPosition?: Map<string, CagedShape>;
  chordBoxBounds: BoxBound[] | null;
  /**
   * Compatibility surface for non-SVG callers. FretboardSVG now drives playback
   * visuals through useAnimatedFretboardView instead of this wrapper.
   */
  leadLensData?: EmphasisContext | null;
}

export function useNoteData({
  numStrings,
  fretboardLayout,
  totalColumns,
  startFret,
  maxFret,
  highlightNotes,
  hasChordOverlay,
  chordTones,
  rootNote,
  chordRoot,
  colorNotes,
  shapePolygons,
  chordFretSpread,
  activePattern,
  shapeScope,
  activeShape,
  scaleName,
  preferFlats,
  displayFormat,
  wrappedNotes,
  tuning,
  noteSemantics,
  fullChordPositionKeys,
  fullChordShapeByPosition,
  chordBoxBounds,
  leadLensData,
}: UseNoteDataProps): NoteData[] {
  const topology = useStaticFretboardTopology({
    numStrings,
    fretboardLayout,
    totalColumns,
    startFret,
    maxFret,
    highlightNotes,
    hasChordOverlay,
    chordTones,
    rootNote,
    chordRoot,
    colorNotes,
    shapePolygons,
    chordFretSpread,
    activePattern,
    shapeScope,
    activeShape,
    scaleName,
    preferFlats,
    displayFormat,
    wrappedNotes,
    tuning,
    noteSemantics,
    fullChordPositionKeys,
    fullChordShapeByPosition,
    chordBoxBounds,
  });

  return useMemo(() => buildAnimatedFretboardNotes({
    topology,
    hasChordOverlay,
    emphasisContext: leadLensData,
  }), [topology, hasChordOverlay, leadLensData]);
}
