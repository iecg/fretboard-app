import { ControlsColumn, KeyColumn } from "./ExpandedControlsPanel";

/**
 * Landscape-wide-flanking layout (width ≥ 1025, height < 1000).
 *
 * Three-column arrangement: [Controls | Fretboard | Key].
 * The fretboard column is provided by the existing `main.main-fretboard`
 * element rendered by App.tsx — CSS explicit grid placement handles positioning
 * (grid-column: 2, grid-row: 2) on that element for this layout mode.
 *
 * ControlsColumn and KeyColumn read Jotai atoms directly so they remain
 * fully interactive without prop drilling.
 */
export function FlankingWideLayout() {
  return (
    <main className="flanking-row">
      <ControlsColumn />
      <KeyColumn />
    </main>
  );
}
