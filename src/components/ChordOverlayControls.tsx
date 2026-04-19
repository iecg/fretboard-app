import { startTransition, useId, useState } from "react";
import clsx from "clsx";
import {
  NOTES,
  type PracticeLens,
  type FocusPreset,
  type ChordMemberName,
} from "../theory";
import { LabeledSelect, type LabeledSelectOption } from "./LabeledSelect";
import { NoteGrid } from "./NoteGrid";
import { ToggleBar } from "./ToggleBar";
import { useChordState } from "../hooks/useChordState";
import { useScaleState } from "../hooks/useScaleState";
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

const PRACTICE_LENS_OPTIONS: { value: PracticeLens; label: string }[] = [
  { value: "targets-color", label: "Targets + Color" },
  { value: "targets", label: "Targets" },
  { value: "guide-tones", label: "Guide Tones" },
  { value: "color", label: "Color" },
  { value: "tension", label: "Tension" },
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

export function ChordOverlayControls() {
  const { rootNote } = useScaleState();
  const {
    chordRoot,
    setChordRoot,
    chordType,
    setChordType,
    linkChordRoot,
    setLinkChordRoot,
    practiceLens,
    setPracticeLens,
    focusPreset,
    setFocusPreset,
    customMembers,
    setCustomMembers,
    availableFocusPresets,
    chordMembers,
    hasOutsideChordMembers,
  } = useChordState();

  const { useFlats } = useScaleState();

  const [isChordOverlayOpen, setChordOverlayOpen] = useState(Boolean(chordType));
  const linkChordRootId = useId();

  const chordSelectOptions: LabeledSelectOption[] = [
    { value: CHORD_NONE_VALUE, label: "Off" },
    ...CHORD_OPTIONS.filter(
      (option): option is string => typeof option === "string",
    ).map((option) => ({
      value: option,
      label: option,
    })),
  ];

  // Tension lens requires outside chord members to be meaningful.
  const lensOptions = PRACTICE_LENS_OPTIONS.map((opt) => ({
    ...opt,
    disabled: opt.value === "tension" && !hasOutsideChordMembers,
  }));

  const focusPresetOptions = availableFocusPresets.map((preset) => ({
    value: preset,
    label: FOCUS_PRESET_LABELS[preset],
  }));

  const effectiveFocusPreset = availableFocusPresets.includes(focusPreset)
    ? focusPreset
    : "all";

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
              handleChordTypeChange(value === CHORD_NONE_VALUE ? null : value)
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
                <span className={shared["section-label"]}>Lens</span>
                <ToggleBar
                  options={lensOptions}
                  value={practiceLens}
                  onChange={setPracticeLens}
                  label="Practice lens"
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
                    className={clsx(
                      shared["toggle-group"],
                      shared["toggle-group--default"],
                    )}
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
  );
}
