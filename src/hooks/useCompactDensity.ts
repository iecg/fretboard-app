import { useAtomValue } from "jotai";
import { compactDensityAtom } from "../store/atoms";
import useLayoutMode from "./useLayoutMode";

export function useCompactDensity(): boolean {
  const mode = useAtomValue(compactDensityAtom);
  const layout = useLayoutMode();
  
  if (mode === "on") return true;
  if (mode === "off") return false;
  
  // auto:
  // Force compact wherever the BottomTabBar is shown (mobile + portrait tablet).
  return layout.tier === "mobile" || layout.variant === "tablet-split";
}
