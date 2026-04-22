import { startTransition } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { LabeledSelect, type LabeledSelectOption } from "../LabeledSelect/LabeledSelect";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { useScaleState } from "../../hooks/useScaleState";
import shared from "../shared.module.css";
import theoryStyles from "../TheoryControls/TheoryControls.module.css";

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
  const familySelectOptions: LabeledSelectOption[] = familyOptions.map(
    (option) => ({
      value: option,
      label: option,
    }),
  );
  const browseSelectOptions: LabeledSelectOption[] = browseOptions.map(
    (option) => ({
      value: option.label,
      label: option.label,
    }),
  );

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
    applyTheorySelection(
      rootNote,
      getScaleNameForFamilySelector(selectorLabel),
    );
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
        <LabeledSelect
          label="Scale Family"
          value={currentFamily.selectorLabel}
          options={familySelectOptions}
          onChange={handleFamilySelect}
        />
      </div>

      <div className={shared["control-section"]}>
        <div className={clsx(theoryStyles["theory-mode-browser"], "panel-surface panel-surface--compact")}>
          <span className={shared["section-label"]}>{memberTerm}</span>
          <div
            className={theoryStyles["theory-browser-main"]}
            role="group"
            aria-label={`Browse ${memberTerm}`}
          >
            <button
              type="button"
              className={theoryStyles["theory-nav-btn"]}
              onClick={() => handleStepBrowse(-1)}
              aria-label={`Previous ${memberTerm}`}
            >
              <ChevronLeft size={16} />
            </button>
            <div className={theoryStyles["theory-browser-selector"]}>
              <LabeledSelect
                label={memberTerm}
                hideLabel
                value={activeBrowseOption.label}
                options={browseSelectOptions}
                onChange={handleBrowseSelect}
              />
            </div>
            <button
              type="button"
              className={theoryStyles["theory-nav-btn"]}
              onClick={() => handleStepBrowse(1)}
              aria-label={`Next ${memberTerm}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {supportsRelativeBrowse ? (
            <ToggleBar
              options={[
                { value: "parallel", label: "Parallel" },
                { value: "relative", label: "Relative" },
              ]}
              value={effectiveBrowseMode}
              onChange={(value) => setScaleBrowseMode(value as ScaleBrowseMode)}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
