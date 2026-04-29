import { atom } from "jotai";
import {
  NOTES,
  ENHARMONICS,

  LENS_REGISTRY,
  getScaleNotes,
  getNoteDisplay,
  formatAccidental,
  getDiatonicChord,
} from "../core/theory";
import type {
  ChordMemberName,
  LensAvailabilityContext,
  NoteSemantics,
  PracticeCue,
  PracticeCueNote,
  ChordRowEntry,

  PracticeBarNote,
  PracticeBarGroup,
} from "../core/theory";
import {
  getDegreesForScale,
  type DegreeId,
} from "../core/degrees";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleNotesAtom,
  colorNotesAtom,
  useFlatsAtom,
  practiceBarColorNotesAtom,
} from "./scaleAtoms";
import {
  chordRootAtom,
  chordTypeAtom,
  chordLabelAtom,
  chordTonesAtom,
  chordMembersAtom,
  practiceLensAtom,
  hasOutsideChordMembersAtom,
  allChordMembersAtom,
  chordDegreeAtom,
  chordOverlayModeAtom,
  chordOverlayHiddenAtom,
  chordHiddenNotesAtom,
} from "./chordOverlayAtoms";
import { shapeHighlightedNoteSetAtom } from "./shapeAtoms";

// Guide tone members: 3rd and 7th
const GUIDE_TONE_RAW = new Set(["b3", "3", "b7", "7"]);
const GUIDE_TONE_FORMATTED = new Set(["♭3", "3", "♭7", "7"]);

/**
 * Finds nearest in-scale resolution (≤2 semitones, step-up preferred).
 * Logic shared between practiceCuesAtom and practiceBarLandOnGroupBaseAtom.
 */
function findNearestScaleResolution(
  note: string,
  scaleNotes: readonly string[],
  displayNote: (n: string) => string,
): { internalNote: string; displayNote: string } | undefined {
  const noteIdx = NOTES.indexOf(note);
  if (noteIdx === -1) return undefined;
  const scaleNoteSet = new Set(scaleNotes);
  for (let step = 1; step <= 2; step++) {
    const up = NOTES[(noteIdx + step) % 12];
    const down = NOTES[(noteIdx - step + 12) % 12];
    if (scaleNoteSet.has(up)) return { internalNote: up, displayNote: displayNote(up) };
    if (scaleNoteSet.has(down)) return { internalNote: down, displayNote: displayNote(down) };
  }
  return undefined;
}

export const practiceBarColorNotesFilteredAtom = atom((get) => {
  const chordTones = get(chordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);
  const chordToneSet = new Set(chordTones);
  return practiceBarColorNotes.filter((n) => !chordToneSet.has(n.internalNote));
});

/**
 * Maps note → NoteSemantics allowing multiple properties to coexist.
 * Accommodates notes with multiple roles (e.g., chord root outside scale).
 */
