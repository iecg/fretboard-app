import type { ReactElement } from "react";

export interface SettingsTooltipProps {
  /** The gear <button> element (trigger). */
  children: ReactElement;
}

/** Thin pass-through — the button already carries title="Settings" and
 *  aria-label="Open settings" which gives the OS-level tooltip for free. */
export function SettingsTooltip({ children }: SettingsTooltipProps) {
  return children;
}
