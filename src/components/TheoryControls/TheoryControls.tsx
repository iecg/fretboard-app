import { useId, useState, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { KeyExplorer } from "../KeyExplorer/KeyExplorer";
import { NOTES } from "../../core/theory";
import {
  ANIMATION_DURATION_STANDARD,
  ANIMATION_EASE,
} from "../../core/constants";
import { getDegreesForScale } from "../../core/degrees";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import { scaleLabelAtom, fingeringPatternAtom } from "../../store/atoms";
import styles from "../TheoryControls/TheoryControls.module.css";

interface TheoryControlsProps {
  keyExplorer?: ReactNode;
  /** Reduces vertical padding and font size on disclosure rows for tight layouts. */
  compact?: boolean;
}

export interface TheorySectionProps {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Reduces vertical padding and font size on disclosure rows for tight layouts. */
  compact?: boolean;
  /**
   * When true, the disclosure arrow is grayed out and non-interactive, and the
   * panel auto-collapses.
   */
  disabled?: boolean;
}

export function TheorySection({
  title,
  summary,
  defaultOpen = false,
  children,
  compact = false,
  disabled = false,
}: TheorySectionProps) {
  // Track the user-controlled open/close state. When disabled, the panel is
  // always rendered as collapsed without needing side effects.
  const [userOpen, setUserOpen] = useState(defaultOpen);

  // Derive effective open state: disabled always collapses the panel.
  const isOpen = !disabled && userOpen;
  const contentId = useId();

  const handleToggle = () => {
    if (disabled) return;
    setUserOpen((value) => !value);
  };

  return (
    <section
      className={styles["theory-section"]}
      data-open={isOpen}
      data-compact={compact ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      <button
        type="button"
        className={clsx(styles["theory-disclosure-btn"], {
          [styles["theory-disclosure-btn--open"]]: isOpen,
          [styles["theory-disclosure-btn--disabled"]]: disabled,
        })}
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-disabled={disabled ? "true" : undefined}
        onClick={handleToggle}
      >
<AnimatePresence mode="wait">
          <motion.span
            key={title}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.16 }}
            className={styles["theory-disclosure-title"]}
          >
            {title}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.span
            key={summary}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16 }}
            className={styles["theory-disclosure-summary"]}
          >
            {summary}
          </motion.span>
        </AnimatePresence>
        <ChevronDown
          className={styles["theory-disclosure-icon"]}
          aria-hidden="true"
          size={16}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="content"
            id={contentId}
            className={styles["theory-section-content"]}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: ANIMATION_DURATION_STANDARD,
              ease: ANIMATION_EASE,
            }}
            style={{ clipPath: "inset(0 -1rem)" }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function useChordSectionSummary() {
  const {
    chordRoot,
    chordType,
    chordLabel,
    chordDegree,
    chordOverlayMode,
    hasOutsideChordMembers,
  } = useChordState();
  const { rootNote, scaleName } = useScaleState();

  if (!chordType || !chordLabel) {
    return "Off";
  }

  if (chordOverlayMode === "degree" && chordDegree) {
    return `${chordLabel} · ${chordDegree}`;
  }

  const scaleRootIndex = NOTES.indexOf(rootNote);
  const chordRootIndex = NOTES.indexOf(chordRoot);
  if (scaleRootIndex === -1 || chordRootIndex === -1) {
    return chordLabel;
  }

  const semitone = (chordRootIndex - scaleRootIndex + 12) % 12;
  const degree = getDegreesForScale(scaleName)[semitone];
  if (!degree) {
    return `${chordLabel} · outside scale`;
  }

  return `${chordLabel} · ${
    hasOutsideChordMembers ? `${degree} root, outside tones` : `${degree} in scale`
  }`;
}

export function TheoryControls({ keyExplorer, compact = false }: TheoryControlsProps) {
  const scaleSummary = useAtomValue(scaleLabelAtom);
  const chordSummary = useChordSectionSummary();
  const { chordType } = useChordState();
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isChordsDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";

  return (
    <div className={styles["theory-controls"]} data-testid="theory-controls">
      <TheorySection title="Scale" summary={scaleSummary} defaultOpen compact={compact}>
        <ScaleSelector compact={compact} />
        {keyExplorer ? <KeyExplorer>{keyExplorer}</KeyExplorer> : null}
      </TheorySection>
      <TheorySection
        title="Chords"
        summary={chordSummary}
        defaultOpen={Boolean(chordType)}
        compact={compact}
        disabled={isChordsDisabled}
      >
        <ChordOverlayControls compact={compact} />
      </TheorySection>
    </div>
  );
}

export default TheoryControls;