export const noteSemanticMapAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return new Map<string, NoteSemantics>();
  // Eye toggle collapsed → no chord semantics (note colors revert to scale-only).
  if (get(chordOverlayHiddenAtom)) return new Map<string, NoteSemantics>();

  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const chordMembers = get(chordMembersAtom);
  const colorNotes = get(colorNotesAtom);
  const hiddenNotes = get(chordHiddenNotesAtom);

  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const colorNoteSet = new Set(colorNotes);

  // Per-note hides: drop hidden notes from chord-tone classification so the
  // fretboard renders them as scale-only / color-tone / inactive instead of
  // chord-tone-orange.
  const visibleMembers = hiddenNotes.size === 0
    ? chordMembers
    : chordMembers.filter((m) => !hiddenNotes.has(m.note));

  const memberByNote = new Map<string, (typeof visibleMembers)[number]>();
  for (const m of visibleMembers) memberByNote.set(m.note, m);
  const activeChordToneSet = new Set(visibleMembers.map((m) => m.note));

  // Phase 04: diatonic chord check (computed once per evaluation)
  const degreesMap = getDegreesForScale(scaleName);
  const chordDegree = get(chordDegreeAtom);
  const chordOverlayMode = get(chordOverlayModeAtom);

  let diatonicChordRoot: string | undefined;
  let diatonicChordQuality: string | undefined;
  if (chordDegree !== null && chordOverlayMode === "degree") {
    const diatonicResult = getDiatonicChord(chordDegree, scaleName, rootNote);
    diatonicChordRoot = diatonicResult?.root;
    diatonicChordQuality = diatonicResult?.quality;
  }

  const map = new Map<string, NoteSemantics>();
  for (const note of NOTES) {
    const isInScale = scaleNoteSet.has(note);
    const isChordRoot = note === chordRoot;
    const isChordTone = activeChordToneSet.has(note);
    const enh = ENHARMONICS[note];
    const isColorTone = colorNoteSet.has(note) || (!!enh && colorNoteSet.has(enh));
    const member = memberByNote.get(note);
    const isGuideTone = !!(member && GUIDE_TONE_RAW.has(member.name));
    const isTension = isChordTone && !isInScale;
    const isScaleRoot =
      note === rootNote ||
      ENHARMONICS[note] === rootNote ||
      ENHARMONICS[rootNote] === note;

    if (isInScale || isChordTone || isColorTone) {
      const tonicIdx = NOTES.indexOf(rootNote);
      const noteIdx = NOTES.indexOf(note);
      map.set(note, {
        isScaleRoot: !!isScaleRoot,
        isChordRoot,
        isChordTone,
        isInScale,
        isColorTone,
        isGuideTone,
        isTension,
        memberName: member?.name as ChordMemberName | undefined,
        scaleDegree: isInScale && tonicIdx !== -1 && noteIdx !== -1
          ? degreesMap[(noteIdx - tonicIdx + 12) % 12] as DegreeId | undefined
          : undefined,
        isDiatonicChord: isChordTone && isInScale
          && diatonicChordRoot !== undefined
          && diatonicChordRoot === chordRoot
          && diatonicChordQuality === chordType,
      });
    }
  }
  return map;
});

/**
 * Derives ordered coaching cues for the practice bar based on active lens.
 */
export const practiceCuesAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as PracticeCue[];

  const practiceLens = get(practiceLensAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const allChordMembers = get(allChordMembersAtom);
  const scaleNotes = get(scaleNotesAtom);

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

  const toCueNote = (e: ChordRowEntry): PracticeCueNote => ({
    internalNote: e.internalNote,
    displayNote: e.displayNote,
    intervalName: e.memberName,
    role: e.role,
  });

  const findResolution = (note: string) =>
    findNearestScaleResolution(note, scaleNotes, displayNote);

  const buildLandOnCue = (): PracticeCue => ({
    kind: "land-on",
    label: "Land on",
    notes: allChordMembers.map(toCueNote),
  });

  const cues: PracticeCue[] = [];

  switch (practiceLens) {
    case "targets": {
      if (allChordMembers.length > 0) {
        cues.push(buildLandOnCue());
      }
      break;
    }

    case "guide-tones": {
      if (allChordMembers.length > 0) {
        cues.push(buildLandOnCue());
      }
      const guideNotes = allChordMembers.filter((e) =>
        GUIDE_TONE_FORMATTED.has(e.memberName),
      );
      if (guideNotes.length > 0) {
        cues.push({
          kind: "guide-tones",
          label: "Guide tones",
          notes: guideNotes.map((e) => ({
            ...toCueNote(e),
            role: "guide-tone" as const,
          })),
        });
      }
      break;
    }

    case "tension": {
      if (allChordMembers.length > 0) {
        cues.push(buildLandOnCue());
      }
      const tensionMembers = allChordMembers.filter((e) => !e.inScale);
      if (tensionMembers.length > 0) {
        const tensionNotes = tensionMembers.map((e) => ({
          ...toCueNote(e),
          role: "chord-tone-outside-scale" as const,
          resolvesTo: findResolution(e.internalNote),
        }));
        cues.push({
          kind: "tension",
          label: "Tension",
          notes: tensionNotes,
        });
      }
      break;
    }
  }

  return cues;
});

const entryToBarNote = (e: ChordRowEntry): PracticeBarNote => ({
  internalNote: e.internalNote,
  displayNote: e.displayNote,
  intervalName: e.memberName,
  isChordRoot: e.role === "chord-root",
  isGuideTone: GUIDE_TONE_FORMATTED.has(e.memberName),
  isTension: !e.inScale,
  isInScale: e.inScale,
});

/**
 * Chord group — lens-independent. Always shows all chord members.
 */
export const practiceBarChordGroupAtom = atom((get): PracticeBarGroup => {
  const members = get(allChordMembersAtom);
  return {
    label: "Chord",
    notes: members.map(entryToBarNote),
  };
});

