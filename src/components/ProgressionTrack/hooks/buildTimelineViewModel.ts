import { tracePerf } from "../../../utils/perf/perfTrace";

export type DurationInput = { value: number; unit: "bar" | "beat" };
export type StepInput = { duration: DurationInput };

export type TimelineBlockLayout = {
  durationBars: number;
  startPercent: number;
  widthPercent: number;
};

export type TimelineStaticViewModel = {
  blockLayouts: TimelineBlockLayout[];
  totalDurationBars: number;
  totalBarsForDisplay: number;
  subdivisionsPerBar: number;
};

function durationToBars(duration: DurationInput, beatsPerBar: number): number {
  return duration.unit === "bar" ? duration.value : duration.value / beatsPerBar;
}

export function buildTimelineViewModel(
  steps: readonly StepInput[],
  beatsPerBar: number,
): TimelineStaticViewModel {
  return tracePerf("timeline-layout", { steps: steps.length, beatsPerBar }, () => {
    const total = steps.reduce(
      (acc, step) => acc + durationToBars(step.duration, beatsPerBar),
      0,
    );
    const totalDurationBars = Math.max(1, total);
    const totalBarsForDisplay = Math.max(1, Math.ceil(total));
    const subdivisionsPerBar = Math.max(1, Math.floor(beatsPerBar));

    let elapsedBars = 0;
    const blockLayouts: TimelineBlockLayout[] = steps.map((step) => {
      const durationBars = durationToBars(step.duration, beatsPerBar);
      const layout: TimelineBlockLayout = {
        durationBars,
        startPercent: (elapsedBars / totalBarsForDisplay) * 100,
        widthPercent: (durationBars / totalBarsForDisplay) * 100,
      };
      elapsedBars += durationBars;
      return layout;
    });

    return { blockLayouts, totalDurationBars, totalBarsForDisplay, subdivisionsPerBar };
  });
}
