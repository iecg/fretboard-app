import clsx from "clsx";
import { useResetConfirmation } from "../useResetConfirmation";
import styles from "../SettingsOverlay.module.css";

export function ResetSettingsSection({ onClose }: { onClose: () => void }) {
  const { resetConfirming, handleResetClick } = useResetConfirmation(onClose);

  return (
    <div className={styles["overlay-reset-section"]}>
      <p className={styles["overlay-reset-copy"]}>
        Restore every setting in the app back to its default value.
      </p>
      <button
        type="button"
        className={clsx(styles["overlay-reset-btn"], {
          [styles["overlay-reset-confirming"]]: resetConfirming,
        })}
        onClick={handleResetClick}
      >
        {resetConfirming ? "Click again to confirm" : "Reset all settings"}
      </button>
    </div>
  );
}
