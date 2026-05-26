import { useMemo } from "react";
import type { PracticeLens } from "@fretflow/core";
import { getLensEmphasis, type LeadLensContext } from "../utils/semantics";
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
  practiceLens?: PracticeLens;
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
  practiceLens?: PracticeLens;
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
  practiceLens,
  leadLensSnapshot,
}: BuildAnimatedFretboardNotesProps): NoteData[] {
  const activeLens = hasChordOverlay ? practiceLens : undefined;

  return topology.map((note) => {
    let leadContext: LeadLensContext | undefined;
    if (activeLens === "lead" && leadLensSnapshot) {
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
      applyLensEmphasis: getLensEmphasis(
        note.noteClass,
        activeLens,
        note.isGuideTone,
        leadContext,
      ),
    };
  });
}

export function buildRenderedFretboardNotes({
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
  practiceLens,
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

  const leadLensSnapshot = useMemo(() => (
    practiceLens === "lead" && playbackSnapshot
      ? {
          commonWithNext: playbackSnapshot.commonWithNext,
          nextGuideTones: playbackSnapshot.nextGuideTones,
          beatPosition: playbackSnapshot.beatPosition,
          stepDurationBeats: playbackSnapshot.stepDurationBeats,
        }
      : undefined
  ), [practiceLens, playbackSnapshot]);

  const noteData = useMemo(() => buildAnimatedFretboardNotes({
    topology,
    hasChordOverlay,
    practiceLens,
    leadLensSnapshot,
  }), [topology, hasChordOverlay, practiceLens, leadLensSnapshot]);

  const renderedNotes = useMemo(() => buildRenderedFretboardNotes({
    noteData,
    fretCenterX,
    stringYAt,
  }), [noteData, fretCenterX, stringYAt]);

  return useMemo(() => ({ noteData, renderedNotes }), [noteData, renderedNotes]);
}
