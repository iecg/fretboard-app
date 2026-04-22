import {
  type AccidentalOptionValue,
  type EnharmonicDisplayValue,
  type SettingFieldKey,
  type SettingFieldConfig,
  type SettingsSectionConfig,
} from "./types";

export const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "♯", value: "sharps" },
  { label: "♭", value: "flats" },
] as const satisfies readonly {
  label: string;
  value: AccidentalOptionValue;
}[];

export const ENHARMONIC_DISPLAY_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const satisfies readonly {
  label: string;
  value: EnharmonicDisplayValue;
}[];

export const SETTING_FIELDS: Record<SettingFieldKey, SettingFieldConfig> = {
  zoom: {
    key: "zoom",
    label: "Zoom",
  },
  fretRange: {
    key: "fretRange",
    label: "Fret Range",
  },
  tuning: {
    key: "tuning",
    label: "Tuning",
  },
  accidentals: {
    key: "accidentals",
    label: "Accidentals",
    help: {
      id: "accidentals",
      content:
        "Auto chooses sharps or flats based on the current musical context.",
    },
  },
  enharmonicDisplay: {
    key: "enharmonicDisplay",
    label: "Enharmonic Display",
    help: {
      id: "enharmonicDisplay",
      content:
        "Controls whether equivalent note spellings appear when they clarify the theory view.",
    },
  },
  chordSpread: {
    key: "chordSpread",
    label: "Chord Spread",
    help: {
      id: "chordSpread",
      content:
        "Limits how far the visible chord tones can span across frets on the fretboard.",
    },
  },
};

export const SETTINGS_SECTIONS: readonly SettingsSectionConfig[] = [
  {
    id: "view",
    title: "View",
    fields: ["zoom", "fretRange"],
  },
  {
    id: "instrument",
    title: "Instrument",
    fields: ["tuning"],
  },
  {
    id: "notation",
    title: "Notation",
    fields: ["accidentals", "enharmonicDisplay"],
  },
  {
    id: "chord-layout",
    title: "Chord Layout",
    fields: ["chordSpread"],
  },
  {
    id: "reset",
    title: "Reset",
    tone: "danger",
    fields: [],
  },
] as const;

export const ZOOM_STEP = 10;
