import { useEffect, useRef, useState } from "react";

export function useHelpPopover<TId extends string = string>() {
  const [activeHelpField, setActiveHelpField] = useState<TId | null>(null);
  const activeHelpFieldRef = useRef<TId | null>(null);
  const helpContainerRefs = useRef<Map<TId, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    activeHelpFieldRef.current = activeHelpField;
  }, [activeHelpField]);

  const handleHelpToggle = (fieldId: TId) => {
    setActiveHelpField((current) => (current === fieldId ? null : fieldId));
  };

  useEffect(() => {
    if (!activeHelpField) return;

    const handlePointerDown = (event: MouseEvent) => {
      const helpContainer = helpContainerRefs.current.get(activeHelpField);
      if (helpContainer?.contains(event.target as Node)) return;
      setActiveHelpField(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeHelpField]);

  const registerHelpContainer = (id: TId, node: HTMLDivElement | null) => {
    helpContainerRefs.current.set(id, node);
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
