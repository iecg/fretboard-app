export interface Dictionary {
  settings: {
    title: string;
    close: string;
    language: string;
  };
  tabs: {
    scales: string;
    chords: string;
    cof: string;
    view: string;
  };
}

export type SupportedLanguage = "en" | "es";
