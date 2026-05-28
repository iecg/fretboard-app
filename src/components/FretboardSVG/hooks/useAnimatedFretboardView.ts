import { useMemo } from "react";
import { getEmphasis, type LeadLensContext } from "../utils/semantics";
import type { NoteData } from "./useNoteData";
import type { StaticFretboardTopologyNote } from "./useStaticFretboardTopology";
import { useEmphasisContext, type EmphasisContext } from "./useEmphasisContext";

export interface RenderedFretboardNote extends NoteData {
  cx: number;
  cy: number;
}

interface BuildAnimatedFretboardNotesProps {
  topology: StaticFretboardTopologyNote[];
  hasChordOverlay: boolean;
  emphasisContext?: EmphasisContext | null;
}

interface BuildRenderedFretboardNotesProps {
  noteData: NoteData[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
}

export interface UseAnimatedFretboardViewProps {
  topology: StaticFretboardTopologyNote[];
  hasChordOverlay: boolean;
  displayFormat?: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  preferFlats?: boolean;
  scaleName?: string;
  rootNote?: string;
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
}

export function buildAnimatedFretboardNotes({
  topology,
  hasChordOverlay,
  emphasisContext,
}: BuildAnimatedFretboardNotesProps): NoteData[] {
  return topology.map((note) => {
    let leadContext: LeadLensContext | undefined;
    if (hasChordOverlay && emphasisContext) {
      leadContext = {
        notePc: note.noteName,
        commonWithNext: emphasisContext.commonWithNext,
        nextGuideTones: emphasisContext.nextGuideTones,
        nextChordTones: emphasisContext.nextChordTones,
        anticipationActive: emphasisContext.anticipationActive,
      };
    }

    return {
      ...note,
      applyLensEmphasis: getEmphasis(
        note.noteClass,
        note.isGuideTone,
        leadContext,
      ),
    };
  });
}

function buildRenderedFretboardNotes({
  noteData,
  fretCenterX,
  stringYAt,
}: BuildRenderedFretboardNotesProps): RenderedFretboardNote[] {
  return noteData.map((note) => {
    const cx = fretCenterX(note.fretIndex);
    return {
      ...note,
      cx,
      cy: stringYAt(note.stringIndex, cx),
    };
  });
}

export function useAnimatedFretboardView({
  topology,
  hasChordOverlay,
  displayFormat,
  degreeColorsEnabled,
  preferFlats,
  scaleName,
  rootNote,
  fretCenterX,
  stringYAt,
}: UseAnimatedFretboardViewProps) {
  void displayFormat;
  void degreeColorsEnabled;
  void preferFlats;
  void scaleName;
  void rootNote;

  const emphasisContext = useEmphasisContext(hasChordOverlay);

  const noteData = useMemo(() => buildAnimatedFretboardNotes({
    topology,
    hasChordOverlay,
    emphasisContext,
  }), [topology, hasChordOverlay, emphasisContext]);

  const renderedNotes = useMemo(() => buildRenderedFretboardNotes({
    noteData,
    fretCenterX,
    stringYAt,
  }), [noteData, fretCenterX, stringYAt]);

  return useMemo(() => ({ noteData, renderedNotes }), [noteData, renderedNotes]);
}
