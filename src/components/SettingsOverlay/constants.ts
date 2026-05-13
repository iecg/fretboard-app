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
    labelKey: "settings.fields.zoom",
  },
  fretRange: {
    key: "fretRange",
    labelKey: "settings.fields.fretRange",
  },
  scaleDegreeColors: {
    key: "scaleDegreeColors",
    labelKey: "settings.fields.scaleDegreeColors",
    hintKey: "settings.fields.scaleDegreeColorsHint",
  },
  tuning: {
    key: "tuning",
    labelKey: "settings.fields.tuning",
  },
  accidentals: {
    key: "accidentals",
    labelKey: "settings.fields.accidentals",
    className: "overlay-field--accidentals",
    hintKey: "settings.fields.accidentalsHint",
  },
  enharmonicDisplay: {
    key: "enharmonicDisplay",
    labelKey: "settings.fields.enharmonicDisplay",
    hintKey: "settings.fields.enharmonicDisplayHint",
  },
  chordSpread: {
    key: "chordSpread",
    labelKey: "settings.fields.chordSpread",
    hintKey: "settings.fields.chordSpreadHint",
  },
  theme: {
    key: "theme",
    labelKey: "settings.fields.theme",
    hintKey: "settings.fields.themeHint",
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

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;
