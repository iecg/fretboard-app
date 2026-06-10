import { useAtomValue, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { urlOverridesAtom, clearUrlOverridesAtom } from "../../store/urlOverrideAtoms";
import styles from "./SharedLinkBanner.module.css";

export function SharedLinkBanner() {
  const overrides = useAtomValue(urlOverridesAtom);
  const clearOverrides = useSetAtom(clearUrlOverridesAtom);

  if (!overrides) return null;

  const chordList = overrides.steps
    .map((s) => {
      let label = s.degree;
      if (s.qualityOverride) label += s.qualityOverride;
      return label;
    })
    .join("-");

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles["banner-text"]}>
        Viewing shared song — {overrides.root} {overrides.scale} {chordList}
      </span>
      <button
        type="button"
        onClick={() => clearOverrides()}
        className={styles["banner-dismiss"]}
        aria-label="Dismiss shared song view"
      >
        <X size={14} />
      </button>
    </div>
  );
}
