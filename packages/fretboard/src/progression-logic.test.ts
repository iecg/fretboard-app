import { describe, it, expect } from "vitest";
import {
  buildAllLayersAsync,
  getGenreStyle,
  getGenreMix,
  PROGRESSION_PRESETS,
  resolveProgressionStep,
} from "./progression-logic";

describe("progression-logic entry (Tone-free native surface)", () => {
  it("re-exports the musical-logic API", () => {
    expect(typeof buildAllLayersAsync).toBe("function");
    expect(typeof getGenreStyle).toBe("function");
    expect(typeof getGenreMix).toBe("function");
    expect(typeof resolveProgressionStep).toBe("function");
    expect(Array.isArray(PROGRESSION_PRESETS)).toBe(true);
    expect(PROGRESSION_PRESETS.length).toBeGreaterThan(0);
  });

  it("buildAllLayersAsync produces layered events for a resolved preset", async () => {
    const preset = PROGRESSION_PRESETS.find((p) => p.id === "one-five-six-four")!;
    const genre = getGenreStyle("pop")!; // use a real genre's pattern ids
    const steps = preset.steps.map((s, i) => resolveProgressionStep(s, preset.scale, "C", i, false));
    const layers = await buildAllLayersAsync({
      steps, tempoBpm: 90, beatsPerBar: 4, swing: genre.swing,
      chordPatternId: genre.chordPattern, bassPatternId: genre.bassPattern, drumPatternId: genre.drumPattern,
      drumVariations: genre.drumVariations, chordVariations: genre.chordVariations, bassVariations: genre.bassVariations,
      loop: true,
    });
    expect(layers.chordStrums.length).toBeGreaterThan(0);
    expect(layers.totalDurationSec).toBeGreaterThan(0);
    expect(typeof layers.chordStrums[0].time).toBe("number");
    expect(Array.isArray(layers.chordStrums[0].value.voicing)).toBe(true);
  });
});
