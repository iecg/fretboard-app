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
  scaleDegreeColors: {
    key: "scaleDegreeColors",
    label: "Scale Degree Colors",
    hint: "Colors each scale note by its degree.",
  },
  tuning: {
    key: "tuning",
    label: "Tuning",
  },
  accidentals: {
    key: "accidentals",
    label: "Accidentals",
    className: "overlay-field--accidentals",
    hint: "Auto chooses sharps or flats based on the current musical context.",
  },
  enharmonicDisplay: {
    key: "enharmonicDisplay",
    label: "Enharmonic Display",
    hint: "Controls whether equivalent note spellings appear when they clarify the theory view.",
  },
  chordSpread: {
    key: "chordSpread",
    label: "Chord Spread",
    hint: "Limits how far the visible chord tones can span across frets on the fretboard.",
  },
  theme: {
    key: "theme",
    label: "Theme",
    hint: "Choose your preferred color theme. System matches your device settings.",
  },
};

export const SETTINGS_SECTIONS: readonly SettingsSectionConfig[] = [
  {
    id: "view",
    title: "View",
    fields: ["zoom", "fretRange", "scaleDegreeColors"],
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
