import { startTransition, useEffect, useMemo, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type PracticeLens, type DegreeId } from "@fretflow/core";
import { voicingTypeAtom, voicingInversionAtom, voicingStringSetAtom, voicingConnectorsAtom, availableInversionsAtom, stringSetOptionsAtom, practiceLensAtom, chordRootAtom, chordTypeAtom, chordOverlayHiddenAtom, regionAtom, type Region } from "../../store/chordOverlayAtoms";
import { activePositionAtom, voicingSectionExpandedAtom } from "../../store/chordScope";
import { lensAvailabilityAtom } from "../../store/practiceLensAtoms";
import { validVoicingCombosAtom, controlRecencyAtom, noteControlChangeAtom, nearestValidTriple } from "../../store/voicingCoupling";
import type { VoicingControlId } from "../../store/voicingCoupling";
import {
  activeChordCachedDegreeAtom,
  activeChordIsManualAtom,
  activeChordQualityAtom,
  activeChordRootAtom,
  updateActiveChordAtom,
} from "../../store/songStateAtoms";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import type { StringSetOption } from "../../store/voicingStringSets";
import { useTranslation } from "../../hooks/useTranslation";
import { RootNoteSelect } from "../shared/RootNoteSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Switch } from "../Switch/Switch";
import { PropGrid, Prop, GroupHeader } from "../Inspector/InspectorGrid";
import { DegreeSelect } from "../shared/DegreeSelect";
import { ChordQualitySelect } from "../shared/ChordQualitySelect";
import { useScaleState } from "../../hooks/useScaleState";
import panelStyles from "./ChordOverlayControls.module.css";

/** Compact lens labels for the narrow Source-row Lens toggle. The `satisfies`
 * clause makes a new lens added to `LENS_REGISTRY` without a label fail to compile. */
const LENS_SHORT_LABELS = {
  tones: "Tones",
  lead: "Lead",
} satisfies Partial<Record<PracticeLens, string>>;

export function ChordOverlayControls() {
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

  // Read the resolved chord identity used by the rest of the panel (voicing
  // engine, lens availability). These still flow through the legacy
  // `chord*Atom` selectors which already prefer the active progression step.
  const chordRoot = useAtomValue(chordRootAtom);
  const chordType = useAtomValue(chordTypeAtom);

  const [practiceLens, setPracticeLens] = useAtom(practiceLensAtom);
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
  const [region, setRegion] = useAtom(regionAtom);
  const activePosition = useAtomValue(activePositionAtom);
  const [voicingExpanded, setVoicingExpanded] = useAtom(voicingSectionExpandedAtom);
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);

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

  /** Display label combines the localized window name with the id suffix in
   * parens — e.g. `Bass (4·5·6)`, `All (6 strings)`. */
  const stringSetSelectOptions = useMemo(
    () =>
      decoratedStringSetOptions.map((option: StringSetOption) => {
        const head = t(option.labelKey);
        const sub =
          option.id === "all" ? t("inspector.stringSetAllSub") : option.id;
        return {
          value: option.id,
          label: `${head} (${sub})`,
          disabled: option.disabled,
        };
      }),
    [decoratedStringSetOptions, t],
  );

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
      <div className={panelStyles.layerVisibilityRow}>
        <Switch
          label={t("inspector.chordLayer")}
          checked={!chordOverlayHidden}
          onChange={(next) => setChordOverlayHidden(!next)}
        />
        <span aria-hidden="true">{t("inspector.chordLayer")}</span>
      </div>
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
          <button
            type="button"
            className={panelStyles.voicingDisclosure}
            aria-expanded={voicingExpanded}
            aria-controls="voicing-section"
            onClick={() => setVoicingExpanded((v) => !v)}
          >
            <span
              aria-hidden="true"
              className={panelStyles.voicingChevron}
              data-open={voicingExpanded || undefined}
            >
              ▸
            </span>
            {t("inspector.voicingSection")}
          </button>
        </GroupHeader>
        {voicingExpanded && (
          <>
            <Prop
              label={t("inspector.voicingType")}
              span={3}
              hint={t("inspector.voicingTypeHint")}
            >
              <ToggleBar
                label={t("inspector.voicingTypeAriaLabel")}
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
                  label={t("inspector.voicingInversionAriaLabel")}
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
                <LabeledSelect
                  label={t("inspector.voicingStringSet")}
                  hideLabel
                  value={voicingStringSet}
                  options={stringSetSelectOptions}
                  onChange={(v) => {
                    recordControlChange("stringSet");
                    setVoicingStringSet(v);
                  }}
                />
              </Prop>
            )}
            <Prop
              label={t("controls.region")}
              span={7}
              hint={
                activePosition
                  ? t("controls.regionHint")
                  : t("controls.regionHintNeedsPosition")
              }
            >
              <ToggleBar
                label={t("controls.regionAriaLabel")}
                options={(["position", "+2", "+4", "all"] as const).map((v) => ({
                  value: v,
                  label:
                    v === "position"
                      ? t("controls.regionPosition")
                      : v === "all"
                        ? t("controls.regionAll")
                        : v,
                  disabled: v !== "all" && !activePosition,
                }))}
                value={region}
                onChange={(v: Region) => setRegion(v)}
              />
            </Prop>
          </>
        )}
      </PropGrid>
    </div>
  );
}
