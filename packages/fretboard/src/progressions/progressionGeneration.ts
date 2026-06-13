import {
  getDegreeSequence,
  getDiatonicChord,
  type DegreeId,
} from "@fretflow/core";
import type { ProgressionPreset, ProgressionStep } from "./progressionDomain";

export type SuggestionFeel = "cadential" | "vamp" | "modal";

export interface SuggestedPreset extends Omit<ProgressionPreset, "category"> {
  category: "suggested";
  feel: SuggestionFeel;
}

interface ProgressionTemplate {
  feel: SuggestionFeel;
  ordinals: number[];
}

// NOTE: We deliberately do NOT use @tonaljs/progression here. Its
// fromRomanNumerals/toRomanNumerals API assumes a major-key roman-numeral
// frame, whereas getDiatonicChord is modal-aware (modes, borrowed chords,
// quality overrides). Routing generation through Tonal would be a downgrade.
// Revisit only if a "import from chord names" feature is added.

const CADENTIAL_TEMPLATES: ProgressionTemplate[] = [
  { feel: "cadential", ordinals: [3, 4, 0] }, // IV-V-I
  { feel: "cadential", ordinals: [1, 4, 0] }, // ii-V-I
  { feel: "cadential", ordinals: [0, 3, 4, 0] }, // I-IV-V-I
];

const CYCLE_TEMPLATES: ProgressionTemplate[] = [
  { feel: "cadential", ordinals: [5, 1, 4, 0] }, // vi-ii-V-I
  { feel: "cadential", ordinals: [2, 5, 1, 4, 0] }, // iii-vi-ii-V-I
];

const VAMP_TEMPLATES: ProgressionTemplate[] = [
  { feel: "vamp", ordinals: [0, 3] }, // I-IV shuttle
];

// Tonic to the scale's natural 7th degree — a modal vamp whose colour follows
// the selected mode (e.g. flat-VII in Dorian/Mixolydian/Aeolian).
const MODAL_TEMPLATES: ProgressionTemplate[] = [
  { feel: "modal", ordinals: [0, 6] }, // I-VII
];

function buildPreset(
  template: ProgressionTemplate,
  degrees: DegreeId[],
  scaleName: string,
  rootNote: string,
): SuggestedPreset | null {
  const steps: Array<Omit<ProgressionStep, "id">> = [];
  const labelParts: string[] = [];
  for (const ordinal of template.ordinals) {
    const degree = degrees[ordinal];
    if (!degree) return null;
    if (!getDiatonicChord(degree, scaleName, rootNote)) return null;
    steps.push({
      degree,
      duration: { value: 1, unit: "bar" },
      qualityOverride: null,
      manualRoot: null,
    });
    labelParts.push(degree);
  }
  return {
    id: `suggested-${template.feel}-${template.ordinals.join("")}`,
    label: labelParts.join("-"),
    category: "suggested",
    feel: template.feel,
    scale: scaleName,
    steps,
  };
}

export function generateCommonProgressions(
  scaleName: string,
  rootNote: string,
): SuggestedPreset[] {
  const degrees = getDegreeSequence(scaleName);
  if (degrees.length < 3) return [];

  const templates: ProgressionTemplate[] = [...CADENTIAL_TEMPLATES];
  if (degrees.length >= 6) templates.push(...CYCLE_TEMPLATES);
  if (degrees.length >= 4) templates.push(...VAMP_TEMPLATES);
  if (degrees.length >= 7) templates.push(...MODAL_TEMPLATES);

  const results: SuggestedPreset[] = [];
  for (const template of templates) {
    if (!template.ordinals.every((o) => o < degrees.length)) continue;
    const preset = buildPreset(template, degrees, scaleName, rootNote);
    if (preset) results.push(preset);
  }
  return results;
}
