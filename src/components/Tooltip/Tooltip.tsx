import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  /** Tooltip content. Plain text or rich nodes. */
  content: ReactNode;
  /** The trigger element. Should be a single focusable child. */
  children: ReactNode;
  /** Which side of the trigger to render on. Defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Delay before the tooltip appears on pointer hover, ms. Defaults to 400. */
  delayDuration?: number;
}

/**
 * Accessible tooltip wrapper around @radix-ui/react-tooltip. Delivers Radix's
 * full behavior: delayed-show, focus + pointer triggers, portal rendering,
 * and collision-aware positioning. Style is owned by the local CSS module —
 * Radix supplies only the behavior.
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
  delayDuration = 400,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            className={styles.content}
            side={side}
            sideOffset={4}
          >
            {content}
            <RadixTooltip.Arrow className={styles.arrow} width={10} height={5} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
