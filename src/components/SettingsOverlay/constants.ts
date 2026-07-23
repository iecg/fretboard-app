import {
  type ThemeOptionValue,
  type SettingFieldKey,
  type SettingFieldConfig,
} from "./types";

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
  height: {
    key: "height",
    labelKey: "settings.fields.height",
  },
  fretRange: {
    key: "fretRange",
    labelKey: "settings.fields.fretRange",
  },
  tuning: {
    key: "tuning",
    labelKey: "settings.fields.tuning",
  },
  theme: {
    key: "theme",
    labelKey: "settings.fields.theme",
    hintKey: "settings.fields.themeHint",
  },
};

export const ZOOM_STEP = 10;

export const HEIGHT_STEP = 4;

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;
