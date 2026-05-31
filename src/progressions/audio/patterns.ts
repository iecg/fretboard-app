/**
 * Beat-level patterns for the progression backing track.
 *
 * Every pattern is expressed in **beat fractions** within a bar (0 inclusive,
 * `beatsPerBar` exclusive), letting the scheduler repeat/clip a pattern to
 * any meter and tempo without owning timing math.
 *
 * Patterns are intentionally small and audition-friendly: a default rock
 * strum, a default rock drum beat, a four-on-the-floor metronome. They
 * compose at the scheduler layer rather than being a single monolithic
 * "groove" object.
 */

type StrumDirection = "down" | "up";

export type ChordArticulation = "muted" | "accent";

export interface DrumHit {
  beat: number;
  velocity: number;
}

export type BassNoteRole =
  | "root"
  | "third"
  | "fifth"
  | "octave"
  | "chromatic-approach"
  | "flat-seventh";

export type BassArticulation = "staccato" | "legato" | "normal";

interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: StrumDirection;
  /** Note-length intent for the strum voice. "muted" chokes the stroke short
   *  (chicken-scratch), "accent"/omitted rings for the patch's note duration. */
  articulation?: ChordArticulation;
}

export interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
}

interface CatalogBassHit {
  beat: number;
  velocity: number;
  note: BassNoteRole;
  /** Note length hint. Omitted === "normal" === patch-default ring. */
  articulation?: BassArticulation;
}

export interface CatalogBassPattern {
  id: string;
  label: string;
  hits: readonly CatalogBassHit[];
}

export interface CatalogDrumPattern {
  id: string;
  label: string;
  kicks: readonly DrumHit[];
  snares: readonly DrumHit[];
  hats: readonly DrumHit[];
  openHats?: readonly DrumHit[];
  ride?: readonly DrumHit[];
}

export interface DrumVariation {
  id: string;
  label: string;
  barInterval: number;
  pattern: CatalogDrumPattern;
}

const EIGHTH_HATS: readonly DrumHit[] = [
  { beat: 0, velocity: 0.55 },
  { beat: 0.5, velocity: 0.4 },
  { beat: 1, velocity: 0.55 },
  { beat: 1.5, velocity: 0.4 },
  { beat: 2, velocity: 0.55 },
  { beat: 2.5, velocity: 0.4 },
  { beat: 3, velocity: 0.55 },
  { beat: 3.5, velocity: 0.4 },
];

