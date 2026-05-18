import { startTransition, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES, LENS_REGISTRY } from "@fretflow/core";
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  chordOverlayHiddenAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
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

// Subset of chord types that have full-chord shape data on the fretboard.
// Used to gate the Full Chord overlay toggle in the UI.
const FULL_CHORD_SUPPORTED_TYPES = new Set([
  "Major Triad",
  "Minor Triad",
  "Dominant 7th",
]);

export function ChordOverlayControls() {
  const { t } = useTranslation();
  const { scaleName, useFlats } = useScaleState();
  const {
    chordType,
    currentTuning,
    fullChordsEnabled,
    setFullChordsEnabled,
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
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);
  const [voicingType, setVoicingType] = useAtom(voicingTypeAtom);
  const [voicingInversion, setVoicingInversion] = useAtom(voicingInversionAtom);
  const [voicingStringSet, setVoicingStringSet] = useAtom(voicingStringSetAtom);
  const availableInversions = useAtomValue(availableInversionsAtom);

  const lensAvailability = useAtomValue(lensAvailabilityAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isPatternDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";
  const fullChordsSupported =
    chordType != null &&
    FULL_CHORD_SUPPORTED_TYPES.has(chordType) &&
    currentTuning.length === 6;

  const hasQualityOverride = chordQualityOverride != null;
  const degreeSelectOptions = buildDegreeToggleOptions({
    scaleName,
    qualityOverridden: hasQualityOverride,
    activeDegree: chordDegree,
    includeOffSentinel: false,
  });

  // Hide tension lens when unavailable and not currently active.
  const lensOptions = lensAvailability.flatMap((entry) => {
    const { id } = entry;
    const isActive = id === practiceLens;
    const available = entry.available;
    const reason = entry.reason ?? undefined;

    if (!available && !isActive && entry?.hideWhenUnavailable) return [];

    return [
      {
        value: id,
        label: entry?.label ?? id,
        disabled: !isActive && !available,
        title: !isActive && reason ? reason : undefined,
        description: !isActive && reason ? reason : undefined,
      },
    ];
  });

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);
  const activeLensDescription =
    LENS_REGISTRY.find((l) => l.id === practiceLens)?.description ?? undefined;

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

  const fullChordsHint = fullChordsSupported
    ? t("inspector.fullChordsHintSupported")
    : currentTuning.length !== 6
      ? t("inspector.fullChordsHintNon6String")
      : t("inspector.fullChordsHintUnsupportedType");

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
      <PropGrid columns={6} className={panelStyles.grid}>
        {/* ── SOURCE ───────────────────────────────────────────────────── */}
        <GroupHeader>{t("inspector.groupSource")}</GroupHeader>
        <Prop
          label={t("controls.chordMode")}
          span={3}
          hint={
            isPatternDisabled
              ? undefined
              : chordOverlayMode === "degree"
                ? t("controls.degreeModeHint")
                : chordOverlayMode === "manual"
                  ? t("controls.manualModeHint")
                  : undefined
          }
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
        {showDisplay && (
          <Prop label={t("controls.lens")} span={3} hint={hasActiveChord ? activeLensDescription : undefined}>
            <ToggleBar
              options={lensOptions.map((o) => ({ ...o, disabled: displayDisabled || o.disabled }))}
              value={practiceLens}
              onChange={displayDisabled ? () => undefined : setPracticeLens}
              label="Practice lens"
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={6}>
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

        {/* ── CHORD TYPE ───────────────────────────────────────────────── */}
        {showChordTypeGrid && (
          <>
            <GroupHeader>{t("inspector.groupChordType")}</GroupHeader>
            <Prop
              label={t("controls.chordType")}
              span={6}
              hint={
                chordOverlayMode === "degree"
                  ? hasQualityOverride
                    ? t("controls.customChordHint")
                    : t("controls.diatonicDefaultHint")
                  : undefined
              }
            >
              <ChordTypeGrid
                label="Chord Type"
                options={buildQualityToggleOptions({ includeSentinel: false })}
                value={
                  chordOverlayMode === "degree"
                    ? chordType ?? ""
                    : chordQualityOverride ?? ""
                }
                onChange={handleChordTypeChange}
              />
            </Prop>
          </>
        )}

        {/* ── VOICING ──────────────────────────────────────────────────── */}
        {showDisplay && (
          <>
            <GroupHeader>{t("inspector.groupVoicing")}</GroupHeader>
            <Prop label={t("inspector.voicingType")} span={3}>
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
            <Prop label={t("inspector.voicingInversion")} span={3}>
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
            <Prop label={t("inspector.voicingStringSet")} span={6}>
              <StringSetPicker value={voicingStringSet} onChange={setVoicingStringSet} />
            </Prop>
            <Prop label={t("inspector.fullChords")} span={3} hint={hasActiveChord ? fullChordsHint : undefined}>
              <Switch
                label={t("inspector.fullChords")}
                checked={fullChordsEnabled}
                onChange={setFullChordsEnabled}
                disabled={displayDisabled || !fullChordsSupported}
              />
            </Prop>
            <Prop label={t("inspector.showOnBoard")} span={3}>
              <Switch
                label={t("inspector.showOnBoard")}
                checked={!chordOverlayHidden}
                onChange={(next) => setChordOverlayHidden(!next)}
                disabled={displayDisabled}
              />
            </Prop>
          </>
        )}
      </PropGrid>
    </div>
  );
}
