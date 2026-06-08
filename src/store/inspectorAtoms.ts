import { atom } from "jotai";
import type { InspectorTabId } from "../components/Inspector/tabs";

export const inspectorActiveTabAtom = atom<InspectorTabId>("view");
