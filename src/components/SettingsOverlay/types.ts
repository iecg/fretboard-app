export type AccidentalOptionValue = "auto" | "sharps" | "flats";
export type EnharmonicDisplayValue = "auto" | "on" | "off";
export type { ThemePreference as ThemeOptionValue } from "../../store/uiAtoms";

export type SettingFieldKey =
  | "zoom"
  | "fretRange"
  | "scaleDegreeColors"
  | "tuning"
  | "accidentals"
  | "enharmonicDisplay"
  | "chordSpread"
  | "theme";

export type SettingFieldConfig = {
  key: SettingFieldKey;
  label: string;
  hint?: string;
  className?: string;
};

export type SettingsSectionConfig = {
  id: string;
  title: string;
  tone?: "default" | "danger";
  fields: SettingFieldKey[];
};
