import { startTransition } from "react";
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
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { NoteGrid } from "../NoteGrid/NoteGrid";
import { ToggleBar } from "../ToggleBar/ToggleBar";
import { FieldHelpHeader } from "../shared/FieldHelpHeader";
import { useScaleState } from "../../hooks/useScaleState";
import { useHelpPopover } from "../shared/useHelpPopover";
import shared from "../shared/shared.module.css";
import theoryStyles from "../TheoryControls/TheoryControls.module.css";

const PARALLEL_RELATIVE_HELP = {
  id: "parallel-relative",
  content:
    "Parallel: same root, different mode (e.g. C major ↔ C Dorian). Relative: same key signature, different root (e.g. C major ↔ A minor).",
};

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

  const { activeHelpField, handleHelpToggle, registerHelpContainer } =
    useHelpPopover<"parallel-relative">();

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

  const handleStepFamily = (direction: -1 | 1) => {
    const currentIndex = familyOptions.indexOf(currentFamily.selectorLabel);
    const nextIndex =
      (currentIndex + direction + familyOptions.length) % familyOptions.length;
    const nextLabel = familyOptions[nextIndex];
    if (nextLabel !== currentFamily.selectorLabel) {
      setScaleName(getScaleNameForFamilySelector(nextLabel));
    }
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

      {/* Scale Family — theory-nav-btn browser */}
      <div className={shared["control-section"]}>
        <span className={shared["section-label"]}>Scale Family</span>
        <div
          className={theoryStyles["theory-browser-main"]}
          role="group"
          aria-label="Browse scale families"
        >
          <button
            type="button"
            className={theoryStyles["theory-nav-btn"]}
            onClick={() => handleStepFamily(-1)}
            aria-label="Previous scale family"
          >
            <ChevronLeft size={16} />
          </button>
          <div className={theoryStyles["theory-browser-selector"]}>
            <span>{currentFamily.selectorLabel}</span>
          </div>
          <button
            type="button"
            className={theoryStyles["theory-nav-btn"]}
            onClick={() => handleStepFamily(1)}
            aria-label="Next scale family"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Mode browser (browse by scale within family) */}
      <div className={shared["control-section"]}>
        <div className={theoryStyles["theory-mode-browser"]} role="group" aria-label={`Browse ${memberTerm}`}>
          <span className={shared["section-label"]}>{memberTerm}</span>
          <div className={theoryStyles["theory-browser-main"]}>
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
            <div className={theoryStyles["theory-mode-toggle-row"]}>
              <FieldHelpHeader
                label="Mode"
                help={PARALLEL_RELATIVE_HELP}
                isHelpOpen={activeHelpField === "parallel-relative"}
                onToggleHelp={() => handleHelpToggle("parallel-relative")}
                helpContainerRef={(node) =>
                  registerHelpContainer("parallel-relative", node)
                }
              />
              <ToggleBar
                options={[
                  { value: "parallel", label: "Parallel" },
                  { value: "relative", label: "Relative" },
                ]}
                value={effectiveBrowseMode}
                onChange={(value) => setScaleBrowseMode(value as ScaleBrowseMode)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
