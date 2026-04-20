import { atom } from "jotai";
import {
  NOTES,
  ENHARMONICS,
  INTERVAL_NAMES,
  LENS_REGISTRY,
  getScaleNotes,
  getNoteDisplay,
  formatAccidental,
} from "../theory";
import type {
  ChordMemberName,
  LensAvailabilityContext,
  NoteSemantics,
  PracticeCue,
  PracticeCueNote,
  ChordRowEntry,
  PracticeBarColorNote,
} from "../theory";
import {
  rootNoteAtom,
  scaleNameAtom,
  scaleNotesAtom,
  colorNotesAtom,
  useFlatsAtom,
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
} from "./chordOverlayAtoms";

// Guide tone member names: 3rd and 7th (before formatAccidental)
const GUIDE_TONE_RAW = new Set(["b3", "3", "b7", "7"]);
// After formatAccidental: "b3"→"♭3", "b7"→"♭7"
const GUIDE_TONE_FORMATTED = new Set(["♭3", "3", "♭7", "7"]);

// ---------------------------------------------------------------------------
// Practice bar color notes — derived from scale color tones
// ---------------------------------------------------------------------------

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

export const practiceBarColorNotesFilteredAtom = atom((get) => {
  const chordTones = get(chordTonesAtom);
  const practiceBarColorNotes = get(practiceBarColorNotesAtom);
  const chordToneSet = new Set(chordTones);
  return practiceBarColorNotes.filter((n) => !chordToneSet.has(n.internalNote));
});

// ---------------------------------------------------------------------------
// Note semantic map — composable properties per note (multiple can coexist)
// ---------------------------------------------------------------------------

/**
 * Returns a map of note → NoteSemantics where multiple boolean properties can
 * coexist on one note. Crucially, a chord root that is outside the scale will
 * have both isChordRoot=true and isTension=true — something the old single-role
 * enum (NoteRole) could not represent.
 */
export const noteSemanticMapAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return new Map<string, NoteSemantics>();

  const rootNote = get(rootNoteAtom);
  const scaleName = get(scaleNameAtom);
  const chordRoot = get(chordRootAtom);
  const chordMembers = get(chordMembersAtom);
  const colorNotes = get(colorNotesAtom);

  const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
  const colorNoteSet = new Set(colorNotes);

  const memberByNote = new Map<string, (typeof chordMembers)[number]>();
  for (const m of chordMembers) memberByNote.set(m.note, m);
  const activeChordToneSet = new Set(chordMembers.map((m) => m.note));

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
      map.set(note, {
        isScaleRoot: !!isScaleRoot,
        isChordRoot,
        isChordTone,
        isInScale,
        isColorTone,
        isGuideTone,
        isTension,
        memberName: member?.name as ChordMemberName | undefined,
      });
    }
  }
  return map;
});

// ---------------------------------------------------------------------------
// Practice cues — coaching lines derived from the active practice lens
// ---------------------------------------------------------------------------

/**
 * Derives ordered coaching cues for the practice bar based on the active lens.
 * Each cue has a label ("Land on", "Guide tones", "Color note", "Tension") and
 * a list of notes with styling hints and optional resolution targets.
 */
