import { useMemo } from "react";
import { getEmphasis, type LeadLensContext } from "../utils/semantics";
import type { FretboardPlaybackSnapshot } from "./useFretboardPlaybackSnapshot";
import type { NoteData } from "./useNoteData";
import type { StaticFretboardTopologyNote } from "./useStaticFretboardTopology";

export interface RenderedFretboardNote extends NoteData {
  cx: number;
  cy: number;
}

export interface LeadLensSnapshot {
  commonWithNext: Set<string>;
  nextGuideTones: Set<string>;
  beatPosition: number;
  stepDurationBeats: number;
}

interface BuildAnimatedFretboardNotesProps {
  topology: StaticFretboardTopologyNote[];
  hasChordOverlay: boolean;
  leadLensSnapshot?: LeadLensSnapshot;
}

interface BuildRenderedFretboardNotesProps {
  noteData: NoteData[];
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
}

export interface UseAnimatedFretboardViewProps {
  topology: StaticFretboardTopologyNote[];
  playbackSnapshot?: FretboardPlaybackSnapshot | null;
  hasChordOverlay: boolean;
  displayFormat?: "notes" | "degrees" | "none";
  degreeColorsEnabled?: boolean;
  preferFlats?: boolean;
  scaleName?: string;
  rootNote?: string;
  fretCenterX: (fretIndex: number) => number;
  stringYAt: (stringIndex: number, x: number) => number;
}

function buildLeadLensSnapshot(
  playbackSnapshot: FretboardPlaybackSnapshot | null | undefined,
): LeadLensSnapshot | undefined {
  if (!playbackSnapshot) {
    return undefined;
  }

  return {
    commonWithNext: playbackSnapshot.commonWithNext,
    nextGuideTones: playbackSnapshot.nextGuideTones,
    beatPosition: playbackSnapshot.beatPosition,
    stepDurationBeats: playbackSnapshot.stepDurationBeats,
  };
}

export function buildAnimatedFretboardNotes({
  topology,
  hasChordOverlay,
  leadLensSnapshot,
}: BuildAnimatedFretboardNotesProps): NoteData[] {
  return topology.map((note) => {
    let leadContext: LeadLensContext | undefined;
    if (hasChordOverlay && leadLensSnapshot) {
      leadContext = {
        notePc: note.noteName,
        commonWithNext: leadLensSnapshot.commonWithNext,
        nextGuideTones: leadLensSnapshot.nextGuideTones,
        beatPosition: leadLensSnapshot.beatPosition,
        stepDurationBeats: leadLensSnapshot.stepDurationBeats,
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
  playbackSnapshot,
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

  const playbackEmphasisSnapshot = useMemo(
    () => buildLeadLensSnapshot(playbackSnapshot),
    [playbackSnapshot],
  );

  const noteData = useMemo(() => buildAnimatedFretboardNotes({
    topology,
    hasChordOverlay,
    leadLensSnapshot: playbackEmphasisSnapshot,
  }), [topology, hasChordOverlay, playbackEmphasisSnapshot]);

  const renderedNotes = useMemo(() => buildRenderedFretboardNotes({
    noteData,
    fretCenterX,
    stringYAt,
  }), [noteData, fretCenterX, stringYAt]);

  return useMemo(() => ({ noteData, renderedNotes }), [noteData, renderedNotes]);
}
