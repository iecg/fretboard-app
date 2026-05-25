import { getScaleSemitonesFromTonal } from "./lib/tonal";

export type ScaleFamilyId =
  | "major"
  | "harmonic-minor"
  | "melodic-minor"
  | "pentatonic"
  | "blues";

export type ScaleBrowseMode = "parallel" | "relative";

export interface ScaleMember {
  scaleName: string;
  displayLabel: string;
  shortLabel: string;
  parentMajorOffset: number;
}

export interface ScaleFamily {
  id: ScaleFamilyId;
  label: string;
  selectorLabel: string;
  defaultScaleName: string;
  members: readonly ScaleMember[];
}

type ScaleMemberDefinition = ScaleMember;

interface ScaleFamilyDefinition extends Omit<ScaleFamily, "members"> {
  members: readonly ScaleMemberDefinition[];
}

export interface ScaleBrowseOption {
  rootNote: string;
  scaleName: string;
  label: string;
  ordinal: number;
}

const CHROMATIC_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const ENHARMONIC_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

const SHARP_TO_FLAT: Record<string, string> = Object.fromEntries(
  Object.entries(ENHARMONIC_TO_SHARP).map(([flat, sharp]) => [sharp, flat]),
);

const RELATIVE_BROWSE_FAMILIES = new Set<ScaleFamilyId>([
  "major",
  "harmonic-minor",
  "melodic-minor",
]);

const SCALE_FAMILY_DEFINITIONS = [
  {
    id: "major",
    label: "Major",
    selectorLabel: "Major Modes",
    defaultScaleName: "major",
    members: [
      {
        scaleName: "major",
        displayLabel: "Major (Ionian)",
        shortLabel: "Ionian",
        parentMajorOffset: 0,
      },
      {
        scaleName: "dorian",
        displayLabel: "Dorian",
        shortLabel: "Dorian",
        parentMajorOffset: 10,
      },
      {
        scaleName: "phrygian",
        displayLabel: "Phrygian",
        shortLabel: "Phrygian",
        parentMajorOffset: 8,
      },
      {
        scaleName: "lydian",
        displayLabel: "Lydian",
        shortLabel: "Lydian",
        parentMajorOffset: 7,
      },
      {
        scaleName: "mixolydian",
        displayLabel: "Mixolydian",
        shortLabel: "Mixolydian",
        parentMajorOffset: 5,
      },
      {
        scaleName: "minor",
        displayLabel: "Natural Minor (Aeolian)",
        shortLabel: "Aeolian",
        parentMajorOffset: 3,
      },
      {
        scaleName: "locrian",
        displayLabel: "Locrian",
        shortLabel: "Locrian",
        parentMajorOffset: 1,
      },
    ],
  },
  {
    id: "harmonic-minor",
    label: "Harmonic Minor",
    selectorLabel: "Harmonic Minor",
    defaultScaleName: "harmonic minor",
    members: [
      {
        scaleName: "harmonic minor",
        displayLabel: "Harmonic Minor",
        shortLabel: "Harmonic Minor",
        parentMajorOffset: 3,
      },
      {
        scaleName: "locrian 6",
        displayLabel: "Locrian Natural 6",
        shortLabel: "Locrian Natural 6",
        parentMajorOffset: 1,
      },
      {
        scaleName: "ionian augmented",
        displayLabel: "Ionian Augmented",
        shortLabel: "Ionian Augmented",
        parentMajorOffset: 0,
      },
      {
        scaleName: "dorian #4",
        displayLabel: "Dorian Sharp 4",
        shortLabel: "Dorian #4",
        parentMajorOffset: 10,
      },
      {
        scaleName: "phrygian dominant",
        displayLabel: "Phrygian Dominant",
        shortLabel: "Phrygian Dominant",
        parentMajorOffset: 8,
      },
      {
        scaleName: "lydian #9",
        displayLabel: "Lydian Sharp 2",
        shortLabel: "Lydian #2",
        parentMajorOffset: 7,
      },
      {
        scaleName: "ultralocrian",
        displayLabel: "Altered Diminished",
        shortLabel: "Altered Dim.",
        parentMajorOffset: 5,
      },
    ],
  },
  {
    id: "melodic-minor",
    label: "Melodic Minor",
    selectorLabel: "Melodic Minor",
    defaultScaleName: "melodic minor",
    members: [
      {
        scaleName: "melodic minor",
        displayLabel: "Melodic Minor (Jazz Minor)",
        shortLabel: "Jazz Minor",
        parentMajorOffset: 3,
      },
      {
        scaleName: "dorian b2",
        displayLabel: "Dorian Flat 2",
        shortLabel: "Dorian b2",
        parentMajorOffset: 1,
      },
      {
        scaleName: "lydian augmented",
        displayLabel: "Lydian Augmented",
        shortLabel: "Lydian Aug.",
        parentMajorOffset: 0,
      },
      {
        scaleName: "lydian dominant",
        displayLabel: "Lydian Dominant",
        shortLabel: "Lydian Dom.",
        parentMajorOffset: 10,
      },
      {
        scaleName: "mixolydian b6",
        displayLabel: "Mixolydian Flat 6",
        shortLabel: "Mixolydian b6",
        parentMajorOffset: 8,
      },
      {
        scaleName: "locrian #2",
        displayLabel: "Locrian Natural 2",
        shortLabel: "Locrian Nat. 2",
        parentMajorOffset: 6,
      },
      {
        scaleName: "altered",
        displayLabel: "Altered",
        shortLabel: "Altered",
        parentMajorOffset: 4,
      },
    ],
  },
  {
    id: "pentatonic",
    label: "Pentatonic",
    selectorLabel: "Pentatonic",
    defaultScaleName: "minor pentatonic",
    members: [
      {
        scaleName: "minor pentatonic",
        displayLabel: "Minor Pentatonic",
        shortLabel: "Minor",
        parentMajorOffset: 3,
      },
      {
        scaleName: "major pentatonic",
        displayLabel: "Major Pentatonic",
        shortLabel: "Major",
        parentMajorOffset: 0,
      },
    ],
  },
  {
    id: "blues",
    label: "Blues",
    selectorLabel: "Blues",
    defaultScaleName: "minor blues",
    members: [
      {
        scaleName: "minor blues",
        displayLabel: "Minor Blues",
        shortLabel: "Minor",
        parentMajorOffset: 3,
      },
      {
        scaleName: "major blues",
        displayLabel: "Major Blues",
        shortLabel: "Major",
        parentMajorOffset: 0,
      },
    ],
  },
] as const satisfies readonly ScaleFamilyDefinition[];

