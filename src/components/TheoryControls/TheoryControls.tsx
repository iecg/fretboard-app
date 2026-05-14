import { useId, useState, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { ScaleSelector } from "../ScaleSelector/ScaleSelector";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { KeyExplorer } from "../KeyExplorer/KeyExplorer";
import { NOTES } from "@fretflow/core";
import {
  ANIMATION_DURATION_XFADE,
  ANIMATION_EASE,
} from "@fretflow/core";
import { getDegreesForScale } from "@fretflow/core";
import { ProgressionControls } from "../ProgressionControls/ProgressionControls";
import { useProgressionState } from "../../hooks/useProgressionState";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import { scaleLabelAtom, fingeringPatternAtom, totalProgressionBarsAtom } from "../../store/atoms";
import styles from "../TheoryControls/TheoryControls.module.css";

interface TheoryControlsProps {
  keyExplorer?: ReactNode;
}

export interface TheorySectionProps {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  open,
  onOpenChange,
  children,
  compact = false,
  disabled = false,
}: TheorySectionProps) {
  const [userOpen, setUserOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const requestedOpen = isControlled ? open : userOpen;

  // Derive effective open state: disabled always collapses the panel.
  const isOpen = !disabled && requestedOpen;
  const contentId = useId();

  const handleToggle = () => {
    if (disabled) return;
    const nextOpen = !isOpen;
    if (!isControlled) {
      setUserOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
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
            transition={{ duration: ANIMATION_DURATION_XFADE, ease: ANIMATION_EASE }}
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
            transition={{ duration: ANIMATION_DURATION_XFADE, ease: ANIMATION_EASE }}
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
              duration: ANIMATION_DURATION_XFADE,
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

function useProgressionSectionSummary() {
  const {
    progressionEnabled,
    progressionSteps,
    progressionPlaybackBlockedReason,
  } = useProgressionState();
  const totalBars = useAtomValue(totalProgressionBarsAtom);

  if (!progressionEnabled) return "Off";
  if (progressionSteps.length === 0) return "Empty";
  if (progressionPlaybackBlockedReason?.startsWith("Chord overlay disabled")) return "Disabled";
  const rounded = Math.max(1, Math.round(totalBars));
  return `${rounded} ${rounded === 1 ? "bar" : "bars"}`;
}

type TheoryOpenSection = "scale" | "chords" | "progression" | null;

export function TheoryControls({ keyExplorer }: TheoryControlsProps) {
  const scaleLabel = useAtomValue(scaleLabelAtom);
  const chordSummary = useChordSectionSummary();
  const progressionSummary = useProgressionSectionSummary();

  const { chordType } = useChordState();
  const fingeringPattern = useAtomValue(fingeringPatternAtom);
  const isChordsDisabled =
    fingeringPattern === "one-string" || fingeringPattern === "two-strings";
  const initialOpenSection: TheoryOpenSection =
    Boolean(chordType) && !isChordsDisabled ? "chords" : "scale";
  const [openSection, setOpenSection] = useState<TheoryOpenSection>(initialOpenSection);
  const shouldReleaseDisabledChords = openSection === "chords" && isChordsDisabled;
  const effectiveOpenSection = shouldReleaseDisabledChords ? "scale" : openSection;

  const setSectionOpen = (section: Exclude<TheoryOpenSection, null>) => (open: boolean) => {
    setOpenSection(open ? section : null);
  };

  return (
    <div className={styles["theory-controls"]} data-testid="theory-controls">
      <TheorySection
        title="Scale"
        summary={scaleLabel}
        open={effectiveOpenSection === "scale"}
        onOpenChange={setSectionOpen("scale")}
      >
        <ScaleSelector />
        {keyExplorer ? <KeyExplorer>{keyExplorer}</KeyExplorer> : null}
      </TheorySection>
      <hr className={styles["theory-section-divider"]} />
      <TheorySection
        title="Chords"
        summary={isChordsDisabled ? "Disabled" : chordSummary}
        open={effectiveOpenSection === "chords"}
        onOpenChange={setSectionOpen("chords")}
        disabled={isChordsDisabled}
      >
        <ChordOverlayControls />
      </TheorySection>
      <hr className={styles["theory-section-divider"]} />
      <TheorySection
        title="Progression"
        summary={progressionSummary}
        open={effectiveOpenSection === "progression"}
        onOpenChange={setSectionOpen("progression")}
      >
        <ProgressionControls />
      </TheorySection>
    </div>
  );
}

export default TheoryControls;
