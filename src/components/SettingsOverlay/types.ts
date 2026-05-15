export type { ThemePreference as ThemeOptionValue } from "../../store/uiAtoms";

export type SettingFieldKey =
  | "zoom"
  | "fretRange"
  | "tuning"
  | "chordSpread"
  | "theme";

export type SettingFieldConfig = {
  key: SettingFieldKey;
  labelKey: string;
  hintKey?: string;
  className?: string;
};
