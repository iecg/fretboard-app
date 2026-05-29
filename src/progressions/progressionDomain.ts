import {
  CHORD_DEFINITIONS,
  formatAccidental,
  getChordDisplayLabel,
  getDegreeSequence,
  getDiatonicChord,
  getNoteDisplay,
  getScaleNotes,
  transposeNoteToSharps,
  type DegreeId,
} from "@fretflow/core";

type ProgressionStepDurationUnit = "beat" | "bar";

export interface ProgressionStepDuration {
  value: number;
  unit: ProgressionStepDurationUnit;
}

const DEFAULT_PROGRESSION_STEP_DURATION: ProgressionStepDuration = {
  value: 1,
  unit: "bar",
};

export const MIN_PROGRESSION_STEP_DURATION_VALUE = 1;
export const MAX_PROGRESSION_STEP_DURATION_VALUE = 16;

const LEGACY_DURATION_MAP: Record<string, ProgressionStepDuration> = {
  "1-beat": { value: 1, unit: "beat" },
  "2-beats": { value: 2, unit: "beat" },
  "1-bar": { value: 1, unit: "bar" },
  "2-bars": { value: 2, unit: "bar" },
};

function isProgressionDurationUnit(value: unknown): value is ProgressionStepDurationUnit {
  return value === "beat" || value === "bar";
}

export function isProgressionDuration(value: unknown): value is ProgressionStepDuration {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ProgressionStepDuration;
  return (
    typeof candidate.value === "number"
    && Number.isInteger(candidate.value)
    && candidate.value >= MIN_PROGRESSION_STEP_DURATION_VALUE
    && candidate.value <= MAX_PROGRESSION_STEP_DURATION_VALUE
    && isProgressionDurationUnit(candidate.unit)
  );
}

export function migrateLegacyDuration(value: unknown): ProgressionStepDuration {
  if (typeof value === "string") {
    return LEGACY_DURATION_MAP[value] ?? { ...DEFAULT_PROGRESSION_STEP_DURATION };
  }
  if (isProgressionDuration(value)) return value;
  return { ...DEFAULT_PROGRESSION_STEP_DURATION };
}

export function formatProgressionDurationLabel(duration: ProgressionStepDuration): string {
  return `${duration.value} ${duration.unit}${duration.value === 1 ? "" : "s"}`;
}

const CHORD_QUALITY_SUFFIX: Record<string, string> = {
  M: "",
  m: "m",
  dim: "°",
  aug: "+",
  "6": "6",
  m6: "m6",
  maj7: "maj7",
  m7: "m7",
  "7": "7",
  dim7: "°7",
  m7b5: "ø7",
  mMaj7: "mMaj7",
};

/**
 * Compact chord label (e.g. "C", "Am", "G7", "Fø7") for tight display
 * surfaces such as the progression track. Falls back to "root quality" when the
 * quality has no registered suffix.
 */
export function formatChordShortLabel(rootLabel: string, quality: string): string {
  const suffix = CHORD_QUALITY_SUFFIX[quality];
  if (suffix === undefined) return `${rootLabel} ${quality}`;
  return `${rootLabel}${suffix}`;
}

export interface FormattedPlaybackPositionParts {
  bar: string;
  beat: string;
  subdivision: string;
}

export interface FormattedPlaybackPosition {
  current: string;
  total: string;
  parts: { current: FormattedPlaybackPositionParts; total: FormattedPlaybackPositionParts };
}

/**
 * Format the DAW-style position readout for the progression track.
 *
 * Returns a bar.beat.sixteenth pair such as `1.2.3 / 4.0.0` where:
 * - bar is the 1-indexed bar (no padding)
 * - beat is the 1-indexed beat within the current bar
 * - subdivision is the 1-indexed sixteenth-note within the current beat (1..4)
 *
 * The total uses duration semantics — `${bars}.0.0` for a `bars`-long
 * progression — matching how Logic and Ableton display song length.
 */
