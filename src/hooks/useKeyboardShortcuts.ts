import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { scaleVisibleAtom } from "../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../store/chordOverlayAtoms";

export function useKeyboardShortcuts() {
  const setScaleVisible = useSetAtom(scaleVisibleAtom);
  const setChordHidden = useSetAtom(chordOverlayHiddenAtom);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into form fields or selects.
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      )
        return;
      // Don't hijack browser shortcuts (Cmd+S, Ctrl+S, Alt+S, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setScaleVisible((v) => !v);
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setChordHidden((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScaleVisible, setChordHidden]);
}
