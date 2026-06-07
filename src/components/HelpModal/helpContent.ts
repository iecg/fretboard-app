// Drives the help modal: tabs → sections → items, each referencing i18n keys.
export type DiagramId =
  | "noteRoleLegend"
  | "shapes"
  | "voiceLeading"
  | "shortcutTable";

export interface HelpItem {
  /** i18n key for the bold lead-in label; omit for plain paragraphs. */
  labelKey?: string;
  /** i18n key for the body text. */
  bodyKey: string;
}

export interface HelpSection {
  /** i18n key for the section heading. */
  titleKey: string;
  /** Optional diagram rendered below the heading. */
  diagram?: DiagramId;
  items: HelpItem[];
}

export interface HelpTab {
  id: "start" | "notes" | "shapes" | "play" | "settings";
  labelKey: string;
  sections: HelpSection[];
}

/** Id of the current What's-new notice. Bump when the notice copy changes. */
export const CURRENT_WHATS_NEW_ID = "2026-06-progressions";

export const HELP_TABS: HelpTab[] = [
  {
    id: "start",
    labelKey: "help.tabs.start",
    sections: [
      {
        titleKey: "help.sections.gettingStarted",
        items: [{ bodyKey: "help.items.introBody" }],
      },
      {
        titleKey: "help.sections.layout",
        items: [
          { labelKey: "help.items.layoutMobileLabel", bodyKey: "help.items.layoutMobileBody" },
          { labelKey: "help.items.layoutDesktopLabel", bodyKey: "help.items.layoutDesktopBody" },
        ],
      },
      {
        titleKey: "help.sections.inspector",
        items: [
          { labelKey: "help.items.inspectorOverlayLabel", bodyKey: "help.items.inspectorOverlayBody" },
          { labelKey: "help.items.inspectorSongLabel", bodyKey: "help.items.inspectorSongBody" },
        ],
      },
    ],
  },
  {
    id: "notes",
    labelKey: "help.tabs.notes",
    sections: [
      {
        titleKey: "help.sections.noteColors",
        diagram: "noteRoleLegend",
        items: [{ bodyKey: "help.items.noteColorsBody" }],
      },
      {
        titleKey: "help.sections.noteLabels",
        items: [{ labelKey: "help.items.noteLabelsLabel", bodyKey: "help.items.noteLabelsBody" }],
      },
      {
        titleKey: "help.sections.hearNotes",
        items: [{ bodyKey: "help.items.hearNotesBody" }],
      },
    ],
  },
  {
    id: "shapes",
    labelKey: "help.tabs.shapes",
    sections: [
      {
        titleKey: "help.sections.choosingKey",
        items: [{ labelKey: "help.items.keyLabel", bodyKey: "help.items.keyBody" }],
      },
      {
        titleKey: "help.sections.patterns",
        diagram: "shapes",
        items: [
          { labelKey: "help.items.patternLabel", bodyKey: "help.items.patternBody" },
          { labelKey: "help.items.patternCagedLabel", bodyKey: "help.items.patternCagedBody" },
          { labelKey: "help.items.patternNpsLabel", bodyKey: "help.items.patternNpsBody" },
        ],
      },
      {
        titleKey: "help.sections.chordsVoicings",
        items: [
          { labelKey: "help.items.voicingLabel", bodyKey: "help.items.voicingBody" },
          { labelKey: "help.items.stringSetLabel", bodyKey: "help.items.stringSetBody" },
        ],
      },
    ],
  },
  {
    id: "play",
    labelKey: "help.tabs.play",
    sections: [
      {
        titleKey: "help.sections.chords",
        items: [{ bodyKey: "help.items.chordsBody" }],
      },
      {
        titleKey: "help.sections.buildProgression",
        items: [
          { labelKey: "help.items.presetLabel", bodyKey: "help.items.presetBody" },
          { labelKey: "help.items.sequenceLabel", bodyKey: "help.items.sequenceBody" },
          { labelKey: "help.items.timeLabel", bodyKey: "help.items.timeBody" },
        ],
      },
      {
        titleKey: "help.sections.backingTrack",
        items: [{ bodyKey: "help.items.backingTrackBody" }],
      },
      {
        titleKey: "help.sections.playback",
        diagram: "voiceLeading",
        items: [
          { labelKey: "help.items.transportLabel", bodyKey: "help.items.transportBody" },
          { labelKey: "help.items.voiceLeadingLabel", bodyKey: "help.items.voiceLeadingBody" },
        ],
      },
    ],
  },
  {
    id: "settings",
    labelKey: "help.tabs.settings",
    sections: [
      {
        titleKey: "help.sections.settings",
        items: [{ bodyKey: "help.items.settingsBody" }],
      },
      {
        titleKey: "help.sections.shortcuts",
        diagram: "shortcutTable",
        items: [{ bodyKey: "help.items.shortcutsBody" }],
      },
    ],
  },
];