export function formatProgressionPlaybackPosition(
  currentProgressionBar: number,
  totalProgressionBars: number,
  beatsPerBar: number,
): FormattedPlaybackPosition {
  const SIXTEENTHS_PER_BEAT = 4;
  const safeBeats = Math.max(1, Math.floor(beatsPerBar));
  const totalBars = Math.max(1, Math.ceil(totalProgressionBars));
  // Position can range over [1, totalBars + 1). bar 1.0 is the first beat of
  // bar 1, bar N + 1 - ε is the final sixteenth of the last bar. Clamping to
  // `totalBars` would freeze the readout at `N.1.1` for the entire last bar
  // instead of advancing through its beats and subdivisions.
  const maxBar = totalBars + 1 - 1e-9;
  const clampedBar = Math.max(1, Math.min(currentProgressionBar, maxBar));
  const bar = Math.floor(clampedBar);
  const positionInBar = Math.max(0, Math.min(1, clampedBar - bar));
  const beatPos = positionInBar * safeBeats;
  const beatIndex = Math.min(safeBeats - 1, Math.floor(beatPos));
  const beat = beatIndex + 1;
  const subInBeatFloat = (beatPos - Math.floor(beatPos)) * SIXTEENTHS_PER_BEAT;
  const subdivision = Math.min(
    SIXTEENTHS_PER_BEAT,
    Math.max(1, Math.floor(subInBeatFloat) + 1),
  );

  const currentParts: FormattedPlaybackPositionParts = {
    bar: String(bar),
    beat: String(beat),
    subdivision: String(subdivision),
  };
  // Total uses duration semantics: `${bars}.0.0` rather than the position of
  // the final tick. Matches Logic/Ableton "song length" displays where a
  // 4-bar loop reads "4.0.0" — i.e. four full bars have elapsed at the end.
  const totalParts: FormattedPlaybackPositionParts = {
    bar: String(totalBars),
    beat: "0",
    subdivision: "0",
  };

  return {
    current: `${currentParts.bar}.${currentParts.beat}.${currentParts.subdivision}`,
    total: `${totalParts.bar}.${totalParts.beat}.${totalParts.subdivision}`,
    parts: { current: currentParts, total: totalParts },
  };
}

export interface ProgressionStep {
  id: string;
  degree: DegreeId;
  duration: ProgressionStepDuration;
  qualityOverride: string | null;
  /**
   * When non-null, this step is a manual / out-of-scale chord. The chord's
   * root is `manualRoot`, the quality comes from `qualityOverride`, and
   * `degree` is treated as a best-effort cached hint (e.g. for relabelling
   * if the scale changes). When null, the step resolves diatonically from
   * `degree` against the active scale + key.
   */
  manualRoot: string | null;
}

export type ProgressionPresetCategory =
  | "pop-rock"
  | "blues"
  | "jazz"
  | "folk"
  | "modal"
  | "minor";

export interface ProgressionPreset {
  id: string;
  label: string;
  category: ProgressionPresetCategory;
  steps: Array<Omit<ProgressionStep, "id">>;
}

export interface ResolvedProgressionStep extends ProgressionStep {
  index: number;
  root: string | null;
  quality: string | null;
  diatonicQuality: string | null;
  label: string;
  resolvedChordLabel: string | null;
  /**
   * Compact chord label suitable for tight DAW-style surfaces (e.g. "C", "Am",
   * "G7"). Null when the chord cannot be resolved in the current scale.
   */
  shortChordLabel: string | null;
  unavailable: boolean;
  unavailableReason: string | null;
  qualityOverrideApplied: boolean;
  invalidQualityOverride: boolean;
}

export const DEFAULT_PROGRESSION_TEMPO_BPM = 90;
export const MIN_PROGRESSION_TEMPO_BPM = 40;
export const MAX_PROGRESSION_TEMPO_BPM = 240;