type ScaleCatalogEntry = {
  family: ScaleFamily;
  member: ScaleMember;
  index: number;
};

export const SCALE_FAMILIES: readonly ScaleFamily[] = SCALE_FAMILY_DEFINITIONS.map(
  ({ members, ...family }) => ({
    ...family,
    members: members.map((member) => ({
      scaleName: member.scaleName,
      displayLabel: member.displayLabel,
      shortLabel: member.shortLabel,
      parentMajorOffset: member.parentMajorOffset,
    })) as readonly ScaleMember[],
  }),
);

export const SCALES: Record<string, number[]> = Object.fromEntries(
  SCALE_FAMILY_DEFINITIONS.flatMap((family) =>
    family.members.map((member) => {
      const intervals = getScaleSemitonesFromTonal(member.scaleName);
      if (intervals.length === 0) {
        throw new Error(
          `theoryCatalog: scale "${member.scaleName}" not resolvable via Tonal`,
        );
      }
      return [member.scaleName, intervals];
    }),
  ),
);

export const SCALE_TO_PARENT_MAJOR_OFFSET: Record<string, number> =
  Object.fromEntries(
    SCALE_FAMILY_DEFINITIONS.flatMap((family) =>
      family.members.map((member) => [
        member.scaleName,
        member.parentMajorOffset,
      ]),
    ),
  );

const scaleEntryByName = new Map<string, ScaleCatalogEntry>();
const familyById = new Map<ScaleFamilyId, ScaleFamily>();
const familyBySelectorLabel = new Map<string, ScaleFamily>();
const familyDefinitionById = new Map<ScaleFamilyId, ScaleFamilyDefinition>();

for (const familyDefinition of SCALE_FAMILY_DEFINITIONS) {
  familyDefinitionById.set(familyDefinition.id, familyDefinition);
}

for (const family of SCALE_FAMILIES) {
  familyById.set(family.id, family);
  familyBySelectorLabel.set(family.selectorLabel, family);
  family.members.forEach((member, index) => {
    scaleEntryByName.set(member.scaleName, { family, member, index });
  });
}