export const CHORD_PATTERNS: readonly ChordPattern[] = [
  {
    id: "pop-8ths",
    label: "Pop 8ths",
    hits: [
      { beat: 0, velocity: 0.95, direction: "down" },
      { beat: 1, velocity: 0.6, direction: "down" },
      { beat: 1.5, velocity: 0.55, direction: "up" },
      { beat: 2.5, velocity: 0.55, direction: "up" },
      { beat: 3, velocity: 0.7, direction: "down" },
      { beat: 3.5, velocity: 0.5, direction: "up" },
    ],
  },
  {
    id: "ballad-whole",
    label: "Ballad Whole Notes",
    hits: [{ beat: 0, velocity: 0.8, style: "sustained" }],
  },
  {
    id: "offbeat-skank",
    label: "Offbeat Skank",
    hits: [
      { beat: 0.5, velocity: 0.7 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 2.5, velocity: 0.7 },
      { beat: 3.5, velocity: 0.7 },
    ],
  },
  {
    id: "shuffle-comp",
    label: "Shuffle Comp",
    hits: [
      { beat: 0, velocity: 0.9 },
      { beat: 1.5, velocity: 0.6 },
    ],
  },
  {
    id: "jazz-comp",
    label: "Jazz Comping",
    hits: [
      { beat: 0, velocity: 0.75, style: "staccato" },
      { beat: 1.5, velocity: 0.6, style: "staccato" },
      { beat: 3.5, velocity: 0.7, style: "staccato" },
    ],
  },
  {
    id: "funk-16th",
    label: "Funk 16ths",
    // Percussive 16th-note scratch comp: a strong downbeat stab, syncopated
    // accents on the "e/a" subdivisions, and soft muted scratch strokes between
    // them. Alternating down/up strums emulate the wrist motion of funk
    // rhythm guitar. (The strum voice ignores `style`, so the percussive feel
    // comes from rhythm + velocity dynamics + strum direction, not staccato.)
    hits: [
      { beat: 0, velocity: 0.95, direction: "down" },
      { beat: 0.5, velocity: 0.3, direction: "up" },
      { beat: 0.75, velocity: 0.7, direction: "up" },
      { beat: 1.25, velocity: 0.35, direction: "down" },
      { beat: 1.5, velocity: 0.65, direction: "up" },
      { beat: 2, velocity: 0.8, direction: "down" },
      { beat: 2.5, velocity: 0.3, direction: "up" },
      { beat: 2.75, velocity: 0.7, direction: "up" },
      { beat: 3.25, velocity: 0.35, direction: "down" },
      { beat: 3.5, velocity: 0.6, direction: "up" },
    ],
  },
  {
    id: "funk-scratch",
    label: "Funk Scratch",
    // James Brown chicken-scratch: a hard accented chord stab on the one, then
    // muted scratch ghosts with deliberate space. The "muted" hits choke short
    // via the strum voice; the accent rings the patch's (already short) length.
    hits: [
      { beat: 0, velocity: 0.95, direction: "down", articulation: "accent" },
      { beat: 0.5, velocity: 0.28, direction: "up", articulation: "muted" },
      { beat: 0.75, velocity: 0.3, direction: "up", articulation: "muted" },
      { beat: 1.5, velocity: 0.4, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.28, direction: "up", articulation: "muted" },
      { beat: 2.75, velocity: 0.3, direction: "up", articulation: "muted" },
      { beat: 3.5, velocity: 0.35, direction: "up", articulation: "muted" },
    ],
  },
  {
    id: "pop-syncopated-push",
    label: "Pop Syncopated Push",
    hits: [
      { beat: 0, velocity: 0.9, direction: "down" },
      { beat: 1.5, velocity: 0.7, direction: "up" },
      { beat: 2.5, velocity: 0.8, direction: "down" },
      { beat: 3.5, velocity: 0.85, direction: "up" },
    ],
  },
  {
    id: "straight-quarters",
    label: "Straight Quarters",
    hits: [
      { beat: 0, velocity: 0.8 },
      { beat: 1, velocity: 0.6 },
      { beat: 2, velocity: 0.7 },
      { beat: 3, velocity: 0.6 },
    ],
  },
];

export const BASS_PATTERNS: readonly CatalogBassPattern[] = [
  {
    id: "root-fifth",
    label: "Root-Fifth",
    hits: [
      { beat: 0, velocity: 1, note: "root" },
      { beat: 2, velocity: 0.85, note: "fifth" },
    ],
  },
  {
    id: "walking",
    label: "Walking Bass",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 1, velocity: 0.8, note: "third", articulation: "legato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "legato" },
      { beat: 3, velocity: 0.75, note: "chromatic-approach", articulation: "legato" },
    ],
  },
  {
    id: "arpeggiated",
    label: "Arpeggiated",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 1, velocity: 0.8, note: "third", articulation: "legato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "legato" },
      { beat: 3, velocity: 0.7, note: "octave", articulation: "legato" },
    ],
  },
  {
    id: "shuffle",
    label: "Shuffle Bass",
    hits: [
      // Legato, not staccato: shuffle runs on the sustain:0 `bass-upright`
      // patch whose filter envelope closes to a 150Hz cutoff. Clipping the
      // note to staccato (~0.3·beat) leaves only a dull, near-inaudible stub.
      // Swing supplies the bounce; the upright stays connected.
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 2, velocity: 0.85, note: "fifth", articulation: "legato" },
      { beat: 3.5, velocity: 0.6, note: "root", articulation: "legato" },
    ],
  },
  {
    id: "pedal",
    label: "Pedal Tone",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 0.5, velocity: 0.55, note: "root", articulation: "staccato" },
      { beat: 1, velocity: 0.75, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.55, note: "root", articulation: "staccato" },
      { beat: 2, velocity: 0.85, note: "root", articulation: "staccato" },
      { beat: 2.5, velocity: 0.55, note: "root", articulation: "staccato" },
      { beat: 3, velocity: 0.75, note: "root", articulation: "staccato" },
      { beat: 3.5, velocity: 0.6, note: "root", articulation: "staccato" },
    ],
  },
  {
    id: "funk-syncopated",
    label: "Funk Syncopated",
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 0.75, velocity: 0.4, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.8, note: "octave", articulation: "staccato" },
      { beat: 2.5, velocity: 0.55, note: "fifth", articulation: "staccato" },
      { beat: 3.5, velocity: 0.7, note: "flat-seventh", articulation: "staccato" },
    ],
  },
];

