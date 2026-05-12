import useLayoutMode from "../../hooks/useLayoutMode";
import styles from "./RotateOverlay.module.css";

export function RotateOverlay() {
  const layout = useLayoutMode();

  if (layout.variant !== "landscape-mobile") return null;

  return (
    <div className={styles.overlay} role="alert" aria-live="polite">
      <div className={styles.content}>
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
        <p className={styles.message}>
          Please rotate your device to portrait mode
        </p>
      </div>
    </div>
  );
}
