import { useAtom } from "jotai";
import { ZoomIn, ZoomOut } from "lucide-react";
import { FRET_ZOOM_MIN, FRET_ZOOM_MAX } from "@fretflow/core";
import { fretZoomAtom } from "../../store/layoutAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { TransportButton } from "../TransportBar/TransportButton";
import styles from "./StageZoomControl.module.css";

/** Matches ZOOM_STEP in src/components/SettingsOverlay/constants.ts. */
const ZOOM_STEP = 10;

/**
 * Floating zoom buttons over the mobile stage (maps-style). Adjusts the same
 * fretZoomAtom the Settings stepper drives: 100 = auto-fit width, above it
 * the board zooms in and scrolls horizontally.
 */
export function StageZoomControl() {
  const { t } = useTranslation();
  const [fretZoom, setFretZoom] = useAtom(fretZoomAtom);

  const step = (delta: number) =>
    setFretZoom(
      Math.min(FRET_ZOOM_MAX, Math.max(FRET_ZOOM_MIN, fretZoom + delta)),
    );

  return (
    <div className={styles.zoomControl} data-testid="stage-zoom">
      <TransportButton
        size="touch"
        onClick={() => step(ZOOM_STEP)}
        disabled={fretZoom >= FRET_ZOOM_MAX}
        aria-label={t("mobileDock.zoomIn")}
        data-testid="stage-zoom-in"
      >
        <ZoomIn size={18} strokeWidth={2.2} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        size="touch"
        onClick={() => step(-ZOOM_STEP)}
        disabled={fretZoom <= FRET_ZOOM_MIN}
        aria-label={t("mobileDock.zoomOut")}
        data-testid="stage-zoom-out"
      >
        <ZoomOut size={18} strokeWidth={2.2} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
