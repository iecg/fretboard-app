import { useAtom } from "jotai";
import type { VoicingType } from "@fretflow/core";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { voicingAtom } from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";

/**
 * The single Voicing dropdown for the Chord tab. Replaces the v1.x trio of
 * Type / Inversion / String-Set controls with three semantic options:
 *
 *  - Off   — no connector polygons; only loose chord-tone highlights.
 *  - Full  — CAGED full-chord polygons (one per shape; gated to the active
 *            scale shape when one is selected).
 *  - Close — compact 3–5 string polygon at the active cycle index, scoped to
 *            the active scale-shape window when one is selected.
 *
 * The dropdown reuses {@link LabeledSelect} (Radix combobox) so it shares the
 * faceplate/typography of other inspector selects. The label is visually
 * hidden — the surrounding `Prop` cell provides the visible micro-label.
 */
export function VoicingControl() {
  const { t } = useTranslation();
  const [voicing, setVoicing] = useAtom(voicingAtom);

  const options: ReadonlyArray<{ value: VoicingType; label: string }> = [
    { value: "off", label: t("inspector.voicingOff") },
    { value: "full", label: t("inspector.voicingFull") },
    { value: "close", label: t("inspector.voicingClose") },
  ];

  return (
    <LabeledSelect
      label={t("inspector.voicingAriaLabel")}
      hideLabel
      width="fill"
      value={voicing}
      options={options as Array<{ value: string; label: string }>}
      onChange={(v) => setVoicing(v as VoicingType)}
    />
  );
}
