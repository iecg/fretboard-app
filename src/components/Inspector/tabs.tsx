import type { ReactNode } from "react";
import { Music2, Layers, ListMusic } from "lucide-react";
import type { Dictionary } from "../../i18n/types";

export type InspectorTabId = "scale" | "chord" | "song";

export interface InspectorTabConfig {
  id: InspectorTabId;
  labelKey: keyof Dictionary["inspector"];
  icon: ReactNode;
}

export const INSPECTOR_TABS: InspectorTabConfig[] = [
  { id: "scale", labelKey: "scaleTab", icon: <Music2 size={18} /> },
  { id: "chord", labelKey: "chordTab", icon: <Layers size={18} /> },
  { id: "song", labelKey: "songTab", icon: <ListMusic size={18} /> },
];