function getDefaultScaleEntry(): ScaleCatalogEntry {
  return scaleEntryByName.get("major")!;
}

function normalizePitchClass(note: string): string {
  return ENHARMONIC_TO_SHARP[note] ?? note;
}

function getPitchClassIndex(note: string): number {
  return CHROMATIC_NOTES.indexOf(
    normalizePitchClass(note) as (typeof CHROMATIC_NOTES)[number],
  );
}

function transposePitchClass(note: string, semitoneDelta: number): string {
  const noteIndex = getPitchClassIndex(note);
  if (noteIndex === -1) return note;
  const nextIndex =
    (noteIndex + semitoneDelta + CHROMATIC_NOTES.length) %
    CHROMATIC_NOTES.length;
  return CHROMATIC_NOTES[nextIndex];
}

function formatPitchClass(note: string, useFlats = false): string {
  const normalized = normalizePitchClass(note);
  return useFlats ? SHARP_TO_FLAT[normalized] ?? normalized : normalized;
}

function formatOrdinalMode(ordinal: number): string {
  const mod10 = ordinal % 10;
  const mod100 = ordinal % 100;
  if (mod10 === 1 && mod100 !== 11) return `${ordinal}st Mode`;
  if (mod10 === 2 && mod100 !== 12) return `${ordinal}nd Mode`;
  if (mod10 === 3 && mod100 !== 13) return `${ordinal}rd Mode`;
  return `${ordinal}th Mode`;
}

function getFamilyDefinition(scaleName: string): ScaleFamilyDefinition {
  const familyId = resolveScaleCatalogEntry(scaleName).family.id;
  return familyDefinitionById.get(familyId) ?? SCALE_FAMILY_DEFINITIONS[0];
}

/**
 * Defensive pass-through. As of N5 (tonal-native migration), scale names are
 * stored natively as Tonal names — this function returns its input unchanged.
 * Kept as a single seam so future legacy-name aliases (e.g. renaming a scale)
 * can be added in one place without touching every consumer.
 */
export function normalizeScaleName(scaleName: string): string {
  return scaleName;
}

export function getScaleCatalogEntry(
  scaleName: string,
): ScaleCatalogEntry | null {
  return scaleEntryByName.get(normalizeScaleName(scaleName)) ?? null;
}

export function resolveScaleCatalogEntry(scaleName: string): ScaleCatalogEntry {
  return getScaleCatalogEntry(scaleName) ?? getDefaultScaleEntry();
}

export function getScaleFamily(scaleName: string): ScaleFamily {
  return resolveScaleCatalogEntry(scaleName).family;
}

export function getScaleMember(scaleName: string): ScaleMember {
  return resolveScaleCatalogEntry(scaleName).member;
}

export function getScaleFamilies(): readonly ScaleFamily[] {
  return SCALE_FAMILIES;
}

export function getScaleFamilyById(
  familyId: ScaleFamilyId,
): ScaleFamily | null {
  return familyById.get(familyId) ?? null;
}

export function getScaleFamilyBySelectorLabel(
  selectorLabel: string,
): ScaleFamily | null {
  return familyBySelectorLabel.get(selectorLabel) ?? null;
}

export function supportsRelativeScaleBrowsing(scaleName: string): boolean {
  return RELATIVE_BROWSE_FAMILIES.has(getScaleFamily(scaleName).id);
}

export function getEffectiveScaleBrowseMode(
  scaleName: string,
  browseMode: ScaleBrowseMode,
): ScaleBrowseMode {
  return browseMode === "relative" && !supportsRelativeScaleBrowsing(scaleName)
    ? "parallel"
    : browseMode;
}

export function getScaleBrowseReferenceRoot(
  rootNote: string,
  scaleName: string,
): string {
  const entry = resolveScaleCatalogEntry(scaleName);
  const baseScaleName = getFamilyDefinition(scaleName).members[0]?.scaleName;
  const baseIntervals = baseScaleName ? SCALES[baseScaleName] : undefined;
  const degreeOffset = baseIntervals?.[entry.index] ?? 0;
  return transposePitchClass(rootNote, -degreeOffset);
}

export function getScaleMemberTerm(scaleName: string): "Mode" | "Variant" {
  const familyId = getScaleFamily(scaleName).id;
  return familyId === "pentatonic" || familyId === "blues"
    ? "Variant"
    : "Mode";
}