export const practiceCuesAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return [] as PracticeCue[];

  const practiceLens = get(practiceLensAtom);
  const chordRoot = get(chordRootAtom);
  const useFlats = get(useFlatsAtom);
  const allChordMembers = get(allChordMembersAtom);
  const colorNotesFiltered = get(practiceBarColorNotesFilteredAtom);
  const scaleNotes = get(scaleNotesAtom);

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

  const toCueNote = (e: ChordRowEntry): PracticeCueNote => ({
    internalNote: e.internalNote,
    displayNote: e.displayNote,
    intervalName: e.memberName,
    role: e.role,
  });

  // Find the nearest in-scale note (half-step up or down) as a resolution target.
  const findResolution = (
    note: string,
  ): { internalNote: string; displayNote: string } | undefined => {
    const noteIdx = NOTES.indexOf(note);
    if (noteIdx === -1) return undefined;
    const scaleNoteSet = new Set(scaleNotes);
    const up = NOTES[(noteIdx + 1) % 12];
    const down = NOTES[(noteIdx + 11) % 12];
    const resolved = scaleNoteSet.has(up)
      ? up
      : scaleNoteSet.has(down)
        ? down
        : undefined;
    if (!resolved) return undefined;
    return { internalNote: resolved, displayNote: displayNote(resolved) };
  };

  const cues: PracticeCue[] = [];

  switch (practiceLens) {
    case "targets": {
      if (allChordMembers.length > 0) {
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      break;
    }

    case "guide-tones": {
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
      } else {
        // Fallback for power chords (no 3rd/7th): show all chord tones.
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      break;
    }

    case "color": {
      if (colorNotesFiltered.length > 0) {
        cues.push({
          kind: "color-note",
          label: colorNotesFiltered.length === 1 ? "Color note" : "Color notes",
          notes: colorNotesFiltered.map((n) => ({
            internalNote: n.internalNote,
            displayNote: n.displayNote,
            intervalName: n.intervalName,
            role: "color-tone" as const,
          })),
        });
      }
      break;
    }

    case "targets-color": {
      if (allChordMembers.length > 0) {
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      if (colorNotesFiltered.length > 0) {
        cues.push({
          kind: "color-note",
          label: colorNotesFiltered.length === 1 ? "Color note" : "Color notes",
          notes: colorNotesFiltered.map((n) => ({
            internalNote: n.internalNote,
            displayNote: n.displayNote,
            intervalName: n.intervalName,
            role: "color-tone" as const,
          })),
        });
      }
      break;
    }

    case "tension": {
      if (allChordMembers.length > 0) {
        cues.push({
          kind: "land-on",
          label: "Land on",
          notes: allChordMembers.map(toCueNote),
        });
      }
      const tensionMembers = allChordMembers.filter((e) => !e.inScale);
      if (tensionMembers.length > 0) {
        cues.push({
          kind: "tension",
          label: "Tension",
          notes: tensionMembers.map((e) => ({
            ...toCueNote(e),
            role: "chord-tone-outside-scale" as const,
            resolvesTo: findResolution(e.internalNote),
          })),
        });
      }
      break;
    }
  }

  return cues;
});

// ---------------------------------------------------------------------------
// Practice bar visibility + title
// ---------------------------------------------------------------------------

export const showChordPracticeBarAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return false;

  const practiceLens = get(practiceLensAtom);

  // Non-default lenses always show — user explicitly chose a practice focus.
  if (practiceLens !== "targets-color") return true;

  // For targets-color (default): suppress the bar for the diatonic simple case
  // where the chord is fully in-scale, root is linked, and no color tones exist
  // (nothing interesting to coach about).
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);
  const colorNotes = get(colorNotesAtom);
  const chordRoot = get(chordRootAtom);
  const rootNote = get(rootNoteAtom);

  const isDiatonicSimpleCase =
    !hasOutsideChordMembers &&
    colorNotes.length === 0 &&
    chordRoot === rootNote;

  return !isDiatonicSimpleCase;
});

export const practiceBarTitleAtom = atom((get) => {
  const chordType = get(chordTypeAtom);
  const chordLabel = get(chordLabelAtom);
  if (!chordType) return "";
  return chordLabel ?? "";
});

// Badge is now minimal — always null (lens context shown via lensLabel in dock header).
export const practiceBarBadgeAtom = atom(() => null as string | null);

// Active lens label sourced from LENS_REGISTRY — used by the dock header so the
// practice surface identifies its own focus without needing the controls open.
export const practiceBarLensLabelAtom = atom((get): string | null => {
  const chordType = get(chordTypeAtom);
  if (!chordType) return null;
  const lens = get(practiceLensAtom);
  const entry = LENS_REGISTRY.find((e) => e.id === lens);
  return entry?.label ?? null;
});

// ---------------------------------------------------------------------------
// Practice bar member rows (shared/outside split)
// ---------------------------------------------------------------------------

export const practiceBarSharedMembersAtom = atom((get) =>
  get(allChordMembersAtom).filter((e) => e.inScale),
);

export const practiceBarOutsideMembersAtom = atom((get) =>
  get(allChordMembersAtom).filter((e) => !e.inScale),
);

// ---------------------------------------------------------------------------
// Lens availability — registry-backed availability context + resolved entries
// ---------------------------------------------------------------------------

/**
 * Computes the context inputs used by LENS_REGISTRY predicates.
 * A single atom so callers can read just the context (e.g. for unit tests)
 * without consuming the full resolved list.
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
 * Maps every LENS_REGISTRY entry against the current state to produce a list
 * of lenses annotated with runtime availability and reason strings. Consumers
 * use this to render lens pickers with disabled states and tooltip explanations.
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
