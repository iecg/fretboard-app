import { atom } from "jotai";

export interface ProgressionVisualFrame {
  stepIndex: number;
  globalFraction: number;
  localFraction: number;
  paused: boolean;
}

export const progressionVisualFrameAtom = atom<ProgressionVisualFrame | null>(null);
