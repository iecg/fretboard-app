export const CHORD_TYPE_SHORT_LABELS: Record<string, string> = {
  M: "Maj",
  m: "min",
  dim: "dim",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
  "5": "5",
  "6": "M6",
  m6: "m6",
  maj7: "M7",
  m7: "m7",
  "7": "7",
  dim7: "dim7",
  m7b5: "m7♭5",
  mMaj7: "mM7",
};

export const CHORD_TYPE_DISPLAY_ORDER: readonly string[] = [
  "M",
  "m",
  "dim",
  "aug",
  "sus2",
  "sus4",
  "5",
  "6",
  "m6",
  "maj7",
  "m7",
  "7",
  "dim7",
  "m7b5",
  "mMaj7",
];

export const CHORD_NONE_VALUE = "__none__";
