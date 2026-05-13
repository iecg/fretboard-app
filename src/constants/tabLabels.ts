export const TAB_LABELS = {
  scales: "Scales",
  chords: "Chords",
  progression: "Progression",
  cof: "Key",
  view: "View",
} as const;

export type TabId = keyof typeof TAB_LABELS;
