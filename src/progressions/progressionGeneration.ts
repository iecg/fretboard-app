import {
  getDegreeSequence,
  getDiatonicChord,
  type DegreeId,
} from "@fretflow/core";
import type { ProgressionPreset, ProgressionStep } from "./progressionDomain";

interface GeneratedPreset extends Omit<ProgressionPreset, "category"> {
  category: "suggested";
}

interface ProgressionTemplate {
  label: string;
  ordinals: number[];
}

const CADENTIAL_TEMPLATES: ProgressionTemplate[] = [
  { label: "IV-V-I", ordinals: [3, 4, 0] },
  { label: "ii-V-I", ordinals: [1, 4, 0] },
  { label: "I-IV-V-I", ordinals: [0, 3, 4, 0] },
];

const CYCLE_TEMPLATES: ProgressionTemplate[] = [
  { label: "vi-ii-V-I", ordinals: [5, 1, 4, 0] },
  { label: "iii-vi-ii-V-I", ordinals: [2, 5, 1, 4, 0] },
];

function buildPreset(
  id: string,
  label: string,
  degrees: DegreeId[],
  ordinals: number[],
  scaleName: string,
  rootNote: string,
): GeneratedPreset | null {
  const steps: Array<Omit<ProgressionStep, "id">> = [];
  for (const ordinal of ordinals) {
    const degree = degrees[ordinal];
    if (!degree) return null;
    const chord = getDiatonicChord(degree, scaleName, rootNote);
    if (!chord) return null;
    steps.push({
      degree,
      duration: { value: 1, unit: "bar" },
      qualityOverride: null,
      manualRoot: null,
    });
  }
  return { id, label, category: "suggested", steps };
}

export function generateCommonProgressions(
  scaleName: string,
  rootNote: string,
): GeneratedPreset[] {
  const degrees = getDegreeSequence(scaleName);
  if (degrees.length < 3) return [];

  const results: GeneratedPreset[] = [];
  let counter = 0;

  const tryTemplate = (template: ProgressionTemplate) => {
    if (template.ordinals.every((o) => o < degrees.length)) {
      const preset = buildPreset(
        `generated-${counter}`,
        template.label,
        degrees,
        template.ordinals,
        scaleName,
        rootNote,
      );
      if (preset) {
        results.push(preset);
        counter += 1;
      }
    }
  };

  for (const t of CADENTIAL_TEMPLATES) tryTemplate(t);
  if (degrees.length >= 6) {
    for (const t of CYCLE_TEMPLATES) tryTemplate(t);
  }
  if (degrees.length >= 4) {
    const shuttle = buildPreset(
      `generated-${counter}`,
      `${degrees[0]}-${degrees[3]}`,
      degrees,
      [0, 3],
      scaleName,
      rootNote,
    );
    if (shuttle) {
      results.push(shuttle);
      counter += 1;
    }
  }
  return results;
}
