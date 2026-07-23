import clsx from "clsx";
import { useAtom } from "jotai";
import { StepperControl } from "../../StepperControl/StepperControl";
import { FretRangeControl } from "../../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../../ToggleBar/ToggleBar";
import { MAX_FRET, FRET_ZOOM_MIN, FRET_ZOOM_OUT_MIN, FRET_ZOOM_MAX, STRING_ROW_PX_OVERRIDE_MIN, STRING_ROW_PX_OVERRIDE_MAX } from "@fretflow/core";
import { ZOOM_STEP, HEIGHT_STEP, SETTING_FIELDS } from "../constants";
import { stringRowPxOverrideAtom } from "@fretflow/fretboard/store/layoutAtoms";
import { OverlayFieldHeader } from "../shared";
import { useSettingsForm } from "../useSettingsForm";
import { useTranslation } from "../../../hooks/useTranslation";
import useLayoutMode from "../../../hooks/useLayoutMode";
import { accidentalModeAtom } from "@fretflow/fretboard/store/scaleAtoms";
import { enharmonicDisplayAtom, audioQualityAtom } from "@fretflow/fretboard/store/audioAtoms";
import { displayFormatAtom } from "@fretflow/fretboard/store/uiAtoms";
import styles from "../SettingsOverlay.module.css";

export default function DisplaySettingsSection() {
  const { t } = useTranslation();
  const { fretZoom, setFretZoom, fretStart, setFretStart, fretEnd, setFretEnd } =
    useSettingsForm();
  // Sub-100 zoom (zoom OUT) only does anything on sheet shells, where it
  // shrinks the board so more frets fit; desktop auto-fit already shows the
  // full neck, so its stepper floor stays at 100.
  const { useSheetShell } = useLayoutMode();
  const zoomMin = useSheetShell ? FRET_ZOOM_OUT_MIN : FRET_ZOOM_MIN;
  const [stringRowPxOverride, setStringRowPxOverride] = useAtom(stringRowPxOverrideAtom);

  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [audioQuality, setAudioQuality] = useAtom(audioQualityAtom);

  const NOTE_LABEL_OPTIONS = [
    { value: "notes", label: t("inspector.notes") },
    { value: "degrees", label: t("inspector.intervals") },
    { value: "none", label: t("inspector.none") },
  ] as const;

  const ACCIDENTAL_OPTIONS = [
    { label: t("inspector.auto"), value: "auto" },
    { label: "♯", value: "sharps" },
    { label: "♭", value: "flats" },
  ] as const;

  const ENHARMONIC_OPTIONS = [
    { label: t("inspector.auto"), value: "auto" },
    { label: t("controls.on"), value: "on" },
    { label: t("controls.off"), value: "off" },
  ] as const;

  const SOUND_QUALITY_OPTIONS = [
    { label: t("settings.soundQuality.auto"), value: "auto" },
    { label: t("settings.soundQuality.eco"), value: "eco" },
    { label: t("settings.soundQuality.standard"), value: "standard" },
    { label: t("settings.soundQuality.high"), value: "high" },
  ] as const;

  return (
    <>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("controls.noteLabels")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("controls.noteLabels")}
            options={NOTE_LABEL_OPTIONS}
            value={displayFormat}
            onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("settings.fields.accidentals")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("settings.fields.accidentals")}
            options={ACCIDENTAL_OPTIONS}
            value={accidentalMode}
            onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("settings.fields.enharmonicDisplay")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("settings.fields.enharmonicDisplay")}
            options={ENHARMONIC_OPTIONS}
            value={enharmonicDisplay}
            onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t("settings.fields.soundQuality")} />
        <div className={styles["overlay-field-control"]}>
          <ToggleBar
            label={t("settings.fields.soundQuality")}
            options={SOUND_QUALITY_OPTIONS}
            value={audioQuality}
            onChange={(v) => setAudioQuality(v as typeof audioQuality)}
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.zoom.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <StepperControl
            value={fretZoom}
            onChange={setFretZoom}
            min={zoomMin}
            max={FRET_ZOOM_MAX}
            step={ZOOM_STEP}
            formatValue={(zoom) =>
              zoom === 100
                ? t("settings.view.auto")
                : `${zoom}${t("settings.view.zoomSuffix")}`
            }
            buttonVariant="mobile"
          />
        </div>
      </div>
      <div className={clsx(styles["overlay-field"], styles["overlay-field--divided"])}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.height.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <StepperControl
            value={stringRowPxOverride}
            onChange={(v) => {
              if (stringRowPxOverride === 0 && v > 0) {
                setStringRowPxOverride(STRING_ROW_PX_OVERRIDE_MIN);
              } else if (v > 0 && v < STRING_ROW_PX_OVERRIDE_MIN) {
                setStringRowPxOverride(0);
              } else {
                setStringRowPxOverride(v);
              }
            }}
            min={0}
            max={STRING_ROW_PX_OVERRIDE_MAX}
            step={HEIGHT_STEP}
            formatValue={(px) => px === 0 ? t("settings.view.auto") : `${px}px`}
            buttonVariant="mobile"
          />
        </div>
      </div>
      <div className={styles["overlay-field"]}>
        <OverlayFieldHeader label={t(SETTING_FIELDS.fretRange.labelKey)} />
        <div className={styles["overlay-field-control"]}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="mobile"
          />
        </div>
      </div>
    </>
  );
}