// Preset steps are stored as a compact DSL string of space-separated tokens.
// Token grammar: DEGREE[*BARS][:7]
//   *N  → step lasts N bars (default 1)
//   :7  → quality override is "7" (dominant seventh)
// Examples: "I V vi IV"  ·  "I*4:7 IV*2:7 V:7"
function parseSteps(spec: string): Array<Omit<ProgressionStep, "id">> {
  return spec.split(/\s+/).filter(Boolean).map((tok) => {
    const m = tok.match(/^([ivIV]+)(?:\*(\d+))?(?::(7))?$/);
    if (!m) throw new Error(`Invalid preset step token: ${tok}`);
    const [, degree, value, q] = m;
    return {
      degree: degree as DegreeId,
      duration: { value: value ? Number(value) : 1, unit: "bar" as const },
      qualityOverride: q === "7" ? "7" : null,
      manualRoot: null,
    };
  });
}

const PRESET_SPECS: ReadonlyArray<{
  id: string;
  label: string;
  category: ProgressionPresetCategory;
  spec: string;
}> = [
  { id: "one-five-six-four", label: "I-V-vi-IV", category: "pop-rock", spec: "I V vi IV" },
  { id: "two-five-one", label: "ii-V-I", category: "jazz", spec: "ii V:7 I" },
  { id: "one-six-four-five", label: "I-vi-IV-V", category: "pop-rock", spec: "I vi IV V" },
  { id: "one-four-five", label: "I-IV-V", category: "folk", spec: "I IV V" },
  { id: "twelve-bar-blues", label: "12-bar blues", category: "blues",
    spec: "I*4:7 IV*2:7 I*2:7 V:7 IV:7 I:7 V:7" },
  { id: "vi-iv-i-v", label: "vi-IV-I-V", category: "pop-rock", spec: "vi IV I V" },
  { id: "i-iv-vi-v", label: "I-IV-vi-V", category: "pop-rock", spec: "I IV vi V" },
  { id: "canon", label: "Canon (I-V-vi-iii-IV-I-IV-V)", category: "pop-rock",
    spec: "I V vi iii IV I IV V" },
  { id: "eight-bar-blues", label: "8-bar blues", category: "blues",
    spec: "I*2:7 IV*2:7 I:7 V:7 I:7 V:7" },
  { id: "minor-blues", label: "Minor blues", category: "blues",
    spec: "i*4 iv*2 i*2 V iv i V" },
  { id: "one-six-two-five", label: "I-vi-ii-V (turnaround)", category: "jazz", spec: "I vi ii V" },
  { id: "three-six-two-five", label: "iii-vi-ii-V", category: "jazz", spec: "iii vi ii V" },
  { id: "two-five-one-six", label: "ii-V-I-vi (rhythm changes)", category: "jazz",
    spec: "ii V:7 I vi" },
  { id: "one-four-two-five", label: "I-IV-ii-V", category: "jazz", spec: "I IV ii V" },
  { id: "one-four-one-five", label: "I-IV-I-V", category: "folk", spec: "I IV I V" },
  { id: "one-five-one-four-one-five-one", label: "I-V-I-IV-I-V-I", category: "folk",
    spec: "I V I IV I V I" },
  { id: "dorian-i-iv", label: "Dorian i-IV", category: "modal", spec: "i IV" },
  { id: "dorian-i-vii-iv", label: "Dorian i-VII-IV", category: "modal", spec: "i VII IV" },
  { id: "mixolydian-i-vii-iv", label: "Mixolydian I-VII-IV", category: "modal", spec: "I VII IV" },
  { id: "phrygian-i-ii", label: "Phrygian i-II", category: "modal", spec: "i II" },
  { id: "lydian-i-ii", label: "Lydian I-II", category: "modal", spec: "I II" },
  { id: "minor-i-iv-v", label: "i-iv-v", category: "minor", spec: "i iv v" },
  { id: "minor-i-vi-vii", label: "i-VI-VII", category: "minor", spec: "i VI VII" },
  { id: "andalusian", label: "Andalusian (i-VII-VI-V)", category: "minor", spec: "i VII VI V" },
  { id: "minor-i-iv-vii-iii", label: "i-iv-VII-III", category: "minor", spec: "i iv VII III" },
];

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = PRESET_SPECS.map(
  ({ id, label, category, spec }) => ({ id, label, category, steps: parseSteps(spec) }),
);

