import { startTransition } from "react";
import { NOTES } from "@fretflow/core";
import {
  getActiveScaleBrowseOption,
  getAdjacentScaleBrowseOption,
  getEffectiveScaleBrowseMode,
  getScaleBrowseOptions,
  getScaleFamilyOptions,
  getScaleMemberTerm,
  getScaleNameForFamilySelector,
  resolveScaleCatalogEntry,
  supportsRelativeScaleBrowsing,
  type ScaleBrowseMode,
} from "@fretflow/core";
import { useTranslation } from "../../hooks/useTranslation";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { StepperSelect } from "../StepperSelect/StepperSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { Prop } from "../Inspector/InspectorGrid";
import { useScaleState } from "../../hooks/useScaleState";

/**
 * Key picker for the Scale tab's first column. Emits a fragment of `Prop`
 * cells (Root / Scale Family / Variant / Relationship) so it composes into the
 * Scale tab's column layout. All state is held in existing atoms via
 * `useScaleState`.
 */
export function ScaleSelector() {
  const { t } = useTranslation();
  const {
    rootNote,
    setRootNote,
    scaleName,
    setScaleName,
    scaleBrowseMode,
    setScaleBrowseMode,
    useFlats,
  } = useScaleState();

  const scaleEntry = resolveScaleCatalogEntry(scaleName);
  const familyOptions = getScaleFamilyOptions();
  const currentFamily = scaleEntry.family;
  const memberTerm = getScaleMemberTerm(scaleEntry.member.scaleName);
  const supportsRelativeBrowse = supportsRelativeScaleBrowsing(
    scaleEntry.member.scaleName,
  );
  const effectiveBrowseMode = getEffectiveScaleBrowseMode(
    scaleEntry.member.scaleName,
    scaleBrowseMode,
  );
  const browseOptions = getScaleBrowseOptions(
    rootNote,
    scaleEntry.member.scaleName,
    effectiveBrowseMode,
    useFlats,
  );
  const activeBrowseOption = getActiveScaleBrowseOption(
    rootNote,
    scaleEntry.member.scaleName,
    effectiveBrowseMode,
    useFlats,
  );

  const familySelectOptions = familyOptions.map((option) => ({
    value: option,
    label: option,
  }));

  const browseSelectOptions = browseOptions.map((option) => ({
    value: option.label,
    label: option.label,
  }));

  const applyRootNote = (note: string) => {
    startTransition(() => {
      setRootNote(note);
    });
  };

  const applyTheorySelection = (nextRootNote: string, nextScaleName: string) => {
    startTransition(() => {
      setRootNote(nextRootNote);
      setScaleName(nextScaleName);
    });
  };

  const handleFamilySelect = (selectorLabel: string) => {
    if (selectorLabel === currentFamily.selectorLabel) return;
    startTransition(() => {
      setScaleName(getScaleNameForFamilySelector(selectorLabel));
    });
  };

  const handleStepFamily = (direction: -1 | 1) => {
    const currentIndex = familyOptions.indexOf(currentFamily.selectorLabel);
    const nextIndex =
      (currentIndex + direction + familyOptions.length) % familyOptions.length;
    handleFamilySelect(familyOptions[nextIndex]);
  };

  const handleBrowseSelect = (selectedLabel: string) => {
    const selectedOption = browseOptions.find(
      (option) => option.label === selectedLabel,
    );
    if (!selectedOption) return;
    if (selectedOption.label === activeBrowseOption.label) {
      return;
    }
    applyTheorySelection(selectedOption.rootNote, selectedOption.scaleName);
  };

  const handleStepBrowse = (direction: -1 | 1) => {
    const nextOption = getAdjacentScaleBrowseOption(
      rootNote,
      scaleEntry.member.scaleName,
      effectiveBrowseMode,
      direction,
      useFlats,
    );
    applyTheorySelection(nextOption.rootNote, nextOption.scaleName);
  };

  return (
    <>
      <Prop label="Root">
        <NoteGrid
          notes={NOTES}
          selected={rootNote}
          onSelect={applyRootNote}
          useFlats={useFlats}
        />
      </Prop>

      <Prop label="Scale Family">
        <StepperSelect
          selectLabel="Scale Family"
          groupLabel="Browse scale families"
          previousLabel="Previous scale family"
          nextLabel="Next scale family"
          value={currentFamily.selectorLabel}
          options={familySelectOptions}
          onChange={handleFamilySelect}
          onPrevious={() => handleStepFamily(-1)}
          onNext={() => handleStepFamily(1)}
        />
      </Prop>

      <Prop label={memberTerm}>
        <StepperSelect
          selectLabel={memberTerm}
          groupLabel={`Browse ${memberTerm}`}
          previousLabel={`Previous ${memberTerm}`}
          nextLabel={`Next ${memberTerm}`}
          value={activeBrowseOption.label}
          options={browseSelectOptions}
          onChange={handleBrowseSelect}
          onPrevious={() => handleStepBrowse(-1)}
          onNext={() => handleStepBrowse(1)}
        />
      </Prop>

      {supportsRelativeBrowse ? (
        <Prop
          label={t("inspector.relationship")}
          hint={
            effectiveBrowseMode === "parallel"
              ? t("controls.scaleParallelHint")
              : t("controls.scaleRelativeHint")
          }
        >
          <ToggleBar
            options={[
              { value: "parallel", label: "Parallel" },
              { value: "relative", label: "Relative" },
            ]}
            value={effectiveBrowseMode}
            onChange={(value) => setScaleBrowseMode(value as ScaleBrowseMode)}
            label="Scale relationship"
          />
        </Prop>
      ) : null}
    </>
  );
}