export const DRUM_PATTERNS: readonly CatalogDrumPattern[] = [
  {
    id: "rock",
    label: "Rock",
    kicks: [
      { beat: 0, velocity: 1 },
      { beat: 1.5, velocity: 0.4 },
      { beat: 2, velocity: 0.9 },
    ],
    snares: [
      { beat: 1, velocity: 1 },
      { beat: 2.75, velocity: 0.3 },
      { beat: 3, velocity: 1 },
    ],
    hats: EIGHTH_HATS,
  },
  {
    id: "pop",
    label: "Pop",
    kicks: [
      { beat: 0, velocity: 1 },
      { beat: 1.5, velocity: 0.8 },
    ],
    snares: [
      { beat: 1, velocity: 1 },
      { beat: 2.5, velocity: 0.2 },
      { beat: 3, velocity: 1 },
    ],
    hats: EIGHTH_HATS,
  },
  {
    id: "blues-shuffle",
    label: "Blues Shuffle",
    kicks: [
      { beat: 0, velocity: 1 },
      { beat: 2, velocity: 0.9 },
    ],
    snares: [
      { beat: 1, velocity: 1 },
      { beat: 3, velocity: 1 },
    ],
    hats: EIGHTH_HATS,
  },
  {
    id: "jazz-ride",
    label: "Jazz Ride",
    kicks: [
      { beat: 0, velocity: 0.18 },
      { beat: 1, velocity: 0.15 },
      { beat: 2, velocity: 0.18 },
      { beat: 3, velocity: 0.15 },
    ],
    snares: [
      // Brush taps on the backbeat (musical 2 & 4) plus the original soft
      // ghost — gives the brushes audible presence under the ride.
      { beat: 1, velocity: 0.3 },
      { beat: 2.5, velocity: 0.22 },
      { beat: 3, velocity: 0.3 },
    ],
    hats: [
      { beat: 1, velocity: 0.5 },
      { beat: 3, velocity: 0.5 },
    ],
    ride: [
      { beat: 0, velocity: 0.55 },
      { beat: 1, velocity: 0.7 },
      { beat: 1.5, velocity: 0.4 },
      { beat: 2, velocity: 0.55 },
      { beat: 3, velocity: 0.7 },
      { beat: 3.5, velocity: 0.4 },
    ],
  },
  {
    id: "bossa",
    label: "Bossa Nova",
    kicks: [
      { beat: 0, velocity: 0.8 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 2, velocity: 0.8 },
      { beat: 3.5, velocity: 0.7 },
    ],
    snares: [
      { beat: 0, velocity: 0.7 },
      { beat: 1.5, velocity: 0.6 },
      { beat: 3, velocity: 0.7 },
    ],
    hats: EIGHTH_HATS,
  },
  {
    id: "ballad",
    label: "Ballad",
    kicks: [{ beat: 0, velocity: 0.8 }],
    snares: [{ beat: 2, velocity: 0.8 }],
    hats: [
      { beat: 0, velocity: 0.35 },
      { beat: 1, velocity: 0.3 },
      { beat: 2, velocity: 0.35 },
      { beat: 3, velocity: 0.3 },
    ],
  },
  {
    id: "funk",
    label: "Funk",
    kicks: [
      { beat: 0, velocity: 1 },
      { beat: 0.75, velocity: 0.55 },
      { beat: 2.5, velocity: 0.8 },
    ],
    snares: [
      { beat: 1, velocity: 1 },
      { beat: 1.5, velocity: 0.2 },
      { beat: 2.25, velocity: 0.18 },
      { beat: 3, velocity: 1 },
      { beat: 3.5, velocity: 0.15 },
    ],
    hats: [
      { beat: 0, velocity: 0.5 },
      { beat: 0.25, velocity: 0.3 },
      { beat: 0.5, velocity: 0.4 },
      { beat: 0.75, velocity: 0.3 },
      { beat: 1, velocity: 0.5 },
      { beat: 1.25, velocity: 0.3 },
      { beat: 1.5, velocity: 0.4 },
      { beat: 1.75, velocity: 0.3 },
      { beat: 2, velocity: 0.5 },
      { beat: 2.25, velocity: 0.3 },
      { beat: 2.5, velocity: 0.4 },
      { beat: 2.75, velocity: 0.3 },
      { beat: 3, velocity: 0.5 },
      { beat: 3.25, velocity: 0.3 },
      { beat: 3.5, velocity: 0.4 },
      { beat: 3.75, velocity: 0.3 },
    ],
  },
];

