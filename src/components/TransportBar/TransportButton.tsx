import { type ComponentPropsWithoutRef } from "react";
import clsx from "clsx";
import styles from "./TransportBar.module.css";

interface TransportButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Engaged/active state — applies the accent (lit faceplate) treatment. */
  active?: boolean;
  /** "touch" pins a 44px minimum hit target for standalone hosts whose tier
   *  guards don't reach them (e.g. the sheet peek's primary play button). */
  size?: "default" | "touch";
}

/**
 * The squared faceplate transport button — the app's canonical style for
 * playback and backing-instrument controls. Single source for TransportBar,
 * InstrumentToggleCluster, and the mobile sheet peek so the treatment can
 * never drift between surfaces. Styles live in TransportBar.module.css with
 * self-contained token fallbacks, so the button renders correctly without a
 * `.transportBar`/`.cluster` ancestor.
 */
export function TransportButton({
  active = false,
  size = "default",
  className,
  type = "button",
  ...rest
}: TransportButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        styles.transportButton,
        active && styles["transportButton--accent"],
        size === "touch" && styles["transportButton--touch"],
        className,
      )}
      {...rest}
    />
  );
}
