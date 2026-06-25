import { atom } from "jotai";
import type { ShareState } from "../utils/shareCodec";
import type { ProgressionStep } from "@fretflow/fretboard/progressions/progressionDomain";
import { createProgressionStep } from "@fretflow/fretboard/progressions/progressionDomain";
import { baseRootNoteAtom, baseScaleNameAtom } from "@fretflow/fretboard/store/scaleAtoms";
import {
  progressionTempoBpmAtom,
  beatsPerBarAtom,
  timeSignatureDenominatorAtom,
  progressionStepsAtom,
} from "@fretflow/fretboard/store/progressionAtoms";

export const urlOverridesAtom = atom<ShareState | null>(null);

export const effectiveRootNoteAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.root ?? get(baseRootNoteAtom);
});

export const effectiveScaleNameAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.scale ?? get(baseScaleNameAtom);
});

export const effectiveTempoAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.tempo ?? get(progressionTempoBpmAtom);
});

export const effectiveBeatsPerBarAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.timeSignature.numerator ?? get(beatsPerBarAtom);
});

export const effectiveTimeSignatureDenominatorAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.timeSignature.denominator ?? get(timeSignatureDenominatorAtom);
});

function shareStepsToProgressionSteps(steps: ShareState["steps"]): ProgressionStep[] {
  return steps.map((step) =>
    createProgressionStep({
      degree: step.degree,
      qualityOverride: step.qualityOverride,
      duration: step.duration,
    }),
  );
}

export const effectiveProgressionStepsAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  if (overrides) return shareStepsToProgressionSteps(overrides.steps);
  return get(progressionStepsAtom);
});

export const clearUrlOverridesAtom = atom(null, (_get, set) => {
  set(urlOverridesAtom, null);
});
