// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProgressionRuler } from "./ProgressionRuler";
import styles from "./ProgressionTrack.module.css";

describe("ProgressionRuler", () => {
  it("renders one bar wrapper per totalBarsForDisplay", () => {
    const { container } = render(
      <ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />,
    );
    expect(container.querySelectorAll(`.${styles.rulerBar}`).length).toBe(4);
  });

  it("renders the expected number of beat ticks per bar", () => {
    const { container } = render(
      <ProgressionRuler totalBarsForDisplay={1} subdivisionsPerBar={4} />,
    );
    // Per bar: 2 * subdivisionsPerBar - 1 = 7 ticks total, of which floor(7/2) = 3 are beat ticks.
    expect(container.querySelectorAll(`.${styles["rulerTick--beat"]}`).length).toBe(3);
  });

  it("omits the leading bar-tick on the first bar only", () => {
    const { container } = render(
      <ProgressionRuler totalBarsForDisplay={3} subdivisionsPerBar={4} />,
    );
    // Bar tick exists on bars 2 and 3, never on bar 1.
    expect(container.querySelectorAll(`.${styles.rulerBarTick}`).length).toBe(2);
  });

  it("preserves DOM node identity when re-rendered with the same props", () => {
    const { container, rerender } = render(
      <ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />,
    );
    const firstRoot = container.querySelector(`.${styles.ruler}`);
    rerender(<ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />);
    rerender(<ProgressionRuler totalBarsForDisplay={4} subdivisionsPerBar={4} />);
    const secondRoot = container.querySelector(`.${styles.ruler}`);
    expect(secondRoot).toBe(firstRoot);
  });
});
