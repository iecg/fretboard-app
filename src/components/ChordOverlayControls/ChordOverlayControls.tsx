import { startTransition, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, type PracticeLens } from "@fretflow/core";
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
  voicingConnectorsAtom,
  availableInversionsAtom,
} from "../../store/atoms";
import { StringSetPicker } from "../Inspector/StringSetPicker";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { ChordTypeGrid } from "../Inspector/ChordTypeGrid";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import panelStyles from "./ChordOverlayControls.module.css";
import shared from "../shared/shared.module.css";
import {
  buildDegreeToggleOptions,
  buildQualityToggleOptions,
} from "../shared/chordControlOptions";

/** Compact lens labels for the narrow Source-row Lens toggle. The `satisfies`
 * clause makes a new lens added to `LENS_REGISTRY` without a label fail to compile. */
const LENS_SHORT_LABELS = {
  targets: "Chord",
  "guide-tones": "Guide",
  tension: "Tension",
} satisfies Partial<Record<PracticeLens, string>>;

export function ChordOverlayControls() {
  const { t } = useTranslation();
  const { scaleName, useFlats } = useScaleState();
  const {
    chordType,
    practiceLens,
    setPracticeLens,
    chordDegree,
    setChordDegree,
    chordOverlayMode,
    setChordOverlayMode,
    chordRootOverride,
    setChordRootOverride,
    chordQualityOverride,
    setChordQualityOverride,
  } = useChordState();
  const [voicingType, setVoicingType] = useAtom(voicingTypeAtom);
  const [voicingInversion, setVoicingInversion] = useAtom(voicingInversionAtom);
  const [voicingStringSet, setVoicingStringSet] = useAtom(voicingStringSetAtom);
  const [voicingConnectors, setVoicingConnectors] = useAtom(voicingConnectorsAtom);
  const availableInversions = useAtomValue(availableInversionsAtom);

  const lensAvailability = useAtomValue(lensAvailabilityAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isPatternDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";

  const hasQualityOverride = chordQualityOverride != null;
  const degreeSelectOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: hasQualityOverride,
    activeDegree: chordDegree,
    includeOffSentinel: false,
  });

  // All three lenses are always shown; an unavailable lens renders disabled.
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

  // Auto-exit unavailable lenses (except "targets").
  useEffect(() => {
    if (
      currentLensEntry &&
      !currentLensEntry.available &&
      currentLensEntry.id !== "targets"
    ) {
      const tAvailable = lensAvailability.find((l) => l.id === "targets")?.available;
      if (tAvailable) {
        setPracticeLens("targets");
      }
    }
  }, [currentLensEntry, lensAvailability, setPracticeLens]);

  // Normalize a persisted voicing inversion the active chord no longer offers
  // (e.g. a 7th-chord "3rd" inversion after switching to a triad).
  useEffect(() => {
    if (!availableInversions.includes(voicingInversion)) {
      setVoicingInversion(availableInversions[0] ?? "root");
    }
  }, [availableInversions, voicingInversion, setVoicingInversion]);

  const handleDegreeChange = (value: string) => {
    startTransition(() => {
      setChordDegree(value);
    });
  };

  const handleChordTypeChange = (value: string) => {
    startTransition(() => {
      setChordQualityOverride(value);
    });
  };

  // ── Visibility ────────────────────────────────────────────────────────
  const isOff = chordOverlayMode === "off";
  const showDegree = !isPatternDisabled && chordOverlayMode === "degree";
  const showChordTypeGrid =
    !isPatternDisabled &&
    (chordOverlayMode === "manual" ||
      (chordOverlayMode === "degree" && Boolean(chordDegree)));
  const showRoot = !isPatternDisabled && chordOverlayMode === "manual";
  const hasActiveChord = Boolean(chordType);
  const showDisplay = !isPatternDisabled && !isOff;
  const displayDisabled = !hasActiveChord;

  return (
    <div
      className={clsx(panelStyles.root, isPatternDisabled && panelStyles["panel-disabled"])}
      data-disabled={isPatternDisabled ? "true" : undefined}
    >
      {isPatternDisabled && (
        <p className={shared["field-hint"]} aria-live="polite">
          {t("controls.chordOverlayDisabled")}
        </p>
      )}
      <PropGrid columns={7} className={panelStyles.grid}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop
          label={t("controls.mode")}
          span={2}
          hint={isPatternDisabled ? undefined : t("controls.modeHint")}
        >
          <ToggleBar
            options={[
              {
                value: "off",
                label: isPatternDisabled
                  ? t("controls.disabled")
                  : t("controls.off"),
                disabled: isPatternDisabled,
              },
              {
                value: "degree",
                label: t("controls.degree"),
                disabled: isPatternDisabled,
              },
              {
                value: "manual",
                label: t("controls.manual"),
                disabled: isPatternDisabled,
              },
            ]}
            value={chordOverlayMode}
            onChange={isPatternDisabled ? () => undefined : setChordOverlayMode}
            label="Chord overlay mode"
          />
        </Prop>
        {showDegree && (
          <Prop label={t("controls.degree")} span={3}>
            <ToggleBar
              options={degreeSelectOptions}
              value={chordDegree ?? ""}
              onChange={handleDegreeChange}
              label="Chord degree"
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={3}>
            <NoteGrid
              notes={NOTES}
              selected={chordRootOverride}
              onSelect={(note) => {
                startTransition(() => {
                  setChordRootOverride(note);
                });
              }}
              useFlats={useFlats}
            />
          </Prop>
        )}
        {showDisplay && (
          <Prop label={t("controls.lens")} span={2} hint={t("controls.lensHint")}>
            <ToggleBar
              options={lensOptions.map((o) => ({
                ...o,
                disabled: displayDisabled || o.disabled,
              }))}
              value={practiceLens}
              onChange={displayDisabled ? () => undefined : setPracticeLens}
              label="Practice lens"
            />
          </Prop>
        )}

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        {showChordTypeGrid && (
          <>
            <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
            <Prop
              label={t("controls.quality")}
              span={7}
              hint={
                chordOverlayMode === "degree"
                  ? hasQualityOverride
                    ? t("controls.customChordHint")
                    : t("controls.diatonicDefaultHint")
                  : t("controls.manualQualityHint")
              }
            >
              <ChordTypeGrid
                label="Chord Type"
                options={buildQualityToggleOptions({ includeSentinel: false })}
                value={chordType ?? ""}
                onChange={handleChordTypeChange}
              />
            </Prop>
          </>
        )}

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        {showDisplay && (
          <>
            <GroupHeader
              right={
                <span className={panelStyles.connectorsToggle}>
                  <span className={panelStyles.connectorsToggleLabel}>
                    {t("controls.connectors")}
                  </span>
                  <Switch
                    label={t("controls.connectors")}
                    checked={voicingConnectors}
                    onChange={setVoicingConnectors}
                    disabled={displayDisabled}
                  />
                </span>
              }
            >
              {t("inspector.groupVoicing")}
            </GroupHeader>
            <Prop
              label={t("inspector.voicingType")}
              span={3}
              hint={t("inspector.voicingTypeHint")}
            >
              <ToggleBar
                label="Voicing type"
                options={[
                  { value: "caged" as const, label: t("inspector.voicingTypeCaged") },
                  { value: "drop2" as const, label: t("inspector.voicingTypeDrop2") },
                  { value: "triad" as const, label: t("inspector.voicingTypeTriad") },
                ]}
                value={voicingType}
                onChange={setVoicingType}
              />
            </Prop>
            <Prop
              label={t("inspector.voicingInversion")}
              span={4}
              hint={t("inspector.voicingInversionHint")}
            >
              <ToggleBar
                label="Voicing inversion"
                options={(["root", "1st", "2nd", "3rd"] as const).map((v) => ({
                  value: v,
                  label: v === "root" ? t("controls.root") : v,
                  disabled: !availableInversions.includes(v),
                }))}
                value={voicingInversion}
                onChange={setVoicingInversion}
              />
            </Prop>
            <Prop
              label={t("inspector.voicingStringSet")}
              span={7}
              hint={t("inspector.voicingStringSetHint")}
            >
              <StringSetPicker value={voicingStringSet} onChange={setVoicingStringSet} />
            </Prop>
          </>
        )}
      </PropGrid>
    </div>
  );
}
