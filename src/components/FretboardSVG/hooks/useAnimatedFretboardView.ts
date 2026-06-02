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
        incomingTones: emphasisContext.incomingTones,
        departingTones: emphasisContext.departingTones,
        leadInActive: emphasisContext.leadInActive,
      };
    }

    const applyLensEmphasis = getEmphasis(note.noteClass, note.isGuideTone, leadContext);
    return {
      ...note,
      applyLensEmphasis,
      transitionRole: applyLensEmphasis.transitionRole,
    };
  });
}

/**
 * Reference cache for {@link buildRenderedFretboardNotes}. Keyed by note
 * position (`"${stringIndex}-${fretIndex}"`). A cache hit (same signature)
 * returns the previously-built object so a memoized per-note renderer can bail
 * on unchanged notes — the React Compiler does not provide this stability
 * because each builder call produces fresh objects via spread.
 *
 * The map is reseeded fresh each call and only retains keys seen this pass, so
 * stale positions cannot leak across fretboard reconfigurations.
 *
 * ASSUMPTION: a SINGLE FretboardSVG instance is mounted at a time (today
 * guaranteed by App.tsx). This cache is module-global, so two fretboards
 * mounted concurrently would thrash it. Worst case is lost perf (each note
 * misses and rebuilds a fresh, correct object) — there is NO correctness bug.
 * If concurrent fretboards ever become a thing, key this cache per-instance.
 */
let renderedNoteCache = new Map<
  string,
  { sig: string; result: RenderedFretboardNote }
>();

/**
 * Cheap signature of EXACTLY the fields that affect the rendered output of a
 * single note (the destructured set consumed by `FretboardNoteLayer`, plus the
 * derived geometry `cx`/`cy`). If this string is unchanged for a position, the
 * rendered SVG for that note is byte-identical, so its object can be reused.
 *
 * STALE-RENDER GUARD: if you add a field that affects a note's rendered output
 * — to the per-note render in `FretboardNoteLayer.tsx`, or to
 * `RenderedFretboardNote` / `NoteData` — you MUST add it here too. Otherwise a
 * cached note whose only change is that field will keep its old object
 * reference and render STALE (the memoized per-note component will bail).
 */
function renderedNoteSignature(
  note: RenderedFretboardNote,
): string {
  const emph = note.applyLensEmphasis;
  return [
    note.stringIndex,
    note.fretIndex,
    note.noteName,
    note.octave,
    note.noteClass,
    note.displayName,
    note.displayValue,
    note.cx,
    note.cy,
    note.applyDimOpacity,
    emph.opacityBoost,
    emph.radiusBoost,
    emph.glowColor ?? "",
    emph.transitionRole ?? "",
    note.isHidden,
    note.isTension,
    note.isGuideTone,
    note.scaleDegree ?? "",
    note.degreeColor ?? "",
    note.fullChordShape ?? "",
    note.isInRegion,
  ].join("|");
}

export function buildRenderedFretboardNotes({
  noteData,
  fretCenterX,
  stringYAt,
}: BuildRenderedFretboardNotesProps): RenderedFretboardNote[] {
  const prevCache = renderedNoteCache;
  // Fresh map seeded from the previous pass; only keys touched this pass are
  // retained, so removed/reconfigured positions cannot accumulate.
  const nextCache = new Map<
    string,
    { sig: string; result: RenderedFretboardNote }
  >();

  const result = noteData.map((note) => {
    const key = `${note.stringIndex}-${note.fretIndex}`;
    const cx = fretCenterX(note.fretIndex);
    const positioned: RenderedFretboardNote = { ...note, cx, cy: stringYAt(note.stringIndex, cx) };
    const sig = renderedNoteSignature(positioned);
    const prev = prevCache.get(key);

    if (prev && prev.sig === sig) {
      // Cache hit — reuse the stable object reference so the memoized per-note renderer can bail.
      nextCache.set(key, prev);
      return prev.result;
    }
    nextCache.set(key, { sig, result: positioned });
    return positioned;
  });

  renderedNoteCache = nextCache;
  return result;
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
