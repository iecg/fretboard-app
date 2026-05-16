import type { ReactNode } from "react";
import { Layout, Music2, Layers, ListMusic } from "lucide-react";
import type { Dictionary } from "../../i18n/types";

export type InspectorTabId = "view" | "scale" | "chord" | "progression";

export interface InspectorTabConfig {
  id: InspectorTabId;
  labelKey: keyof Dictionary["inspector"];
  icon: ReactNode;
}

export const INSPECTOR_TABS: InspectorTabConfig[] = [
  { id: "view", labelKey: "viewTab", icon: <Layout size={18} /> },
  { id: "scale", labelKey: "scaleTab", icon: <Music2 size={18} /> },
  { id: "chord", labelKey: "chordTab", icon: <Layers size={18} /> },
  { id: "progression", labelKey: "progressionTab", icon: <ListMusic size={18} /> },
];
