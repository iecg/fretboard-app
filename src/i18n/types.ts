export interface Dictionary {
  settings: {
    title: string;
    open: string;
    close: string;
    language: string;
    sections: {
      view: string;
      instrument: string;
      appearance: string;
      notation: string;
      chordLayout: string;
      reset: string;
    };
  };
  tabs: {
    scales: string;
    chords: string;
    cof: string;
    view: string;
  };
  common: {
    mute: string;
    muteTitle: string;
    unmute: string;
    unmuteTitle: string;
    help: string;
    helpTitle: string;
    dismiss: string;
    rotateMessage: string;
  };
}

export type SupportedLanguage = "en" | "es";
