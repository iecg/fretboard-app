import { useState, type ReactNode } from "react";
import clsx from "clsx";

interface KeyExplorerProps {
  children: ReactNode;
}

export function KeyExplorer({ children }: KeyExplorerProps) {
  const [isKeyExplorerOpen, setKeyExplorerOpen] = useState(false);

  return (
    <div className="theory-inline-key panel-surface panel-surface--compact">
      <button
        type="button"
        className={clsx("theory-disclosure-btn", {
          "theory-disclosure-btn--open": isKeyExplorerOpen,
        })}
        aria-expanded={isKeyExplorerOpen}
        onClick={() => setKeyExplorerOpen((value) => !value)}
      >
        <span className="theory-disclosure-title">Circle of Fifths</span>
        <span className="theory-disclosure-summary">
          {isKeyExplorerOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isKeyExplorerOpen ? (
        <div className="theory-inline-key-content">{children}</div>
      ) : null}
    </div>
  );
}
