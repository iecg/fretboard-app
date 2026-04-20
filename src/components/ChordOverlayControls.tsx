import { startTransition, useEffect, useId, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { NOTES } from "../theory";
import type { PracticeLens } from "../theory";
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

// Display order for the lens ToggleBar.
const LENS_UI_ORDER: readonly PracticeLens[] = [
  "targets",
  "guide-tones",
  "tension",
];

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

  // Build lens options from LENS_REGISTRY via lensAvailabilityAtom.
  // Tension is hidden (not just disabled) when unavailable and not currently active.
  const lensOptions = LENS_UI_ORDER.flatMap((id) => {
    const entry = lensAvailability.find((l) => l.id === id);
    const isActive = id === practiceLens;
    const available = entry ? entry.available : false;
    const reason = entry?.reason ?? undefined;

    // Hide lenses marked hideWhenUnavailable when they're unavailable and not active.
    if (!available && !isActive && entry?.hideWhenUnavailable) return [];

    return [
      {
        value: id,
        label: entry?.label ?? id,
        disabled: !isActive && !available,
        title: !isActive && reason ? reason : undefined,
        description: !isActive && reason ? reason : undefined,
      },
    ];
  });

  const currentLensEntry = lensAvailability.find((l) => l.id === practiceLens);

  // Auto-exit unavailable lenses. "targets" is exempt — it requires only an active
  // chord overlay and is always available when any other lens becomes unavailable.
  // When no lens is available (chord overlay removed), preserve the stored value.
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
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
