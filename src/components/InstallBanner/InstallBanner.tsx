import { Download, X } from "lucide-react";
import styles from "./InstallBanner.module.css";

interface InstallBannerProps {
  canInstall: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ canInstall, onInstall, onDismiss }: InstallBannerProps) {
  if (!canInstall) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles["banner-text"]}>
        Install FretFlow for offline practice
      </span>
      <button
        type="button"
        onClick={onInstall}
        className={styles["banner-install"]}
        aria-label="Install FretFlow"
      >
        <Download size={14} />
        <span>Install</span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className={styles["banner-dismiss"]}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
