export type AccidentalOptionValue = "auto" | "sharps" | "flats";
export type EnharmonicDisplayValue = "auto" | "on" | "off";
export type HelpFieldId = "chordSpread" | "accidentals" | "enharmonicDisplay";

export type SettingFieldKey =
  | "zoom"
  | "fretRange"
  | "tuning"
  | "accidentals"
  | "enharmonicDisplay"
  | "chordSpread";

export type FieldHelp = {
  id: HelpFieldId;
  content: string;
};

export type SettingFieldConfig = {
  key: SettingFieldKey;
  label: string;
  help?: FieldHelp;
  className?: string;
};

export type SettingsSectionConfig = {
  id: string;
  title: string;
  tone?: "default" | "danger";
  fields: SettingFieldKey[];
};
