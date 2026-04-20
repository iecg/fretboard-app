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
  scaleVisibleAtom,
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
  const scaleNotes = get(scaleNotesAtom);

  const displayNote = (note: string) =>
    formatAccidental(getNoteDisplay(note, chordRoot, useFlats));

  const toCueNote = (e: ChordRowEntry): PracticeCueNote => ({
    internalNote: e.internalNote,
    displayNote: e.displayNote,
    intervalName: e.memberName,
    role: e.role,
  });

  // Find the nearest in-scale note (up to 2 semitones in each direction).
  // Prefers 1-step up, then 1-step down, then 2-step up, then 2-step down.
  // The 2-step radius ensures coverage for pentatonic scales with wider gaps.
  const findResolution = (
    note: string,
  ): { internalNote: string; displayNote: string } | undefined => {
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
        // Separate "Resolve to" row — deduped resolution targets
        const seen = new Set<string>();
        const resolutionNotes: PracticeCueNote[] = [];
        for (const note of tensionNotes) {
          const target = note.resolvesTo;
          if (target && !seen.has(target.internalNote)) {
            seen.add(target.internalNote);
            resolutionNotes.push({
              internalNote: target.internalNote,
              displayNote: target.displayNote,
              role: "chord-tone-in-scale" as const,
            });
          }
        }
        if (resolutionNotes.length > 0) {
          cues.push({
            kind: "resolution",
            label: "Resolve to",
            notes: resolutionNotes,
          });
        }
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
  if (practiceLens !== "targets") return true;

  // When the scale is hidden, always show the bar — the user needs chord-tone
  // coaching even if the scale isn't visible on the fretboard.
  const scaleVisible = get(scaleVisibleAtom);
  if (!scaleVisible) return true;

  // For targets (default): suppress the bar for the diatonic simple case
  // where the chord is fully in-scale and the root is linked
  // (nothing interesting to coach about beyond what the fretboard already shows).
  const hasOutsideChordMembers = get(hasOutsideChordMembersAtom);
  const chordRoot = get(chordRootAtom);
  const rootNote = get(rootNoteAtom);

  const isDiatonicSimpleCase =
    !hasOutsideChordMembers &&
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
