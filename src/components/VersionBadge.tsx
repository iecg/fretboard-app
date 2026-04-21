import styles from "./VersionBadge.module.css";

export function VersionBadge() {
  return (
    <div className={styles["version-badge"]} data-testid="version-badge">
      <span>
        v{__APP_VERSION__}&nbsp;·&nbsp;© {new Date().getFullYear()} Isaac Cocar.
        Licensed under{" "}
        <a
          href="https://www.gnu.org/licenses/agpl-3.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          AGPL v3
        </a>
        .
      </span>
      <a
        href="https://ko-fi.com/E1E01XFJ0G"
        target="_blank"
        rel="noopener noreferrer"
        className={styles["kofi-badge-btn"]}
        title="Support FretFlow on Ko-fi"
      >
        <img
          src="/fretboard-app/kofi_symbol.png"
          alt="Ko-fi"
          className={styles["kofi-badge-icon"]}
        />
      </a>
    </div>
  );
}