/**
 * Land-on group base — lens-driven coaching subset.
 *  - targets: all chord members
 *  - guide-tones: 3rd/7th members (falls back to all if none)
 *  - tension: outside-scale members with resolutions
 *
 * Shape narrowing applied in atoms.ts to avoid circular imports.
 */
export const practiceBarLandOnGroupBaseAtom = atom((get): PracticeBarGroup => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return { label: "Land on", notes: [] };

  const lens = get(practiceLensAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const allMembers = get(allChordMembersAtom);
  const scaleNotes = get(scaleNotesAtom);

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

  const findResolution = (note: string) =>
    findNearestScaleResolution(note, scaleNotes, displayNote);

  let subset: ChordRowEntry[];
  switch (lens) {
    case "guide-tones": {
      const gt = allMembers.filter((e) => GUIDE_TONE_FORMATTED.has(e.memberName));
      subset = gt.length > 0 ? gt : allMembers;
      break;
    }
    case "tension":
      subset = allMembers.filter((e) => !e.inScale);
      break;
    default:
      subset = allMembers;
  }

  const notes: PracticeBarNote[] = subset.map((e) => {
    const base = entryToBarNote(e);
    return lens === "tension"
      ? { ...base, resolvesTo: findResolution(e.internalNote) }
      : base;
  });

  return { label: "Land on", notes };
});

/**
 * Shape-aware Land-on group. Narrows the base lens subset to notes present in
 * the active shape context (except for tension, which stays global). The
 * Chord group never goes through this — it is always all chord members.
 */
export const practiceBarLandOnGroupAtom = atom((get) => {
  const base = get(practiceBarLandOnGroupBaseAtom);
  const lens = get(practiceLensAtom);
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  if (!shapeHighlightedNoteSet || lens === "tension") return base;
  const filtered = base.notes.filter((n) =>
    shapeHighlightedNoteSet.has(n.internalNote),
  );
  if (filtered.length === 0) return base;
  return { ...base, notes: filtered };
});

export const shapeLocalPracticeCuesAtom = atom((get) => {
  const shapeHighlightedNoteSet = get(shapeHighlightedNoteSetAtom);
  const cues = get(practiceCuesAtom);
  if (!shapeHighlightedNoteSet) return [] as typeof cues;
  return cues
    .map((cue) => ({
      ...cue,
      // Tension cues are never filtered by shape — tension notes and their
      // resolve targets must always be visible regardless of position context.
      notes: cue.kind === "tension"
        ? cue.notes
        : cue.notes.filter((n) => shapeHighlightedNoteSet.has(n.internalNote)),
    }))
    .filter((cue) => cue.notes.length > 0);
});

export const showChordPracticeBarAtom = atom((get) => {
  return !!get(chordTypeAtom);
});

export const practiceBarTitleAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);
  if (!chordType) return "";
  return chordLabel ?? "";
});

export const practiceBarBadgeAtom = atom(() => null as string | null);

/**
 * Active lens label from LENS_REGISTRY.
 */
export const practiceBarLensLabelAtom = atom((get): string | null => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return null;
  const lens = get(practiceLensAtom);
  const entry = LENS_REGISTRY.find((e) => e.id === lens);
  return entry?.label ?? null;
});

export const practiceBarSharedMembersAtom = atom((get) =>
  get(allChordMembersAtom).filter((e) => e.inScale),
);

export const practiceBarOutsideMembersAtom = atom((get) =>
  get(allChordMembersAtom).filter((e) => !e.inScale),
);

/**
 * Context inputs for LENS_REGISTRY predicates.
 */
export const lensAvailabilityContextAtom = atom((get): LensAvailabilityContext => {
  const chordType = get(chordTypeAtom);
  const chordMembers = get(chordMembersAtom);
  const colorNotes = get(colorNotesAtom);
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);

  return {
    hasChordOverlay: !!chordType,
    hasGuideTones: chordMembers.some((m) => GUIDE_TONE_RAW.has(m.name)),
    hasColorNotes: colorNotes.length > 0,
    hasOutsideTones: hasOutsideChordMembers,
  };
});

/**
 * Resolved list of lenses with availability and reasons.
 */
export const lensAvailabilityAtom = atom((get) => {
  const ctx = get(lensAvailabilityContextAtom);
  return LENS_REGISTRY.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    available: entry.isAvailable(ctx),
    reason: entry.unavailableReason(ctx),
    hideWhenUnavailable: entry.hideWhenUnavailable ?? false,
  }));
});
