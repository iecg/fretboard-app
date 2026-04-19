import { startTransition, useEffect, useId, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import {
  NOTES,
  type PracticeLens,
  type FocusPreset,
  type ChordMemberName,
} from "../theory";
import { lensAvailabilityAtom } from "../store/atoms";
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

const LENS_LABELS: Record<PracticeLens, string> = {
  "targets-color": "Targets + Color",
  targets: "Targets",
  "guide-tones": "Guide Tones",
  color: "Color",
  tension: "Tension",
};

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
  } = useChordState();

  const { useFlats } = useScaleState();
  const lensAvailability = useAtomValue(lensAvailabilityAtom);

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

  const lensOptions = lensAvailability.map((entry) => ({
    value: entry.id,
    label: LENS_LABELS[entry.id],
    disabled: !entry.available,
    title: entry.reason ?? undefined,
  }));

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);

  // Auto-exit any lens that becomes unavailable (e.g. chord removed, scale changed).
  useEffect(() => {
    if (currentLensEntry && !currentLensEntry.available) {
      setPracticeLens("targets-color");
    }
  }, [currentLensEntry, setPracticeLens]);

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
                {currentLensEntry?.description ? (
                  <p className={shared["lens-hint"]}>{currentLensEntry.description}</p>
                ) : null}
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
