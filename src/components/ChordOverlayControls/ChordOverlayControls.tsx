import { startTransition, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type PracticeLens, type DegreeId } from "@fretflow/core";
import {
  practiceLensAtom,
  chordRootAtom,
  chordTypeAtom,
  voicingAtom,
  closePositionIndexAtom,
} from "../../store/chordOverlayAtoms";
import { lensAvailabilityAtom } from "../../store/practiceLensAtoms";
import {
  activeChordCachedDegreeAtom,
  activeChordIsManualAtom,
  activeChordQualityAtom,
  activeChordRootAtom,
  updateActiveChordAtom,
} from "../../store/songStateAtoms";
import {
  cagedShapesAtom,
  fingeringPatternAtom,
  npsPositionAtom,
} from "../../store/fingeringAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { RootNoteSelect } from "../shared/RootNoteSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { DegreeSelect } from "../shared/DegreeSelect";
import { ChordQualitySelect } from "../shared/ChordQualitySelect";
import { useScaleState } from "../../hooks/useScaleState";
import { VoicingControl } from "./VoicingControl";
import { ClosePositionCycle } from "./ClosePositionCycle";
import panelStyles from "./ChordOverlayControls.module.css";

/** Compact lens labels for the narrow Source-row Lens toggle. The `satisfies`
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
  const { scaleName, useFlats } = useScaleState();

  // Phase 2.4 — unified active-chord write surface. The Mode toggle is gone;
  // Degree + Manual root + Quality controls are always rendered side-by-side
  // and write through `updateActiveChordAtom`.
  const activeRoot = useAtomValue(activeChordRootAtom);
  const activeQuality = useAtomValue(activeChordQualityAtom);
  const activeDegree = useAtomValue(activeChordCachedDegreeAtom);
  const activeIsManual = useAtomValue(activeChordIsManualAtom);
  const updateActiveChord = useSetAtom(updateActiveChordAtom);

  // Read the resolved chord identity used by the rest of the panel (lens
  // availability). These still flow through the legacy `chord*Atom` selectors
  // which already prefer the active progression step.
  const chordRoot = useAtomValue(chordRootAtom);
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

  // Phase 2.4 — picking a degree always re-binds to the diatonic chord:
  // clear any manualRoot and qualityOverride so the user lands on the
  // in-key default. The user can then layer a quality override on top
  // without losing the degree binding.
  const handleDegreeChange = (value: string) => {
    startTransition(() => {
      updateActiveChord({
        degree: value as DegreeId,
        root: null,
        quality: null,
      });
    });
  };

  const handleRootChange = (note: string) => {
    startTransition(() => {
      updateActiveChord({ root: note });
    });
  };

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      updateActiveChord({ quality: value });
    });
  };

  const hasActiveChord = Boolean(chordType);
  const displayDisabled = !hasActiveChord;

  // Display root for the manual-root NoteGrid. Falls back to the resolved
  // root when no manual override is set so the grid still shows a sensible
  // selection (the diatonic root) without forcing the chord into manual mode.
  const rootGridValue = activeRoot ?? chordRoot;

  return (
    <div className={panelStyles.root}>
      <PropGrid columns={7} className={panelStyles.grid}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop label={t("controls.degree")} span={3}>
          <DegreeSelect
            scaleName={scaleName}
            value={activeDegree ?? ""}
            onChange={handleDegreeChange}
            label={t("controls.degreeAriaLabel")}
            activeDegree={activeDegree}
            qualityOverridden={false}
          />
        </Prop>
        <Prop
          label={t("controls.root")}
          span={4}
          hint={activeIsManual ? t("controls.customChordHint") : undefined}
        >
          <RootNoteSelect
            value={rootGridValue}
            onSelect={handleRootChange}
            useFlats={useFlats}
          />
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

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
        <Prop
          label={t("controls.quality")}
          span={7}
          hint={t("controls.manualQualityHint")}
        >
          <ChordQualitySelect
            label={t("controls.qualityAriaLabel")}
            value={activeQuality ?? chordType ?? ""}
            onChange={handleChordTypeChange}
          />
        </Prop>

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupVoicing")}</GroupHeader>
        <Prop label={t("inspector.voicingAriaLabel")} span={3}>
          <VoicingControl />
        </Prop>
        {voicing === "close" && (
          <Prop label={t("inspector.closeCycleAriaLabel")} span={4}>
            <ClosePositionCycle />
          </Prop>
        )}
      </PropGrid>
    </div>
  );
}