const ROMAN_ORDINALS: Record<string, number> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6,
};

const PROGRESSION_HARMONY_SCALE: Record<string, string> = {
  "major pentatonic": "major",
  "major blues": "major",
  "minor pentatonic": "minor",
  "minor blues": "minor",
};

function getProgressionHarmonyScaleName(scaleName: string): string {
  return PROGRESSION_HARMONY_SCALE[scaleName] ?? scaleName;
}

let fallbackId = 0;

export function createProgressionStep(
  step: Omit<ProgressionStep, "id" | "manualRoot"> & { manualRoot?: string | null },
  id = createProgressionStepId(),
): ProgressionStep {
  return {
    id,
    degree: step.degree,
    duration: step.duration,
    qualityOverride: step.qualityOverride,
    manualRoot: step.manualRoot ?? null,
  };
}

function createProgressionStepId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackId += 1;
  return `progression-step-${fallbackId}`;
}

export function isValidProgressionStep(value: unknown): value is ProgressionStep {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ProgressionStep;
  return typeof candidate.id === "string"
    && typeof candidate.degree === "string"
    && isProgressionDuration(candidate.duration)
    && (candidate.qualityOverride === null || typeof candidate.qualityOverride === "string")
    // `manualRoot` is additive: treat absent/undefined as null so
    // pre-Phase-2 persisted shapes and legacy literal seeds still validate.
    && (candidate.manualRoot === null
      || candidate.manualRoot === undefined
      || typeof candidate.manualRoot === "string");
}

export function normalizeProgressionStep(value: unknown): ProgressionStep | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as ProgressionStep & { duration: unknown };
  if (typeof candidate.id !== "string" || typeof candidate.degree !== "string") return null;
  if (candidate.qualityOverride !== null && typeof candidate.qualityOverride !== "string") return null;
  const manualRoot =
    candidate.manualRoot === undefined || candidate.manualRoot === null
      ? null
      : typeof candidate.manualRoot === "string"
        ? candidate.manualRoot
        : null;
  return {
    id: candidate.id,
    degree: candidate.degree,
    duration: migrateLegacyDuration(candidate.duration),
    qualityOverride: candidate.qualityOverride ?? null,
    manualRoot,
  };
}

function getDegreeOrdinal(degree: DegreeId): number | null {
  const match = degree.toUpperCase().match(/^(VII|VI|IV|V|III|II|I)/);
  if (!match) return null;
  return ROMAN_ORDINALS[match[1]] ?? null;
}

export function remapDegreeByOrdinal(degree: DegreeId, toScaleName: string): DegreeId {
  const ordinal = getDegreeOrdinal(degree);
  const targetDegrees = getDegreeSequence(getProgressionHarmonyScaleName(toScaleName));
  if (ordinal === null) return degree;
  return targetDegrees[ordinal] ?? degree;
}

export function remapProgressionStepsForScale(
  steps: readonly ProgressionStep[],
  toScaleName: string,
): ProgressionStep[] {
  return steps.map((step) => ({
    ...step,
    degree: remapDegreeByOrdinal(step.degree, toScaleName),
  }));
}

/**
 * Transpose each step's `manualRoot` by the interval from `oldRoot` to
 * `newRoot`. Steps with `manualRoot === null` pass through unchanged — their
 * resolved root already follows the active key through `degree`.
 *
 * Result roots are normalized to FretFlow's sharps-form contract (e.g. `Eb`
 * → `D#`) so that downstream consumers indexing into `NOTES` keep working.
 *
 * Returns identity-mapped steps when `oldRoot === newRoot` to keep the call
 * cheap and side-effect-free on no-op changes.
 */
