import { useState, type ReactNode } from "react";
import clsx from "clsx";
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
      {isKeyExplorerOpen ? (
        <div className={styles["theory-inline-key-content"]}>{children}</div>
      ) : null}
    </div>
  );
}
