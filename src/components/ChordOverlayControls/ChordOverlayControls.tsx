import { useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type PracticeLens } from "@fretflow/core";
import {
  practiceLensAtom,
  chordTypeAtom,
  voicingAtom,
  closePositionIndexAtom,
} from "../../store/chordOverlayAtoms";
import { lensAvailabilityAtom } from "../../store/practiceLensAtoms";
import {
  cagedShapesAtom,
  fingeringPatternAtom,
  npsPositionAtom,
} from "../../store/fingeringAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { PropGrid, Prop } from "../Inspector/InspectorGrid";
import { VoicingControl } from "./VoicingControl";
import { ClosePositionCycle } from "./ClosePositionCycle";
import panelStyles from "./ChordOverlayControls.module.css";

/** Compact lens labels for the narrow Voicing-row Lens toggle. The `satisfies`
 * clause makes a new lens added to `LENS_REGISTRY` without a label fail to compile. */
const LENS_SHORT_LABELS = {
  tones: "Tones",
  lead: "Lead",
} satisfies Partial<Record<PracticeLens, string>>;

/**
 * Resets `closePositionIndexAtom` to 0 whenever the active scale-shape window
 * changes. The window is identified by a fingerprint of `(fingeringPattern,
 * cagedShapes, npsPosition)`. On first mount no reset fires — the persisted
 * index is honoured.
 */
function useResetClosePositionOnShapeChange() {
  const pattern = useAtomValue(fingeringPatternAtom);
  const shapes = useAtomValue(cagedShapesAtom);
  const npsPos = useAtomValue(npsPositionAtom);
  const setIndex = useSetAtom(closePositionIndexAtom);

  const prevRef = useRef<string>("");
  useEffect(() => {
    const fingerprint = `${pattern}|${[...shapes].sort().join(",")}|${npsPos}`;
    if (prevRef.current !== "" && prevRef.current !== fingerprint) {
      setIndex(0);
    }
    prevRef.current = fingerprint;
  }, [pattern, shapes, npsPos, setIndex]);
}

export function ChordOverlayControls() {
  useResetClosePositionOnShapeChange();
  const { t } = useTranslation();

  // Read the resolved chord identity used by the panel (lens availability).
  const chordType = useAtomValue(chordTypeAtom);

  const [practiceLens, setPracticeLens] = useAtom(practiceLensAtom);
  const voicing = useAtomValue(voicingAtom);
  const lensAvailability = useAtomValue(lensAvailabilityAtom);

  // All lenses are always shown; an unavailable lens renders disabled.
  const lensOptions = lensAvailability.map((entry) => {
    const { id } = entry;
    const isActive = id === practiceLens;
    const reason = entry.reason ?? undefined;
    return {
      value: id,
      label: LENS_SHORT_LABELS[id] ?? entry.label,
      disabled: !isActive && !entry.available,
      title: !isActive && reason ? reason : undefined,
      description: !isActive && reason ? reason : undefined,
    };
  });

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);

  // Auto-exit unavailable lenses (except "tones").
  useEffect(() => {
    if (
      currentLensEntry &&
      !currentLensEntry.available &&
      currentLensEntry.id !== "tones"
    ) {
      const tAvailable = lensAvailability.find((l) => l.id === "tones")?.available;
      if (tAvailable) {
        setPracticeLens("tones");
      }
    }
  }, [currentLensEntry, lensAvailability, setPracticeLens]);

  const hasActiveChord = Boolean(chordType);
  const displayDisabled = !hasActiveChord;

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={7} className={panelStyles.grid}>
        {/* ── VOICING ──────────────────────────────────────────────────── */}
        <Prop span={3}>
          <VoicingControl />
        </Prop>
        <Prop label={t("controls.lens")} span={2} hint={t("controls.lensHint")}>
          <ToggleBar
            options={lensOptions.map((o) => ({
              ...o,
              disabled: displayDisabled || o.disabled,
            }))}
            value={practiceLens}
            onChange={displayDisabled ? () => undefined : setPracticeLens}
            label={t("controls.lensAriaLabel")}
          />
        </Prop>
        {voicing === "close" && (
          <Prop label={t("inspector.closeCyclePositionLabel")} span={2}>
            <ClosePositionCycle />
          </Prop>
        )}
      </PropGrid>
    </div>
  );
}
