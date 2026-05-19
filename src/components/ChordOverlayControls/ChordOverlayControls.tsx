import { startTransition, useEffect, useMemo, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { type PracticeLens } from "@fretflow/core";
import {
  lensAvailabilityAtom,
  fingeringPatternAtom,
  voicingTypeAtom,
  voicingInversionAtom,
  voicingStringSetAtom,
  voicingConnectorsAtom,
  availableInversionsAtom,
  stringSetOptionsAtom,
  validVoicingCombosAtom,
  controlRecencyAtom,
  noteControlChangeAtom,
  nearestValidTriple,
  type VoicingControlId,
} from "../../store/atoms";
import { StringSetPicker } from "../Inspector/StringSetPicker";
import { useTranslation } from "../../hooks/useTranslation";
import { RootNoteSelect } from "../shared/RootNoteSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { DegreeSelect } from "../shared/DegreeSelect";
import { ChordQualitySelect } from "../shared/ChordQualitySelect";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import panelStyles from "./ChordOverlayControls.module.css";
import shared from "../shared/shared.module.css";

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
    chordRoot,
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
  const stringSetOptions = useAtomValue(stringSetOptionsAtom);
  const validCombos = useAtomValue(validVoicingCombosAtom);
  const recency = useAtomValue(controlRecencyAtom);
  const recordControlChange = useSetAtom(noteControlChangeAtom);

  const lensAvailability = useAtomValue(lensAvailabilityAtom);
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isPatternDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";

  const hasQualityOverride = chordQualityOverride != null;

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

  // Unified auto-heal: whenever the active (type, inversion, stringSet) is
  // not a valid triple, pin the most-recently-touched control and snap the
  // other two to the nearest valid assignment.
  //
  // Spec §5c point 2: on a chord change (no control was "just changed"),
  // override the live recency for this run only — pin `type` and let
  // inversion + string set heal. The user's actual recency is unchanged so
  // the next user-driven heal still respects it.
  const prevChordRef = useRef<{ root: string; type: string | null } | null>(null);
  useEffect(() => {
    if (voicingType === "caged") {
      prevChordRef.current = { root: chordRoot, type: chordType };
      return; // caged is force-resolved upstream.
    }
    const chord = { root: chordRoot, type: chordType };
    const chordChanged =
      prevChordRef.current !== null &&
      (prevChordRef.current.root !== chord.root ||
        prevChordRef.current.type !== chord.type);
    prevChordRef.current = chord;

    const current = {
      type: voicingType,
      inversion: voicingInversion,
      stringSet: voicingStringSet,
    };
    const isValid = validCombos.triples.some(
      (t) =>
        t.type === current.type &&
        t.inversion === current.inversion &&
        t.stringSet === current.stringSet,
    );
    if (isValid) return;

    const effectiveRecency: readonly VoicingControlId[] = chordChanged
      ? ["type", "stringSet", "inversion"]
      : recency;
    const next = nearestValidTriple(validCombos.triples, current, effectiveRecency);
    if (next.type !== current.type) setVoicingType(next.type);
    if (next.inversion !== current.inversion) setVoicingInversion(next.inversion);
    if (next.stringSet !== current.stringSet) setVoicingStringSet(next.stringSet);
  }, [
    chordRoot,
    chordType,
    voicingType,
    voicingInversion,
    voicingStringSet,
    validCombos,
    recency,
    setVoicingType,
    setVoicingInversion,
    setVoicingStringSet,
  ]);

  const decoratedStringSetOptions = useMemo(
    () =>
      stringSetOptions.map((o) => ({
        ...o,
        disabled: !validCombos.enabledStringSets.has(o.id),
      })),
    [stringSetOptions, validCombos],
  );

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
            <DegreeSelect
              scaleName={scaleName}
              value={chordDegree ?? ""}
              onChange={handleDegreeChange}
              label="Chord degree"
              activeDegree={chordDegree}
              qualityOverridden={hasQualityOverride}
            />
          </Prop>
        )}
        {showRoot && (
          <Prop label={t("controls.root")} span={3}>
            <RootNoteSelect
              value={chordRootOverride}
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
              <ChordQualitySelect
                label="Chord Type"
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
                options={(["caged", "drop2", "triad"] as const).map((v) => ({
                  value: v,
                  label:
                    v === "caged"
                      ? t("inspector.voicingTypeCaged")
                      : v === "drop2"
                        ? t("inspector.voicingTypeDrop2")
                        : t("inspector.voicingTypeTriad"),
                  disabled: v !== "caged" && !validCombos.enabledTypes.has(v),
                }))}
                value={voicingType}
                onChange={(v) => {
                  recordControlChange("type");
                  setVoicingType(v);
                }}
              />
            </Prop>
            {voicingType !== "caged" && (
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
                    disabled:
                      !availableInversions.includes(v) ||
                      !validCombos.enabledInversions.has(v),
                  }))}
                  value={voicingInversion}
                  onChange={(v) => {
                    recordControlChange("inversion");
                    setVoicingInversion(v);
                  }}
                />
              </Prop>
            )}
            {voicingType !== "caged" && (
              <Prop
                label={t("inspector.voicingStringSet")}
                span={7}
                hint={t("inspector.voicingStringSetHint")}
              >
                <StringSetPicker
                  options={decoratedStringSetOptions}
                  value={voicingStringSet}
                  onChange={(v) => {
                    recordControlChange("stringSet");
                    setVoicingStringSet(v);
                  }}
                />
              </Prop>
            )}
          </>
        )}
      </PropGrid>
    </div>
  );
}
