import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import styles from "./Tooltip.module.css";

export interface TooltipProviderProps {
  /** Children that may contain Tooltip instances. */
  children: ReactNode;
  /** Delay before a tooltip appears on pointer hover, ms. Defaults to 400. */
  delayDuration?: number;
  /** When transitioning between tooltips within this window, the next opens
   *  instantly instead of waiting for delayDuration. Defaults to 200. */
  skipDelayDuration?: number;
}

/**
 * Mount once near the app root. Wraps all Tooltip instances in a single
 * Radix Provider so that consecutive tooltips skip the open delay (the
 * standard "mouse-from-button-to-button" UX in DAW transport rows).
 *
 * Usage:
 *   <TooltipProvider>
 *     <App />
 *   </TooltipProvider>
 */
export function TooltipProvider({
  children,
  delayDuration = 400,
  skipDelayDuration = 200,
}: TooltipProviderProps) {
  return (
    <RadixTooltip.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      {children}
    </RadixTooltip.Provider>
  );
}

export interface TooltipProps {
  /** Tooltip content. Plain text or rich nodes. */
  content: ReactNode;
  /** The trigger element. Should be a single focusable child. */
  children: ReactNode;
  /** Which side of the trigger to render on. Defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Optional override for this individual tooltip's open delay, ms.
   *  Defaults to the TooltipProvider's delayDuration. */
  delayDuration?: number;
}

/**
 * Accessible tooltip wrapper around @radix-ui/react-tooltip. Must be mounted
 * inside a `<TooltipProvider>` (typically at the app root). Style is owned
 * by the local CSS module — Radix supplies only the behavior.
 *
 * Usage:
 *   <Tooltip content="Help">
 *     <button aria-label="Help"><HelpIcon /></button>
 *   </Tooltip>
 */
export function Tooltip({
  content,
  children,
  side = "top",
  delayDuration,
}: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={styles.content} side={side} sideOffset={4}>
          {content}
          <RadixTooltip.Arrow className={styles.arrow} width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