export function getScaleDisplayLabel(scaleName: string): string {
  return getScaleMember(scaleName).displayLabel;
}

export function getScaleShortLabel(scaleName: string): string {
  return getScaleMember(scaleName).shortLabel;
}

export function getScaleFamilyOptions(): string[] {
  return SCALE_FAMILIES.map((family) => family.selectorLabel);
}

export function getScaleMemberOptions(scaleName: string): string[] {
  return getScaleFamily(scaleName).members.map((member) => member.displayLabel);
}

export function getDefaultScaleNameForFamily(familyId: ScaleFamilyId): string {
  return getScaleFamilyById(familyId)?.defaultScaleName ?? "major";
}

export function getScaleNameForFamilySelector(selectorLabel: string): string {
  return getScaleFamilyBySelectorLabel(selectorLabel)?.defaultScaleName ?? "major";
}

export function getScaleNameForMemberDisplayLabel(
  scaleName: string,
  displayLabel: string,
): string {
  const family = getScaleFamily(scaleName);
  return (
    family.members.find((member) => member.displayLabel === displayLabel)
      ?.scaleName ?? family.defaultScaleName
  );
}

export function getAdjacentScaleName(
  scaleName: string,
  direction: -1 | 1,
): string {
  const entry = resolveScaleCatalogEntry(scaleName);
  const nextIndex =
    (entry.index + direction + entry.family.members.length) %
    entry.family.members.length;
  return entry.family.members[nextIndex]?.scaleName ?? entry.member.scaleName;
}

export function getScaleBrowseOptions(
  rootNote: string,
  scaleName: string,
  browseMode: ScaleBrowseMode,
  useFlats = false,
): ScaleBrowseOption[] {
  const entry = resolveScaleCatalogEntry(scaleName);
  const familyDefinition = getFamilyDefinition(scaleName);
  const effectiveBrowseMode = getEffectiveScaleBrowseMode(scaleName, browseMode);
  const referenceRoot =
    effectiveBrowseMode === "relative"
      ? getScaleBrowseReferenceRoot(rootNote, scaleName)
      : rootNote;
  const baseScaleName = familyDefinition.members[0]?.scaleName;
  const baseIntervals = (baseScaleName ? SCALES[baseScaleName] : undefined) ?? [];

  return entry.family.members.map((member, index) => {
    const browseRoot =
      effectiveBrowseMode === "relative"
        ? transposePitchClass(referenceRoot, baseIntervals[index] ?? 0)
        : rootNote;
    const rootLabel = formatPitchClass(browseRoot, useFlats);
    const ordinalSuffix =
      effectiveBrowseMode === "relative"
        ? ` (${formatOrdinalMode(index + 1)})`
        : "";
    return {
      rootNote: browseRoot,
      scaleName: member.scaleName,
      label: `${rootLabel} ${member.displayLabel}${ordinalSuffix}`,
      ordinal: index + 1,
    };
  });
}

export function getActiveScaleBrowseOption(
  rootNote: string,
  scaleName: string,
  browseMode: ScaleBrowseMode,
  useFlats = false,
): ScaleBrowseOption {
  const options = getScaleBrowseOptions(rootNote, scaleName, browseMode, useFlats);
  const normalizedRoot = normalizePitchClass(rootNote);
  const normalizedScaleName = normalizeScaleName(scaleName);
  return (
    options.find(
      (option) =>
        normalizePitchClass(option.rootNote) === normalizedRoot &&
        normalizeScaleName(option.scaleName) === normalizedScaleName,
    ) ?? options[0]
  );
}

export function getAdjacentScaleBrowseOption(
  rootNote: string,
  scaleName: string,
  browseMode: ScaleBrowseMode,
  direction: -1 | 1,
  useFlats = false,
): ScaleBrowseOption {
  const options = getScaleBrowseOptions(rootNote, scaleName, browseMode, useFlats);
  const activeOption = getActiveScaleBrowseOption(
    rootNote,
    scaleName,
    browseMode,
    useFlats,
  );
  const activeIndex = options.findIndex(
    (option) =>
      option.rootNote === activeOption.rootNote &&
      option.scaleName === activeOption.scaleName,
  );
  const nextIndex =
    (activeIndex + direction + options.length) % options.length;
  return options[nextIndex] ?? activeOption;
}
