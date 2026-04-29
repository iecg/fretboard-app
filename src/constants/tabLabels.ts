export const TAB_LABELS = {
  scales: "Scales",
  chords: "Chords",
  cof: "Key",
  view: "View",
} as const;

export type TabId = keyof typeof TAB_LABELS;
