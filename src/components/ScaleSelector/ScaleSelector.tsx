import { startTransition } from "react";
import { NOTES } from "../../core/theory";
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
} from "../../core/theoryCatalog";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { StepperSelect } from "../StepperSelect/StepperSelect";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useScaleState } from "../../hooks/useScaleState";
import shared from "../shared/shared.module.css";
import styles from "../TheoryControls/TheoryControls.module.css";

export function ScaleSelector() {
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
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Root</span>
        <NoteGrid
          notes={NOTES}
          selected={rootNote}
          onSelect={applyRootNote}
          useFlats={useFlats}
        />
      </div>

      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Scale Family</span>
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
      </div>

      <div className={shared["control-section"]}>
        <div className={styles["theory-mode-browser"]}>
          <span className={shared["section-label"]}>{memberTerm}</span>
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
          {supportsRelativeBrowse ? (
            <div className={styles["theory-mode-toggle-row"]}>
              <ToggleBar
                options={[
                  { value: "parallel", label: "Parallel" },
                  { value: "relative", label: "Relative" },
                ]}
                value={effectiveBrowseMode}
                onChange={(value) => setScaleBrowseMode(value as ScaleBrowseMode)}
                label="Scale relationship"
              />
              <p className={shared["shape-hint"]}>
                {effectiveBrowseMode === "parallel"
                  ? "Cycle modes that share the current root note."
                  : "Cycle modes that share the current key signature."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
