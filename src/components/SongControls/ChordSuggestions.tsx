import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { getChordDisplayLabel, getNoteDisplay } from "@fretflow/core";
import {
  addSuggestedProgressionStepAtom,
  nextChordSuggestionsAtom,
} from "@fretflow/fretboard/store/progressionAtoms";
import type { NextChordReason } from "@fretflow/fretboard/progressions/nextChordSuggestions";
import { useScaleState } from "@fretflow/fretboard/hooks/useScaleState";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./SongControls.module.css";

const REASON_LABEL_KEYS: Record<NextChordReason, string> = {
  authenticCadence: "controls.suggestionReasonAuthenticCadence",
  plagalCadence: "controls.suggestionReasonPlagalCadence",
  deceptiveCadence: "controls.suggestionReasonDeceptiveCadence",
  twoFive: "controls.suggestionReasonTwoFive",
  modalCadence: "controls.suggestionReasonModalCadence",
  leadingResolve: "controls.suggestionReasonLeadingResolve",
  toDominant: "controls.suggestionReasonToDominant",
  commonMove: "controls.suggestionReasonCommonMove",
};

/**
 * Function-aware "Suggested next" chips for the chord editor: 2–3 candidates
 * for the chord that follows the selected slot, ranked by chord-function
 * convention (see docs/design/music-theory-pedagogy.md). Clicking a chip
 * inserts the candidate after the selected chord — the same insert-at-cursor
 * flow as the Add button — and moves the cursor onto it so it can be
 * previewed (`A`) or refined immediately.
 */
export function ChordSuggestions({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const { rootNote, preferFlats } = useScaleState();
  const suggestions = useAtomValue(nextChordSuggestionsAtom);
  const addSuggested = useSetAtom(addSuggestedProgressionStepAtom);

  if (suggestions.length === 0) return null;

  return (
    <div
      className={styles["suggestion-row"]}
      role="group"
      aria-label={t("controls.suggestedNext")}
    >
      <span className={styles["field-label"]}>{t("controls.suggestedNext")}</span>
      <div className={styles["suggestion-chips"]}>
        {suggestions.map((suggestion) => {
          const note = getNoteDisplay(suggestion.root, rootNote, preferFlats);
          const qualityWord = getChordDisplayLabel(suggestion.quality);
          const reason = t(REASON_LABEL_KEYS[suggestion.reason]);
          return (
            <button
              key={suggestion.degree}
              type="button"
              className={styles["suggestion-chip"]}
              disabled={disabled}
              onClick={() => addSuggested(suggestion.degree)}
              title={reason}
              aria-label={`${t("controls.addChord")}: ${suggestion.degree} — ${note} ${qualityWord}. ${reason}`}
              data-testid={`chord-suggestion-${suggestion.degree}`}
            >
              <Plus size={12} aria-hidden="true" />
              <span className={styles["suggestion-degree"]}>{suggestion.degree}</span>
              <span className={styles["suggestion-note"]}>{note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
