import { atom } from "jotai";
import type { DegreeId } from "@fretflow/core";
import {
  activeProgressionStepAtom,
  activeResolvedProgressionStepAtom,
  updateProgressionStepRootAtom,
  updateProgressionStepQualityAtom,
  updateProgressionStepCachedDegreeAtom,
} from "./progressionAtoms";

/**
 * Phase 2.3 — unified "active chord" selectors.
 *
 * These atoms are the single write surface the Chord-tab UI uses to edit
 * "the current chord". They read from / write to the *active progression
 * step* so chord overrides live alongside the step itself.
 *
 * Phase 2.5 removed the standalone `chordOverlayModeAtom` /
 * `chordRootOverrideAtom` / `chordQualityOverrideAtom` / `chordDegreeAtom`
 * — `chordOverlayAtoms.ts` now exposes `chordRootAtom` / `chordTypeAtom`
 * as read-only views of the active step.
 */

/** Whether the active step is "manual" (out-of-scale). */
export const activeChordIsManualAtom = atom((get) => {
  const step = get(activeProgressionStepAtom);
  return step?.manualRoot != null;
});

/**
 * Current chord root (resolved): the diatonic root derived from degree + scale,
 * or `manualRoot` when set (honored by the resolver since Plan G11a).
 */
export const activeChordRootAtom = atom<string | null>((get) => {
  return get(activeResolvedProgressionStepAtom)?.root ?? null;
});

/**
 * Current chord quality: `qualityOverride` if set, else the diatonic-default
 * quality. Read via the resolver, which already merges override + default.
 */
export const activeChordQualityAtom = atom<string | null>((get) => {
  return get(activeResolvedProgressionStepAtom)?.quality ?? null;
});

/** Cached degree of the current chord (= the step's `degree` field). */
export const activeChordCachedDegreeAtom = atom<DegreeId | null>((get) => {
  return get(activeProgressionStepAtom)?.degree ?? null;
});

export interface ActiveChordPatch {
  root?: string | null;
  quality?: string | null;
  degree?: DegreeId;
}

/**
 * Writable: edits the active step's chord.
 * - `{ root }` sets `manualRoot` to that value (use null to clear).
 * - `{ quality }` sets `qualityOverride` to that value (use null to clear).
 * - `{ degree }` sets the cached `degree` (does NOT clear `qualityOverride`,
 *   per the Phase 2.1 contract — use `updateProgressionStepCachedDegreeAtom`
 *   to avoid the side effect of the older `updateProgressionStepDegreeAtom`).
 * Patches may combine.
 */
export const updateActiveChordAtom = atom(
  null,
  (get, set, patch: ActiveChordPatch) => {
    const step = get(activeProgressionStepAtom);
    if (!step) return;
    if (patch.root !== undefined) {
      set(updateProgressionStepRootAtom, { id: step.id, manualRoot: patch.root });
    }
    if (patch.quality !== undefined) {
      set(updateProgressionStepQualityAtom, {
        id: step.id,
        qualityOverride: patch.quality,
      });
    }
    if (patch.degree !== undefined) {
      set(updateProgressionStepCachedDegreeAtom, {
        id: step.id,
        degree: patch.degree,
      });
    }
  },
);
