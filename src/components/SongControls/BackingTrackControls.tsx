import { useProgressionState } from "../../hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import { GENRE_STYLES } from "../../progressions/audio/genres";
import { InstrumentToggleCluster } from "../TransportBar/InstrumentToggleCluster";
import { Prop, GroupHeader } from "../Inspector/InspectorGrid";

export interface BackingTrackControlsProps {
  /** When true, skip the internal GroupHeader (host provides its own card chrome). */
  hideHeader?: boolean;
}
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";

/**
 * The BACKING TRACK group of the Progression tab. Exposes only the genre
 * selector — patterns and swing are bundled into each genre preset rather
 * than offered as individual knobs.
 */
export function BackingTrackControls({ hideHeader = false }: BackingTrackControlsProps = {}) {
  const { t } = useTranslation();
  // The four instrument on/off toggles only get a home here on touch/sheet
  // shells — on desktop the header TransportBar already hosts them, so showing
  // them in the Song tab too would duplicate the controls. (Patterns and swing
  // are no longer individual knobs — they're bundled into each genre preset.)
  const { useSheetShell } = useLayoutMode();
  const { progressionGenreStyle, applyGenreStyle } = useProgressionState();

  return (
    <>
      {!hideHeader && <GroupHeader>{t("inspector.groupBackingTrack")}</GroupHeader>}
      {useSheetShell && (
        <Prop label={t("inspector.btInstruments")} span={6}>
          <InstrumentToggleCluster />
        </Prop>
      )}
      <Prop label={t("inspector.btGenre")} span={1}>
        <LabeledSelect
          label="Genre style"
          hideLabel
          value={progressionGenreStyle}
          options={[
            ...GENRE_STYLES.map((g) => ({ value: g.id, label: g.label })),
            // Show "Custom" only when it's the current value — the option is
            // not user-selectable; it just reflects manually edited settings.
            ...(progressionGenreStyle === "custom"
              ? [{ value: "custom", label: "Custom" }]
              : []),
          ]}
          onChange={applyGenreStyle}
        />
      </Prop>
    </>
  );
}
