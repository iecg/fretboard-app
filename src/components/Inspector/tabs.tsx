import type { ReactNode } from "react";
import { Eye, ListMusic } from "lucide-react";
import type { Dictionary } from "../../i18n/types";

export type InspectorTabId = "view" | "song";

export interface InspectorTabConfig {
  id: InspectorTabId;
  labelKey: keyof Dictionary["inspector"];
  icon: ReactNode;
}

export const INSPECTOR_TABS: InspectorTabConfig[] = [
  { id: "view", labelKey: "viewTab", icon: <Eye size={18} /> },
  { id: "song", labelKey: "songTab", icon: <ListMusic size={18} /> },
];
