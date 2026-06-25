import { useProgressionState } from "@fretflow/fretboard/hooks/useProgressionState";
import { useTranslation } from "../../hooks/useTranslation";
import { GENRE_STYLES } from "@fretflow/fretboard/progressions/audio/genres";
import { Prop, GroupHeader } from "../Inspector/InspectorGrid";

export interface BackingTrackControlsProps {
  /** When true, skip the internal GroupHeader (host provides its own card chrome). */
  hideHeader?: boolean;
}
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";

/**
 * The BACKING TRACK group of the Progression tab. Exposes only the genre
 * selector — patterns and swing are bundled into each genre preset rather
 * than offered as individual knobs, and the instrument on/off toggles live
 * in the transport (desktop TransportBar / mobile ShellTransport) on every
 * shell.
 */
export function BackingTrackControls({ hideHeader = false }: BackingTrackControlsProps = {}) {
  const { t } = useTranslation();
  const { progressionGenreStyle, applyGenreStyle } = useProgressionState();

  return (
    <>
      {!hideHeader && <GroupHeader>{t("inspector.groupBackingTrack")}</GroupHeader>}
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
