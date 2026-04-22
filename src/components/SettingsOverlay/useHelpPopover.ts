import { useEffect, useRef, useState } from "react";
import { type HelpFieldId } from "./types";

export function useHelpPopover() {
  const [activeHelpField, setActiveHelpField] = useState<HelpFieldId | null>(null);
  const activeHelpFieldRef = useRef<HelpFieldId | null>(null);
  const helpContainerRefs = useRef<Record<HelpFieldId, HTMLDivElement | null>>({
    chordSpread: null,
    accidentals: null,
    enharmonicDisplay: null,
  });

  useEffect(() => {
    activeHelpFieldRef.current = activeHelpField;
  }, [activeHelpField]);

  const handleHelpToggle = (fieldId: HelpFieldId) => {
    setActiveHelpField((current) => (current === fieldId ? null : fieldId));
  };

  useEffect(() => {
    if (!activeHelpField) return;

    const handlePointerDown = (event: MouseEvent) => {
      const helpContainer = helpContainerRefs.current[activeHelpField];
      if (helpContainer?.contains(event.target as Node)) return;
      setActiveHelpField(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeHelpField]);

  const registerHelpContainer = (id: HelpFieldId, node: HTMLDivElement | null) => {
    helpContainerRefs.current[id] = node;
  };

  return {
    activeHelpField,
    activeHelpFieldRef,
    helpContainerRefs,
    registerHelpContainer,
    setActiveHelpField,
    handleHelpToggle,
  };
}
