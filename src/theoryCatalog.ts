export type ScaleFamilyId =
  | "major"
  | "harmonic-minor"
  | "melodic-minor"
  | "pentatonic"
  | "blues";

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

interface ScaleMemberDefinition extends ScaleMember {
  intervals: readonly number[];
}

interface ScaleFamilyDefinition extends Omit<ScaleFamily, "members"> {
  members: readonly ScaleMemberDefinition[];
}

const SCALE_NAME_ALIASES: Record<string, string> = {
  Minor: "Natural Minor",
};

const SCALE_FAMILY_DEFINITIONS = [
  {
    id: "major",
    label: "Major",
    selectorLabel: "Major Modes",
    defaultScaleName: "Major",
    members: [
      {
        scaleName: "Major",
        displayLabel: "Major (Ionian)",
        shortLabel: "Ionian",
        parentMajorOffset: 0,
        intervals: [0, 2, 4, 5, 7, 9, 11],
      },
      {
        scaleName: "Dorian",
        displayLabel: "Dorian",
        shortLabel: "Dorian",
        parentMajorOffset: 10,
        intervals: [0, 2, 3, 5, 7, 9, 10],
      },
      {
        scaleName: "Phrygian",
        displayLabel: "Phrygian",
        shortLabel: "Phrygian",
        parentMajorOffset: 8,
        intervals: [0, 1, 3, 5, 7, 8, 10],
      },
      {
        scaleName: "Lydian",
        displayLabel: "Lydian",
        shortLabel: "Lydian",
        parentMajorOffset: 7,
        intervals: [0, 2, 4, 6, 7, 9, 11],
      },
      {
        scaleName: "Mixolydian",
        displayLabel: "Mixolydian",
        shortLabel: "Mixolydian",
        parentMajorOffset: 5,
        intervals: [0, 2, 4, 5, 7, 9, 10],
      },
      {
        scaleName: "Natural Minor",
        displayLabel: "Natural Minor (Aeolian)",
        shortLabel: "Aeolian",
        parentMajorOffset: 3,
        intervals: [0, 2, 3, 5, 7, 8, 10],
      },
      {
        scaleName: "Locrian",
        displayLabel: "Locrian",
        shortLabel: "Locrian",
        parentMajorOffset: 1,
        intervals: [0, 1, 3, 5, 6, 8, 10],
      },
    ],
  },
  {
    id: "harmonic-minor",
    label: "Harmonic Minor",
    selectorLabel: "Harmonic Minor",
    defaultScaleName: "Harmonic Minor",
    members: [
      {
        scaleName: "Harmonic Minor",
        displayLabel: "Harmonic Minor",
        shortLabel: "Harmonic Minor",
        parentMajorOffset: 3,
        intervals: [0, 2, 3, 5, 7, 8, 11],
      },
      {
        scaleName: "Locrian Natural 6",
        displayLabel: "Locrian Natural 6",
        shortLabel: "Locrian Natural 6",
        parentMajorOffset: 1,
        intervals: [0, 1, 3, 5, 6, 9, 10],
      },
      {
        scaleName: "Ionian Augmented",
        displayLabel: "Ionian Augmented",
        shortLabel: "Ionian Augmented",
        parentMajorOffset: 0,
        intervals: [0, 2, 4, 5, 8, 9, 11],
      },
      {
        scaleName: "Dorian Sharp 4",
        displayLabel: "Dorian Sharp 4",
        shortLabel: "Dorian #4",
        parentMajorOffset: 10,
        intervals: [0, 2, 3, 6, 7, 9, 10],
      },
      {
        scaleName: "Phrygian Dominant",
        displayLabel: "Phrygian Dominant",
        shortLabel: "Phrygian Dominant",
        parentMajorOffset: 8,
        intervals: [0, 1, 4, 5, 7, 8, 10],
      },
      {
        scaleName: "Lydian Sharp 2",
        displayLabel: "Lydian Sharp 2",
        shortLabel: "Lydian #2",
        parentMajorOffset: 7,
        intervals: [0, 3, 4, 6, 7, 9, 11],
      },
      {
        scaleName: "Altered Diminished",
        displayLabel: "Altered Diminished",
        shortLabel: "Altered Dim.",
        parentMajorOffset: 5,
        intervals: [0, 1, 3, 4, 6, 8, 9],
      },
    ],
  },
  {
    id: "melodic-minor",
    label: "Melodic Minor",
    selectorLabel: "Melodic Minor",
    defaultScaleName: "Melodic Minor",
    members: [
      {
        scaleName: "Melodic Minor",
        displayLabel: "Melodic Minor (Jazz Minor)",
        shortLabel: "Jazz Minor",
        parentMajorOffset: 3,
        intervals: [0, 2, 3, 5, 7, 9, 11],
      },
      {
        scaleName: "Dorian Flat 2",
        displayLabel: "Dorian Flat 2",
        shortLabel: "Dorian b2",
        parentMajorOffset: 1,
        intervals: [0, 1, 3, 5, 7, 9, 10],
      },
      {
        scaleName: "Lydian Augmented",
        displayLabel: "Lydian Augmented",
        shortLabel: "Lydian Aug.",
        parentMajorOffset: 0,
        intervals: [0, 2, 4, 6, 8, 9, 11],
      },
      {
        scaleName: "Lydian Dominant",
        displayLabel: "Lydian Dominant",
        shortLabel: "Lydian Dom.",
        parentMajorOffset: 10,
        intervals: [0, 2, 4, 6, 7, 9, 10],
      },
      {
        scaleName: "Mixolydian Flat 6",
        displayLabel: "Mixolydian Flat 6",
        shortLabel: "Mixolydian b6",
        parentMajorOffset: 8,
        intervals: [0, 2, 4, 5, 7, 8, 10],
      },
      {
        scaleName: "Locrian Natural 2",
        displayLabel: "Locrian Natural 2",
        shortLabel: "Locrian Nat. 2",
        parentMajorOffset: 6,
        intervals: [0, 2, 3, 5, 6, 8, 10],
      },
      {
        scaleName: "Altered",
        displayLabel: "Altered",
        shortLabel: "Altered",
        parentMajorOffset: 4,
        intervals: [0, 1, 3, 4, 6, 8, 10],
      },
    ],
  },
  {
    id: "pentatonic",
    label: "Pentatonic",
    selectorLabel: "Pentatonic",
    defaultScaleName: "Minor Pentatonic",
    members: [
      {
        scaleName: "Minor Pentatonic",
        displayLabel: "Minor Pentatonic",
        shortLabel: "Minor",
        parentMajorOffset: 3,
        intervals: [0, 3, 5, 7, 10],
      },
      {
        scaleName: "Major Pentatonic",
        displayLabel: "Major Pentatonic",
        shortLabel: "Major",
        parentMajorOffset: 0,
        intervals: [0, 2, 4, 7, 9],
      },
    ],
  },
  {
    id: "blues",
    label: "Blues",
    selectorLabel: "Blues",
    defaultScaleName: "Minor Blues",
    members: [
      {
        scaleName: "Minor Blues",
        displayLabel: "Minor Blues",
        shortLabel: "Minor",
        parentMajorOffset: 3,
        intervals: [0, 3, 5, 6, 7, 10],
      },
      {
        scaleName: "Major Blues",
        displayLabel: "Major Blues",
        shortLabel: "Major",
        parentMajorOffset: 0,
        intervals: [0, 2, 3, 4, 7, 9],
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
    family.members.map((member) => [member.scaleName, [...member.intervals]]),
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

for (const family of SCALE_FAMILIES) {
  familyById.set(family.id, family);
  familyBySelectorLabel.set(family.selectorLabel, family);
  family.members.forEach((member, index) => {
    scaleEntryByName.set(member.scaleName, { family, member, index });
  });
}

function getDefaultScaleEntry(): ScaleCatalogEntry {
  return scaleEntryByName.get("Major")!;
}

export function normalizeScaleName(scaleName: string): string {
  return SCALE_NAME_ALIASES[scaleName] ?? scaleName;
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
  return getScaleFamilyById(familyId)?.defaultScaleName ?? "Major";
}

export function getScaleNameForFamilySelector(selectorLabel: string): string {
  return getScaleFamilyBySelectorLabel(selectorLabel)?.defaultScaleName ?? "Major";
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
