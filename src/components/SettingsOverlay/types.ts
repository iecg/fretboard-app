export type { ThemePreference as ThemeOptionValue } from "@fretflow/fretboard/store/uiAtoms";

export type SettingFieldKey =
  | "zoom"
  | "height"
  | "fretRange"
  | "tuning"
  | "theme";

export type SettingFieldConfig = {
  key: SettingFieldKey;
  labelKey: string;
  hintKey?: string;
  className?: string;
};
