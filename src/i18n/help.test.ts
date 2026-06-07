import { describe, it, expect } from "vitest";
import { en } from "./en";
import { es } from "./es";

// Walks an object and yields every leaf key path.
function leafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? leafPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("i18n/help", () => {
  it("en and es expose the same help key paths", () => {
    const enPaths = leafPaths(en.help as unknown as Record<string, unknown>, "help").sort();
    const esPaths = leafPaths(es.help as unknown as Record<string, unknown>, "help").sort();
    expect(esPaths).toEqual(enPaths);
  });

  it("no help string is empty in en or es", () => {
    const resolve = (dict: typeof en, path: string): unknown =>
      path.split(".").reduce<unknown>(
        (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
        dict,
      );

    for (const [lang, dict] of Object.entries({ en, es }) as ["en" | "es", typeof en][]) {
      const paths = leafPaths(dict.help as unknown as Record<string, unknown>, "help");
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        const value = resolve(dict, path);
        expect(typeof value, `${lang}:${path}`).toBe("string");
        expect((value as string).trim().length, `${lang}:${path}`).toBeGreaterThan(0);
      }
    }
  });

  it("every diagram-only i18n key resolves in en and es", () => {
    const diagramKeys = [
      "help.sections.noteColors",
      "help.roles.root",
      "help.roles.chordTone",
      "help.roles.scaleNote",
      "help.roles.colorTone",
      "help.roles.resolution",
      "help.voiceLeading.anticipation",
      "help.voiceLeading.hold",
      "help.voiceLeading.departing",
      "help.items.voiceLeadingLabel",
      "help.items.patternCagedLabel",
      "help.items.patternNpsLabel",
      "help.layoutDiagram.mobile",
      "help.layoutDiagram.desktop",
      "help.shortcuts.play",
      "help.shortcuts.stop",
      "help.shortcuts.loop",
      "help.shortcuts.mute",
      "help.shortcuts.track1",
      "help.shortcuts.track2",
      "help.shortcuts.track3",
      "help.shortcuts.track4",
      "help.shortcuts.steps",
      "help.shortcuts.scale",
      "help.shortcuts.chord",
    ];
    const resolve = (dict: typeof en, path: string): unknown =>
      path.split(".").reduce<unknown>(
        (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
        dict,
      );
    for (const dict of [en, es] as const) {
      for (const key of diagramKeys) {
        expect(typeof resolve(dict, key), key).toBe("string");
      }
    }
  });

  it("every key referenced by HELP_TABS resolves in en and es", async () => {
    const { HELP_TABS } = await import("../components/HelpModal/helpContent");
    const dicts = { en, es } as const;

    const resolve = (dict: typeof en, path: string): unknown =>
      path.split(".").reduce<unknown>(
        (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
        dict,
      );

    const keys = HELP_TABS.flatMap((tab) => [
      tab.labelKey,
      ...tab.sections.flatMap((s) => [
        s.titleKey,
        ...s.items.flatMap((i) => [i.labelKey, i.bodyKey].filter(Boolean) as string[]),
      ]),
    ]);

    for (const lang of ["en", "es"] as const) {
      for (const key of keys) {
        expect(typeof resolve(dicts[lang], key), `${lang}:${key}`).toBe("string");
      }
    }
  });
});
