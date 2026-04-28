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
  ANIMATION_DURATION_FAST,
  ANIMATION_EASE,
} from "../../core/constants";
import { getDegreesForScale } from "../../core/degrees";
import { useChordState } from "../../hooks/useChordState";
import { useScaleState } from "../../hooks/useScaleState";
import { scaleLabelAtom } from "../../store/atoms";
import styles from "../TheoryControls/TheoryControls.module.css";

interface TheoryControlsProps {
  keyExplorer?: ReactNode;
}

interface TheorySectionProps {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function TheorySection({
  title,
  summary,
  defaultOpen = false,
  children,
}: TheorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={styles["theory-section"]} data-open={isOpen}>
      <button
        type="button"
        className={clsx(styles["theory-disclosure-btn"], {
          [styles["theory-disclosure-btn--open"]]: isOpen,
        })}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className={styles["theory-disclosure-title"]}>{title}</span>
        <span className={styles["theory-disclosure-summary"]}>{summary}</span>
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
              duration: ANIMATION_DURATION_FAST,
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

export function TheoryControls({ keyExplorer }: TheoryControlsProps) {
  const scaleSummary = useAtomValue(scaleLabelAtom);
  const chordSummary = useChordSectionSummary();
  const { chordType } = useChordState();

  return (
    <div className={styles["theory-controls"]} data-testid="theory-controls">
      <TheorySection title="Scale" summary={scaleSummary} defaultOpen>
        <ScaleSelector />
        {keyExplorer ? <KeyExplorer>{keyExplorer}</KeyExplorer> : null}
      </TheorySection>
      <TheorySection
        title="Chords"
        summary={chordSummary}
        defaultOpen={Boolean(chordType)}
      >
        <ChordOverlayControls />
      </TheorySection>
    </div>
  );
}

export default TheoryControls;
