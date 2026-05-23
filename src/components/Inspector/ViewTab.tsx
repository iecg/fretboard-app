import type { ReactNode } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { ChordOverlayControls } from "../ChordOverlayControls/ChordOverlayControls";
import { PropGrid } from "./InspectorGrid";
import { Switch } from "../Switch/Switch";
import { useTranslation } from "../../hooks/useTranslation";
import { scaleVisibleAtom, toggleScaleVisibleAtom } from "../../store/scaleAtoms";
import { chordOverlayHiddenAtom } from "../../store/chordOverlayAtoms";
import styles from "./ViewTab.module.css";

interface OverlayCardProps {
  /** Master visibility state for this section. Drives the dim state and the chip. */
  active: boolean;
  /** Toggle handler — receives the new boolean. */
  onToggle: (next: boolean) => void;
  /** Switch's accessible name (e.g. "Show on Board"). */
  toggleLabel: string;
  /** Section name (e.g. "Scale"). Rendered as the card heading. */
  name: string;
  /** One-line description shown next to the name. */
  description: string;
  /** "Showing" / "Hidden" state chip text. */
  stateLabel: string;
  /** ID used as the section heading id (for aria-labelledby on the parent section). */
  labelledById: string;
  /** Card body contents (the actual control grid). */
  children: ReactNode;
}

/**
 * Variant B (Sectioned Cards): a bordered card whose header bar carries the
 * master visibility toggle, the section name, a "SHOWING" / "HIDDEN" state
 * chip and a one-line description. The body dims when the master toggle is
 * off, giving immediate cause-and-effect feedback that's missing in the flat
 * `GroupHeader` layout.
 *
 * Kept private to this module — the only consumers are the two Overlay tab
 * sections below. Lift to a shared primitive if a third use-case appears.
 */
function OverlayCard({
  active,
  onToggle,
  toggleLabel,
  name,
  description,
  stateLabel,
  labelledById,
  children,
}: OverlayCardProps) {
  return (
    <section
      className={styles.card}
      data-active={active ? "true" : "false"}
      aria-labelledby={labelledById}
    >
      <header className={styles.cardHead}>
        <Switch label={toggleLabel} checked={active} onChange={onToggle} />
        <h3 id={labelledById} className={styles.cardName}>
          {name}
        </h3>
        <span className={styles.cardState} aria-hidden="true">
          {stateLabel}
        </span>
        <span className={styles.cardDesc}>{description}</span>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

/**
 * The Overlay tab (formerly View) in the 2-tab Inspector. Two sectioned cards
 * stack vertically:
 *
 *   1. SCALE — hosts FingeringPatternControls (pattern, shape, position).
 *   2. CHORD — hosts ChordOverlayControls (voicing, lens, string set, lock-to-scale).
 *
 * This component owns no atoms beyond the two master visibility flags.
 */
export function ViewTab() {
  const { t } = useTranslation();
  const scaleVisible = useAtomValue(scaleVisibleAtom);
  const toggleScaleVisible = useSetAtom(toggleScaleVisibleAtom);
  const [chordOverlayHidden, setChordOverlayHidden] = useAtom(chordOverlayHiddenAtom);
  const chordVisible = !chordOverlayHidden;
  return (
    <div
      className={styles.root}
      data-inspector-tab="view"
      data-testid="view-tab"
    >
      <OverlayCard
        active={scaleVisible}
        onToggle={toggleScaleVisible}
        toggleLabel={t("inspector.showOnBoard")}
        name={t("inspector.groupScaleFingering")}
        description={t("inspector.groupScaleFingeringDesc")}
        stateLabel={scaleVisible ? t("inspector.stateShowing") : t("inspector.stateHidden")}
        labelledById="view-fingering-heading"
      >
        <PropGrid columns={6}>
          <FingeringPatternControls hideHeader />
        </PropGrid>
      </OverlayCard>
      <OverlayCard
        active={chordVisible}
        onToggle={(next) => setChordOverlayHidden(!next)}
        toggleLabel={t("inspector.showOnBoard")}
        name={t("inspector.groupChordVoicing")}
        description={t("inspector.groupChordVoicingDesc")}
        stateLabel={chordVisible ? t("inspector.stateShowing") : t("inspector.stateHidden")}
        labelledById="view-voicing-heading"
      >
        <ChordOverlayControls />
      </OverlayCard>
    </div>
  );
}
