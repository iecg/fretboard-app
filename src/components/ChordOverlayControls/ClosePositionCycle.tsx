import { useAtom, useAtomValue } from "jotai";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  closeCandidatesAtom,
  closePositionIndexAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./ChordOverlayControls.module.css";

/**
 * Prev / counter / next stepper for cycling through Close-voicing candidates
 * inside the active scale-shape window. The raw `closePositionIndexAtom`
 * stores an unbounded integer; this component wraps it modulo
 * `closeCandidatesAtom.length` for display and for the next/prev writes,
 * matching the wrapping used by `voicingMatchesAtom` itself.
 *
 * When no candidates exist (no chord, no fitting voicings) the counter shows
 * "0 / 0" and both arrows are disabled.
 */
export function ClosePositionCycle() {
  const { t } = useTranslation();
  const candidates = useAtomValue(closeCandidatesAtom);
  const [index, setIndex] = useAtom(closePositionIndexAtom);

  const total = candidates.length;
  const wrapped = total === 0 ? 0 : ((index % total) + total) % total;
  const disabled = total === 0;

  return (
    <div
      className={styles.cycle}
      role="group"
      aria-label={t("inspector.closeCycleAriaLabel")}
    >
      <button
        type="button"
        aria-label={t("inspector.closeCyclePrev")}
        disabled={disabled}
        onClick={() => setIndex(wrapped - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span
        className={styles.cycleCounter}
        data-testid="close-cycle-counter"
        aria-live="polite"
      >
        {total === 0 ? "0 / 0" : `${wrapped + 1} / ${total}`}
      </span>
      <button
        type="button"
        aria-label={t("inspector.closeCycleNext")}
        disabled={disabled}
        onClick={() => setIndex(wrapped + 1)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
