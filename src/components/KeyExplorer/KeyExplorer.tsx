import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import {
  ANIMATION_DURATION_STANDARD,
  ANIMATION_EASE,
} from "@fretflow/core";
import styles from "../TheoryControls/TheoryControls.module.css";

interface KeyExplorerProps {
  children: ReactNode;
}

export function KeyExplorer({ children }: KeyExplorerProps) {
  const [isKeyExplorerOpen, setKeyExplorerOpen] = useState(false);

  return (
    <div className={clsx(styles["theory-inline-key"], "panel-surface panel-surface--compact")}>
      <button
        type="button"
        className={clsx(styles["theory-disclosure-btn"], {
          [styles["theory-disclosure-btn--open"]]: isKeyExplorerOpen,
        })}
        aria-expanded={isKeyExplorerOpen}
        onClick={() => setKeyExplorerOpen((value) => !value)}
      >
        <span className={styles["theory-disclosure-title"]}>Circle of Fifths</span>
        <span className={styles["theory-disclosure-summary"]}>
          {isKeyExplorerOpen ? "Hide" : "Show"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isKeyExplorerOpen ? (
          <motion.div
            key="key-explorer-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: ANIMATION_DURATION_STANDARD,
              ease: ANIMATION_EASE,
            }}
            className={styles["theory-inline-key-content"]}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