export const DRUM_VARIATIONS: readonly DrumVariation[] = [
  {
    id: "fill-every-4",
    label: "Fill Every 4 Bars",
    barInterval: 4,
    pattern: {
      id: "fill-every-4-pattern",
      label: "Fill",
      kicks: [{ beat: 0, velocity: 1 }],
      snares: [
        { beat: 2, velocity: 0.7 },
        { beat: 2.5, velocity: 0.8 },
        { beat: 3, velocity: 0.9 },
        { beat: 3.5, velocity: 1 },
      ],
      hats: [],
    },
  },
  {
    id: "open-hat-and-of-4",
    label: "Open Hat on And of 4",
    barInterval: 1,
    pattern: {
      id: "open-hat-and-of-4-pattern",
      label: "Open Hat",
      kicks: [],
      snares: [],
      hats: [],
      openHats: [{ beat: 3.5, velocity: 0.6 }],
    },
  },
  {
    id: "crash-bar-1",
    label: "Crash on Bar 1",
    barInterval: 1,
    pattern: {
      id: "crash-bar-1-pattern",
      label: "Crash",
      kicks: [],
      snares: [],
      hats: [],
      ride: [{ beat: 0, velocity: 0.9 }],
    },
  },
];

export function getChordPattern(id: string): ChordPattern | undefined {
  return CHORD_PATTERNS.find((p) => p.id === id);
}

export function getBassPattern(id: string): CatalogBassPattern | undefined {
  return BASS_PATTERNS.find((p) => p.id === id);
}

export function getDrumPattern(id: string): CatalogDrumPattern | undefined {
  return DRUM_PATTERNS.find((p) => p.id === id);
}

export function getDrumVariation(id: string): DrumVariation | undefined {
  return DRUM_VARIATIONS.find((v) => v.id === id);
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Generate metronome click events: one click per beat, with an accent on
 * beat 1. Returned dynamically because beat count depends on meter.
 */
export function buildMetronomePattern(beatsPerBar: number): readonly DrumHit[] {
  const out: DrumHit[] = [];
  for (let beat = 0; beat < beatsPerBar; beat++) {
    out.push({ beat, velocity: beat === 0 ? 0.8 : 0.5 });
  }
  return out;
}

/**
 * Filter a pattern's events to those that fall inside the requested window
 * of beats (relative to the step start). Used when a step spans a partial
 * bar — e.g. a half-bar chord change shouldn't trigger the full bar's beat 3
 * kick on its own audio segment.
 */
export function clipPatternToBeats<T extends { beat: number }>(
  pattern: readonly T[],
  beatsAvailable: number,
): T[] {
  if (beatsAvailable <= 0) return [];
  return pattern.filter((hit) => hit.beat < beatsAvailable);
}

/**
 * Repeat a one-bar pattern across the requested beat window. The repeat
 * length is the active meter, so a 2-bar chord in 4/4 receives the same
 * strum/drum/click pattern at beats 0..3.5 and 4..7.5, while a partial final
 * bar is clipped to the chord duration.
 */
export function repeatPatternToBeats<T extends { beat: number }>(
  pattern: readonly T[],
  beatsAvailable: number,
  beatsPerBar: number,
): T[] {
  if (beatsAvailable <= 0 || beatsPerBar <= 0) return [];
  const hits: T[] = [];
  for (let barStart = 0; barStart < beatsAvailable; barStart += beatsPerBar) {
    for (const hit of pattern) {
      if (hit.beat >= beatsPerBar) continue;
      const beat = barStart + hit.beat;
      if (beat >= beatsAvailable) continue;
      hits.push({ ...hit, beat });
    }
  }
  return hits;
}
