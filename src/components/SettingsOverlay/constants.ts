import {
  type AccidentalOptionValue,
  type EnharmonicDisplayValue,
  type ThemeOptionValue,
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

export const THEME_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
] as const satisfies readonly {
  label: string;
  value: ThemeOptionValue;
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
    className: "overlay-field--accidentals",
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
  theme: {
    key: "theme",
    label: "Theme",
    help: {
      id: "theme",
      content:
        "Choose your preferred color theme. System matches your device settings.",
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
    id: "appearance",
    title: "Appearance",
    fields: ["theme"],
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
