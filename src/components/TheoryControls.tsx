import { startTransition, useState, type ReactNode } from "react";
import clsx from "clsx";
import { DrawerSelector } from "../DrawerSelector";
import { NOTES } from "../theory";
import { CHORD_FILTER_OPTIONS } from "../hooks/useDisplayState";
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
} from "../theoryCatalog";
import { NoteGrid } from "./NoteGrid";
import { ToggleBar } from "./ToggleBar";
import "./TheoryControls.css";

const CHORD_OPTIONS: (string | { divider: string })[] = [
  { divider: "Triads" },
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  { divider: "Seventh Chords" },
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  { divider: "Other" },
  "Power Chord (5)",
];

interface TheoryControlsProps {
  rootNote: string;
  setRootNote: (note: string) => void;
  scaleName: string;
  setScaleName: (scale: string) => void;
  scaleBrowseMode: ScaleBrowseMode;
  setScaleBrowseMode: (mode: ScaleBrowseMode) => void;
  chordType: string | null;
  setChordType: (chord: string | null) => void;
  chordRoot: string;
  setChordRoot: (note: string) => void;
  linkChordRoot: boolean;
  setLinkChordRoot: (linked: boolean) => void;
  hideNonChordNotes: boolean;
  setHideNonChordNotes: (hide: boolean) => void;
  chordIntervalFilter: string;
  setChordIntervalFilter: (filter: string) => void;
  useFlats: boolean;
  keyExplorer?: ReactNode;
}

export function TheoryControls({
  rootNote,
  setRootNote,
  scaleName,
  setScaleName,
  scaleBrowseMode,
  setScaleBrowseMode,
  chordType,
  setChordType,
  chordRoot,
  setChordRoot,
  linkChordRoot,
  setLinkChordRoot,
  hideNonChordNotes,
  setHideNonChordNotes,
  chordIntervalFilter,
  setChordIntervalFilter,
  useFlats,
  keyExplorer,
}: TheoryControlsProps) {
  const [isChordOverlayOpen, setChordOverlayOpen] = useState(Boolean(chordType));
  const [isKeyExplorerOpen, setKeyExplorerOpen] = useState(false);

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
  const browseOptionLabels = browseOptions.map((option) => option.label);
  const browseLabel = supportsRelativeBrowse
    ? `${effectiveBrowseMode === "relative" ? "Relative" : "Parallel"} ${memberTerm}s`
    : `Browse ${memberTerm}s`;

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
    applyTheorySelection(rootNote, getScaleNameForFamilySelector(selectorLabel));
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

  const handleChordTypeChange = (nextChordType: string | null) => {
    startTransition(() => {
      setChordType(nextChordType);
      if (nextChordType && linkChordRoot) {
        setChordRoot(rootNote);
      }
    });
  };

  const chordSummary = chordType ?? "Off";
  const chordOverlayOpen = isChordOverlayOpen || Boolean(chordType);

  return (
    <div className="theory-controls">
      <div className="control-section">
        <span className="section-label">Root</span>
        <NoteGrid
          notes={NOTES}
          selected={rootNote}
          onSelect={applyRootNote}
          useFlats={useFlats}
        />
      </div>

      <div className="control-section">
        <DrawerSelector
          label="Scale Family"
          value={currentFamily.selectorLabel}
          options={familyOptions}
          onSelect={handleFamilySelect}
        />
      </div>

      <div className="control-section">
        <span className="section-label">{memberTerm}</span>
        <div className="theory-browse-stack">
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
        <div
          className="theory-stepper"
          role="group"
          aria-label={`${memberTerm} navigation`}
        >
          <button
            type="button"
            className="theory-stepper-btn"
            onClick={() => handleStepBrowse(-1)}
            aria-label={`Previous ${browseLabel}`}
          >
            ‹
          </button>
          <div className="theory-stepper-value theory-stepper-value--browse">
            <span className="theory-stepper-term">Browse</span>
            <span className="theory-stepper-label">{browseLabel}</span>
          </div>
          <button
            type="button"
            className="theory-stepper-btn"
            onClick={() => handleStepBrowse(1)}
            aria-label={`Next ${browseLabel}`}
          >
            ›
          </button>
        </div>
        <DrawerSelector
          label={memberTerm}
          value={activeBrowseOption.label}
          options={browseOptionLabels}
          onSelect={handleBrowseSelect}
        />
      </div>

      {keyExplorer ? (
        <div className="theory-inline-key panel-surface panel-surface--compact">
          <button
            type="button"
            className={clsx("theory-disclosure-btn", {
              "theory-disclosure-btn--open": isKeyExplorerOpen,
            })}
            aria-expanded={isKeyExplorerOpen}
            onClick={() => setKeyExplorerOpen((value) => !value)}
          >
            <span className="theory-disclosure-title">Circle of Fifths</span>
            <span className="theory-disclosure-summary">
              {isKeyExplorerOpen ? "Hide" : "Show"}
            </span>
          </button>
          {isKeyExplorerOpen ? (
            <div className="theory-inline-key-content">{keyExplorer}</div>
          ) : null}
        </div>
      ) : null}

      <div className="theory-chord-section panel-surface panel-surface--compact">
        <button
          type="button"
          className={clsx("theory-disclosure-btn", {
            "theory-disclosure-btn--open": chordOverlayOpen,
          })}
          aria-expanded={chordOverlayOpen}
          onClick={() => setChordOverlayOpen((value) => !value)}
        >
          <span className="theory-disclosure-title">Chord Overlay</span>
          <span className="theory-disclosure-summary">{chordSummary}</span>
        </button>

        {chordOverlayOpen ? (
          <div className="theory-chord-content">
            <DrawerSelector
              label="Chord Type"
              value={chordType}
              options={CHORD_OPTIONS}
              onSelect={handleChordTypeChange}
              nullable
            />

            {chordType ? (
              <>
                <label className="link-toggle">
                  <input
                    type="checkbox"
                    checked={linkChordRoot}
                    onChange={(event) => {
                      const nextValue = event.target.checked;
                      setLinkChordRoot(nextValue);
                      if (nextValue) {
                        startTransition(() => {
                          setChordRoot(rootNote);
                        });
                      }
                    }}
                  />
                  <span>Link chord root to scale</span>
                </label>

                {!linkChordRoot ? (
                  <div className="control-section">
                    <span className="section-label">Chord Root</span>
                    <NoteGrid
                      notes={NOTES}
                      selected={chordRoot}
                      onSelect={setChordRoot}
                      useFlats={useFlats}
                    />
                  </div>
                ) : null}

                <label className="link-toggle">
                  <input
                    type="checkbox"
                    checked={hideNonChordNotes}
                    onChange={(event) =>
                      setHideNonChordNotes(event.target.checked)
                    }
                  />
                  <span>Chord only (hide scale)</span>
                </label>

                <DrawerSelector
                  label="Interval Filter"
                  value={chordIntervalFilter}
                  options={CHORD_FILTER_OPTIONS}
                  onSelect={setChordIntervalFilter}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TheoryControls;
