import { useAtomValue } from "jotai";
import { progressionEnabledAtom } from "../../store/atoms";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";

export function ProgressionSummarySlot() {
  const progressionEnabled = useAtomValue(progressionEnabledAtom);
  return progressionEnabled ? <ProgressionTrack /> : <TopBandSummary />;
}
