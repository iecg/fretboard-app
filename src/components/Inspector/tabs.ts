import type { Dictionary } from "../../i18n/types";

export type InspectorTabId = "view" | "scale" | "chord" | "progression";

export interface InspectorTabConfig {
  id: InspectorTabId;
  labelKey: keyof Dictionary["inspector"];
}

export const ALWAYS_VISIBLE_TABS: InspectorTabConfig[] = [
  { id: "view", labelKey: "viewTab" },
  { id: "scale", labelKey: "scaleTab" },
  { id: "chord", labelKey: "chordTab" },
];

export const PROGRESSION_TAB: InspectorTabConfig = {
  id: "progression",
  labelKey: "progressionTab",
};
