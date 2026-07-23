import { useAtom } from "jotai";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  STRING_ROW_PX_OVERRIDE_MIN,
  STRING_ROW_PX_OVERRIDE_MAX,
} from "@fretflow/core";
import { stringRowPxOverrideAtom } from "@fretflow/fretboard/store/layoutAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { TransportButton } from "../TransportBar/TransportButton";
import styles from "./StageHeightControl.module.css";

const HEIGHT_STEP = 4;

export function StageHeightControl() {
  const { t } = useTranslation();
  const [override, setOverride] = useAtom(stringRowPxOverrideAtom);

  const step = (delta: number) =>
    setOverride(
      Math.min(
        STRING_ROW_PX_OVERRIDE_MAX,
        Math.max(STRING_ROW_PX_OVERRIDE_MIN, (override || 36) + delta),
      ),
    );

  return (
    <div className={styles.heightControl} data-testid="stage-height">
      <TransportButton
        size="touch"
        onClick={() => step(HEIGHT_STEP)}
        disabled={(override || 36) >= STRING_ROW_PX_OVERRIDE_MAX}
        aria-label={t("mobileDock.heightUp")}
        data-testid="stage-height-up"
      >
        <ChevronUp size={18} strokeWidth={2.2} aria-hidden="true" />
      </TransportButton>
      <TransportButton
        size="touch"
        onClick={() => step(-HEIGHT_STEP)}
        disabled={(override || 36) <= STRING_ROW_PX_OVERRIDE_MIN}
        aria-label={t("mobileDock.heightDown")}
        data-testid="stage-height-down"
      >
        <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
      </TransportButton>
    </div>
  );
}
