import { useAtom } from "jotai";
import {
  fretStartAtom,
  fretEndAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  scaleDegreeColorsEnabledAtom,
  fullChordsEnabledAtom,
  isMutedAtom,
  displayFormatAtom,
} from "../../store/atoms";
import { MAX_FRET } from "@fretflow/core";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { FretRangeControl } from "../FretRangeControl/FretRangeControl";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { PropGrid, Prop, GroupHeader, ToggleProp } from "./InspectorGrid";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ViewTab.module.css";

const ACCIDENTAL_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "♯", value: "sharps" },
  { label: "♭", value: "flats" },
] as const;

const ENHARMONIC_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
] as const;

const NOTE_LABEL_OPTIONS = [
  { value: "notes", label: "Notes" },
  { value: "degrees", label: "Intervals" },
  { value: "none", label: "None" },
] as const;

export function ViewTab() {
  const { t } = useTranslation();
  const [fretStart, setFretStart] = useAtom(fretStartAtom);
  const [fretEnd, setFretEnd] = useAtom(fretEndAtom);
  const [accidentalMode, setAccidentalMode] = useAtom(accidentalModeAtom);
  const [enharmonicDisplay, setEnharmonicDisplay] = useAtom(enharmonicDisplayAtom);
  const [scaleDegreeColors, setScaleDegreeColors] = useAtom(scaleDegreeColorsEnabledAtom);
  const [fullChords, setFullChords] = useAtom(fullChordsEnabledAtom);
  const [muted, setMuted] = useAtom(isMutedAtom);
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);

  return (
    <div className={styles.root} data-inspector-tab="view">
      <PropGrid columns={6}>
        {/* FINGERING — the group header and pattern cells are emitted by
            FingeringPatternControls; Fret Range closes the group. */}
        <FingeringPatternControls />
        <Prop label={t("settings.fields.fretRange")} span={2}>
          <FretRangeControl
            startFret={fretStart}
            endFret={fretEnd}
            onStartChange={setFretStart}
            onEndChange={setFretEnd}
            maxFret={MAX_FRET}
            layout="dashboard"
          />
        </Prop>

        <GroupHeader>{t("inspector.groupLabels")}</GroupHeader>
        <Prop label={t("controls.noteLabels")} span={2}>
          <ToggleBar
            label={t("controls.noteLabels")}
            options={NOTE_LABEL_OPTIONS}
            value={displayFormat}
            onChange={(v) => setDisplayFormat(v as "notes" | "degrees" | "none")}
          />
        </Prop>
        <Prop label={t("settings.fields.accidentals")} span={2}>
          <ToggleBar
            label={t("settings.fields.accidentals")}
            options={ACCIDENTAL_OPTIONS}
            value={accidentalMode}
            onChange={(v) => setAccidentalMode(v as typeof accidentalMode)}
          />
        </Prop>
        <Prop label={t("settings.fields.enharmonicDisplay")} span={2}>
          <ToggleBar
            label={t("settings.fields.enharmonicDisplay")}
            options={ENHARMONIC_OPTIONS}
            value={enharmonicDisplay}
            onChange={(v) => setEnharmonicDisplay(v as typeof enharmonicDisplay)}
          />
        </Prop>

        <GroupHeader>{t("inspector.groupDisplay")}</GroupHeader>
        <ToggleProp
          label={t("inspector.degreeColors")}
          checked={scaleDegreeColors}
          onChange={setScaleDegreeColors}
        />
        <ToggleProp
          label={t("inspector.fullChords")}
          checked={fullChords}
          onChange={setFullChords}
        />
        <ToggleProp
          label={t("inspector.tapToPlay")}
          checked={!muted}
          onChange={(next) => setMuted(!next)}
        />
      </PropGrid>
    </div>
  );
}