export function transposeManualRootForRootChange(
  steps: readonly ProgressionStep[],
  oldRoot: string,
  newRoot: string,
): ProgressionStep[] {
  if (oldRoot === newRoot) return steps.map((step) => step);
  return steps.map((step) =>
    step.manualRoot == null
      ? step
      : { ...step, manualRoot: transposeNoteToSharps(step.manualRoot, oldRoot, newRoot) },
  );
}

export function createStepsFromPreset(
  preset: ProgressionPreset,
  scaleName: string,
): ProgressionStep[] {
  return getProgressionPresetStepsForScale(preset, scaleName).map((step) =>
    createProgressionStep({
      ...step,
    }),
  );
}

export function getProgressionPresetStepsForScale(
  preset: ProgressionPreset,
  scaleName: string,
): Array<Omit<ProgressionStep, "id">> {
  return preset.steps.map((step) => ({
    ...step,
    degree: remapDegreeByOrdinal(step.degree, scaleName),
  }));
}

export function isProgressionPresetAvailableForScale(
  preset: ProgressionPreset,
  scaleName: string,
): boolean {
  return getProgressionPresetStepsForScale(preset, scaleName).every((step, index) => {
    const resolved = resolveProgressionStep(
      { id: `preset-availability-${index}`, ...step },
      scaleName,
      "C",
    );
    return !resolved.unavailable;
  });
}

export function getAvailableProgressionPresets(
  scaleName: string,
): ProgressionPreset[] {
  return PROGRESSION_PRESETS.filter((preset) =>
    isProgressionPresetAvailableForScale(preset, scaleName),
  );
}

export const DEFAULT_BEATS_PER_BAR = 4 as const;
const BEATS_PER_BAR_OPTIONS = [3, 4, 6, 8] as const;
export type BeatsPerBar = (typeof BEATS_PER_BAR_OPTIONS)[number];

export function isBeatsPerBar(value: unknown): value is BeatsPerBar {
  return BEATS_PER_BAR_OPTIONS.includes(value as BeatsPerBar);
}

export function getProgressionDurationBeats(
  duration: ProgressionStepDuration,
  beatsPerBar: number,
): number {
  return duration.unit === "bar" ? duration.value * beatsPerBar : duration.value;
}

export function getProgressionDurationMs(
  duration: ProgressionStepDuration,
  tempoBpm: number,
  beatsPerBar: number,
): number {
  const clampedTempo = Math.min(
    MAX_PROGRESSION_TEMPO_BPM,
    Math.max(MIN_PROGRESSION_TEMPO_BPM, Math.round(tempoBpm)),
  );
  const beats = getProgressionDurationBeats(duration, beatsPerBar);
  return Math.round((60_000 / clampedTempo) * beats);
}

export function totalProgressionBars(
  durations: readonly ProgressionStepDuration[],
  beatsPerBar: number,
): number {
  const totalBeats = durations.reduce(
    (sum, duration) => sum + getProgressionDurationBeats(duration, beatsPerBar),
    0,
  );
  return totalBeats / beatsPerBar;
}

/**
 * When a borrowed (out-of-scale) root is picked without a quality override,
 * fall back to "M" (major triad) as the safest audible default.
 *
 * TODO(plan-g11a): refine with a real parallel-scale lookup if/when one
 * exists in @fretflow/core (e.g. getDiatonicChordForNote(root, scale, tonic)).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function guessQualityForBorrowedRoot(_root?: string, _scaleName?: string, _tonicNote?: string): string {
  return "M";
}

/** Compact display string for a chord quality, suitable for inline tags
 * (e.g. the borrowed-cell quality strip in DegreeGrid). Returns "" if the
 * quality is unrecognized — callers may choose to suppress in that case. */
export function qualityShortForm(quality: string): string {
  switch (quality) {
    case "M": return "M";
    case "m": return "m";
    case "dim": return "°";
    case "aug": return "+";
    case "5": return "5";
    case "6": return "6";
    case "m6": return "m6";
    case "7": return "7";
    case "maj7": return "M7";
    case "m7": return "m7";
    case "mMaj7": return "mM7";
    case "m7b5": return "ø7";
    case "dim7": return "°7";
    default: return "";
  }
}

