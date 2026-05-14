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
    view: {
      auto: string;
      zoomSuffix: string;
      compactControls: string;
      compactAutoHint: string;
    };
    fields: {
      zoom: string;
      fretRange: string;
      scaleDegreeColors: string;
      tuning: string;
      accidentals: string;
      enharmonicDisplay: string;
      chordSpread: string;
      theme: string;
      scaleDegreeColorsHint: string;
      accidentalsHint: string;
      enharmonicDisplayHint: string;
      chordSpreadHint: string;
      themeHint: string;
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
  controls: {
    shape: string;
    position: string;
    octave: string;
    string: string;
    strings: string;
    connectors: string;
    interval: string;
    noteLabels: string;
    longPressToAdd: string;
    shiftClickToAdd: string;
    showConsecutiveSteps: string;
    pairMembersConnected: string;
    chordMode: string;
    degree: string;
    chordType: string;
    root: string;
    lens: string;
    disabled: string;
    off: string;
    on: string;
    manual: string;
    shapeHintTouch: string;
    shapeHintPointer: string;
    chordOverlayDisabled: string;
    degreeModeHint: string;
    manualModeHint: string;
    customChordHint: string;
    diatonicDefaultHint: string;
    scaleParallelHint: string;
    scaleRelativeHint: string;
  };
}

export type SupportedLanguage = "en" | "es";
