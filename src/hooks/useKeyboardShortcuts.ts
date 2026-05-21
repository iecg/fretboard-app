import { useEffect } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { scaleVisibleAtom } from "../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";

export function useKeyboardShortcuts() {
  const scaleVisible = useAtomValue(scaleVisibleAtom);
  const setScaleVisible = useSetAtom(scaleVisibleAtom);
  const chordHidden = useAtomValue(chordOverlayHiddenAtom);
  const setChordHidden = useSetAtom(chordOverlayHiddenAtom);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into form fields
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;
      // Ignore modifiers (Cmd+S etc. should not be intercepted)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setScaleVisible(!scaleVisible);
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setChordHidden(!chordHidden);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scaleVisible, chordHidden, setScaleVisible, setChordHidden]);
}