export function resolveProgressionStep(
  step: ProgressionStep,
  scaleName: string,
  rootNote: string,
  index = 0,
  preferFlats = false,
): ResolvedProgressionStep {
  const harmonyScale = getProgressionHarmonyScaleName(scaleName);
  const diatonic = getDiatonicChord(step.degree, harmonyScale, rootNote);

  // When manualRoot is set we bypass the diatonic resolver for root + quality.
  const usingManualRoot = step.manualRoot != null;

  const overrideValid =
    step.qualityOverride !== null && CHORD_DEFINITIONS[step.qualityOverride] !== undefined;

  // Quality pin: a valid override resolves a non-diatonic degree on its
  // scale-position root (e.g. a dominant V in natural minor). Relative to the
  // scale degree, so it transposes with the root. Resolved against the active
  // scale (not the harmony parent) so a degree whose ordinal exceeds the
  // scale length (e.g. VII in a 5-note pentatonic) stays unavailable.
  let pinnedRoot: string | null = null;
  if (!diatonic && !usingManualRoot && overrideValid) {
    const ordinal = getDegreeOrdinal(step.degree);
    if (ordinal !== null) {
      pinnedRoot = getScaleNotes(rootNote, scaleName)[ordinal] ?? null;
    }
  }

  if (!diatonic && !usingManualRoot && pinnedRoot === null) {
    return {
      ...step,
      index,
      root: null,
      quality: null,
      diatonicQuality: null,
      label: step.degree,
      resolvedChordLabel: null,
      shortChordLabel: null,
      unavailable: true,
      unavailableReason: "Degree unavailable in this scale",
      qualityOverrideApplied: false,
      invalidQualityOverride: false,
    };
  }

  // Resolve root: manualRoot > diatonic > pinned scale-degree root.
  const root = usingManualRoot ? step.manualRoot! : (diatonic?.root ?? pinnedRoot!);

  // Resolve quality: qualityOverride > manualRoot default > diatonic quality.
  const quality = overrideValid
    ? step.qualityOverride!
    : usingManualRoot
      ? guessQualityForBorrowedRoot(step.manualRoot ?? undefined, scaleName, rootNote)
      : diatonic!.quality;

  const diatonicQuality = diatonic?.quality ?? null;
  const rootLabel = formatAccidental(getNoteDisplay(root, rootNote, preferFlats));

  return {
    ...step,
    index,
    root,
    quality,
    diatonicQuality,
    label: step.degree,
    resolvedChordLabel: `${rootLabel} ${getChordDisplayLabel(quality)}`,
    shortChordLabel: formatChordShortLabel(rootLabel, quality),
    unavailable: false,
    unavailableReason: null,
    qualityOverrideApplied: overrideValid && quality !== diatonicQuality,
    invalidQualityOverride: step.qualityOverride !== null && !overrideValid,
  };
}

export function findFirstResolvableStepIndex(
  steps: readonly ResolvedProgressionStep[],
): number | null {
  const index = steps.findIndex((step) => !step.unavailable);
  return index === -1 ? null : index;
}

export function findNextResolvableStepIndex(
  steps: readonly ResolvedProgressionStep[],
  currentIndex: number,
  direction: -1 | 1,
  loop: boolean,
): number | null {
  if (steps.length === 0) return null;
  for (let offset = 1; offset <= steps.length; offset += 1) {
    const rawIndex = currentIndex + offset * direction;
    if (!loop && (rawIndex < 0 || rawIndex >= steps.length)) return null;
    const wrappedIndex = (rawIndex + steps.length) % steps.length;
    if (!steps[wrappedIndex]?.unavailable) return wrappedIndex;
  }
  return null;
}

export function clampProgressionIndex(
  index: number,
  steps: readonly ProgressionStep[],
): number {
  if (steps.length === 0) return 0;
  return Math.min(Math.max(index, 0), steps.length - 1);
}
