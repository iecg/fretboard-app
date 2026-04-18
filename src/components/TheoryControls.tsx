import { startTransition, useId, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  NOTES,
  type ViewMode,
  type FocusPreset,
  type ChordMemberName,
  type ResolvedChordMember,
} from "../theory";
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
import { LabeledSelect, type LabeledSelectOption } from "./LabeledSelect";
import { NoteGrid } from "./NoteGrid";
import { ToggleBar } from "./ToggleBar";
import "./TheoryControls.css";
import shared from "./shared.module.css";

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

const CHORD_NONE_VALUE = "__none__";

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "compare", label: "Scale + Chord" },
  { value: "chord", label: "Chord Only" },
  { value: "outside", label: "Outside" },
];

const FOCUS_PRESET_LABELS: Record<FocusPreset, string> = {
  all: "All",
  triad: "Triad",
  shell: "Shell",
  "guide-tones": "Guide Tones",
  rootless: "Rootless",
  custom: "Custom",
};

function formatMemberName(name: ChordMemberName): string {
  if (name === "root") return "Root";
  return name.replace("b", "♭");
}

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
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  focusPreset: FocusPreset;
  setFocusPreset: (preset: FocusPreset) => void;
  customMembers: ChordMemberName[];
  setCustomMembers: (members: ChordMemberName[]) => void;
  availableFocusPresets: FocusPreset[];
  chordMembers: ResolvedChordMember[];
  hasOutsideChordMembers: boolean;
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
  viewMode,
  setViewMode,
  focusPreset,
  setFocusPreset,
  customMembers,
  setCustomMembers,
  availableFocusPresets,
  chordMembers,
  hasOutsideChordMembers,
  useFlats,
  keyExplorer,
}: TheoryControlsProps) {
  const [isChordOverlayOpen, setChordOverlayOpen] = useState(Boolean(chordType));
  const [isKeyExplorerOpen, setKeyExplorerOpen] = useState(false);
  const linkChordRootId = useId();

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
  const familySelectOptions: LabeledSelectOption[] = familyOptions.map((option) => ({
    value: option,
    label: option,
  }));
  const browseSelectOptions: LabeledSelectOption[] = browseOptions.map((option) => ({
    value: option.label,
    label: option.label,
  }));
  const chordSelectOptions: LabeledSelectOption[] = [
    { value: CHORD_NONE_VALUE, label: "Off" },
    ...CHORD_OPTIONS.filter((option): option is string => typeof option === "string").map((option) => ({
      value: option,
      label: option,
    })),
  ];

  const viewModeOptions = VIEW_MODE_OPTIONS.map((opt) => ({
    ...opt,
    disabled: opt.value === "outside" && !hasOutsideChordMembers,
  }));

  const focusPresetOptions = availableFocusPresets.map((preset) => ({
    value: preset,
    label: FOCUS_PRESET_LABELS[preset],
  }));

  const effectiveFocusPreset = availableFocusPresets.includes(focusPreset)
    ? focusPreset
    : "all";
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
        <div className="theory-mode-browser panel-surface panel-surface--compact">
          <span className={shared["section-label"]}>{memberTerm}</span>
          <div
            className="theory-browser-main"
            role="group"
            aria-label={`Browse ${memberTerm}`}
          >
            <button
              type="button"
              className="theory-nav-btn"
              onClick={() => handleStepBrowse(-1)}
              aria-label={`Previous ${memberTerm}`}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="theory-browser-selector">
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
              className="theory-nav-btn"
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
            <LabeledSelect
              label="Chord Type"
              value={chordType ?? CHORD_NONE_VALUE}
              options={chordSelectOptions}
              onChange={(value) =>
                handleChordTypeChange(
                  value === CHORD_NONE_VALUE ? null : value,
                )
              }
            />

            {chordType ? (
              <>
                <label className={shared["link-toggle"]} htmlFor={linkChordRootId}>
                  <input
                    id={linkChordRootId}
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
                  <div className={shared["control-section"]}>
                    <span className={shared["section-label"]}>Chord Root</span>
                    <NoteGrid
                      notes={NOTES}
                      selected={chordRoot}
                      onSelect={setChordRoot}
                      useFlats={useFlats}
                    />
                  </div>
                ) : null}

                <div className={shared["control-section"]}>
                  <span className={shared["section-label"]}>View</span>
                  <ToggleBar
                    options={viewModeOptions}
                    value={viewMode}
                    onChange={setViewMode}
                    label="View mode"
                  />
                </div>

                <div className={shared["control-section"]}>
                  <span className={shared["section-label"]}>Focus</span>
                  <ToggleBar
                    options={focusPresetOptions}
                    value={effectiveFocusPreset}
                    onChange={setFocusPreset}
                    label="Focus preset"
                  />
                </div>

                {effectiveFocusPreset === "custom" ? (
                  <div className={shared["control-section"]}>
                    <span className={shared["section-label"]}>Members</span>
                    <div
                      className={clsx(shared["toggle-group"], shared["toggle-group--default"])}
                      role="group"
                      aria-label="Custom chord members"
                    >
                      {chordMembers.map((m) => {
                        const isActive = customMembers.includes(m.name);
                        return (
                          <button
                            key={m.name}
                            type="button"
                            aria-pressed={isActive}
                            className={clsx(
                              shared["toggle-btn"],
                              isActive && shared.active,
                            )}
                            onClick={() =>
                              setCustomMembers(
                                isActive
                                  ? customMembers.filter((n) => n !== m.name)
                                  : [...customMembers, m.name],
                              )
                            }
                          >
                            {formatMemberName(m.name)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TheoryControls;
