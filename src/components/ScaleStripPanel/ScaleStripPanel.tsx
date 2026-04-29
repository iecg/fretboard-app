import { useAtom } from "jotai";
import { useScaleState } from "../../hooks/useScaleState";
import { scaleDegreeColorsEnabledAtom } from "../../store/atoms";
import { DegreeChipStrip } from "../DegreeChipStrip/DegreeChipStrip";
import styles from "../DegreeChipStrip/DegreeChipStrip.module.css";

function EyeOpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <path d="m1 1 22 22"/>
    </svg>
  );
}

/** Scale surface: degree chips + eye visibility toggle. No chord concerns. */
export function ScaleStripPanel() {
  const {
    scaleLabel,
    hiddenNotes,
    toggleHiddenNote,
    degreeChips,
    colorNotes,
    scaleVisible,
    toggleScaleVisible,
  } = useScaleState();

  const [degreeColorsEnabled] = useAtom(scaleDegreeColorsEnabledAtom);

  const colorNoteSet = colorNotes.length > 0 ? new Set(colorNotes) : undefined;

  return (
    <DegreeChipStrip
      scaleName={scaleLabel}
      chips={degreeChips}
      hiddenNotes={scaleVisible ? hiddenNotes : undefined}
      onChipToggle={scaleVisible ? toggleHiddenNote : undefined}
      colorNotes={colorNoteSet}
      visible={scaleVisible}
      degreeColorsEnabled={degreeColorsEnabled}
      aria-label="Scale degrees"
      headerAction={
        <button
          type="button"
          className={styles["scale-eye-toggle"]}
          aria-label={scaleVisible ? "Hide scale" : "Show scale"}
          aria-pressed={!scaleVisible}
          onClick={toggleScaleVisible}
        >
          {scaleVisible ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      }
    />
  );
}
