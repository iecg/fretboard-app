import { useAtomValue } from "jotai";
import { useProgressionPlaybackLoop } from "../../hooks/useProgressionPlaybackLoop";
import { progressionEnabledAtom } from "../../store/atoms";
import { ProgressionTrack } from "../ProgressionTrack/ProgressionTrack";
import { TopBandSummary } from "../TopBandSummary/TopBandSummary";

export function ProgressionSummarySlot() {
  useProgressionPlaybackLoop();
  const progressionEnabled = useAtomValue(progressionEnabledAtom);
  return progressionEnabled ? <ProgressionTrack /> : <TopBandSummary />;
}
