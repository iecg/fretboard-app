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

export type ChordArticulation = "muted" | "root" | "stab" | "color-stab";

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

export interface ChordHit {
  beat: number;
  velocity: number;
  style?: "staccato" | "sustained";
  /** Strum direction; up-strokes reverse the voicing order. Defaults to down. */
  direction?: StrumDirection;
  /** Note-length + voicing intent for the strum voice.
   *  "root" plays a single root note (anchor); "stab" rings a plain chord;
   *  "color-stab" rings a chord with funk extensions; "muted" chokes a plain
   *  chord short (chicken-scratch ghost). Omitted rings the patch default. */
  articulation?: ChordArticulation;
  /** Bossa LH/RH split (used when the pattern's voicing is "rootless-jazz"):
   *  "bass-root"/"bass-fifth" play a single low note (LH); "chord" plays the
   *  rootless RH voicing. Omitted behaves as "chord". */
  voiceRole?: "bass-root" | "bass-fifth" | "chord";
}

export interface ChordPattern {
  id: string;
  label: string;
  hits: readonly ChordHit[];
  /** Cell length in bars (default 1). When > 1, `hits` span 0..bars*beatsPerBar
   *  and the scheduler selects one bar per `absoluteBar % bars`. */
  bars?: number;
  /** Voicing strategy for this comp. Omitted = the default chord voicing.
   *  "rootless-jazz" = buildBossaColorVoicing (rootless 7th/9th, mid register). */
  voicing?: "rootless-jazz";
}

export interface CatalogBassHit {
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
  /** Cell length in bars (default 1). See ChordPattern.bars. */
  bars?: number;
  /** When true, on the last bar of a step that precedes a chord change the
   *  scheduler replaces this pattern's tail with a single chromatic-approach
   *  note on the bar's last beat, leading into the next chord's root (Slice 2
   *  §3.4). Omitted = the pattern plays unchanged on every bar. Leave omitted
   *  for patterns that already embed their own approach/lead-in on the last
   *  beat (e.g. `walking`), so they don't double up. */
  turnaround?: boolean;
}

export interface CatalogDrumPattern {
  id: string;
  label: string;
  kicks: readonly DrumHit[];
  snares: readonly DrumHit[];
  hats: readonly DrumHit[];
  openHats?: readonly DrumHit[];
  ride?: readonly DrumHit[];
  /** Cross-stick / rim-click voice (bossa clave). */
  crossStick?: readonly DrumHit[];
  /** Cell length in bars (default 1). See ChordPattern.bars. */
  bars?: number;
}

/** A single-bar harmonic variation that *replaces* (not layers) the base
 *  chord pattern's hits when it fires. Mirrors DrumVariation's gating fields. */
export interface ChordVariation {
  id: string;
  label: string;
  barInterval: number;
  barPhase?: number;
  hits: readonly ChordHit[];
}

/** A single-bar bass variation that *replaces* the base bass pattern's hits
 *  when it fires (applied before the §3.4 turnaround tail-swap). */
export interface BassVariation {
  id: string;
  label: string;
  barInterval: number;
  barPhase?: number;
  hits: readonly CatalogBassHit[];
}

export interface DrumVariation {
  id: string;
  label: string;
  barInterval: number;
  /** Which bar of the `barInterval` cycle this fires on (default 0). A
   *  variation fires on absolute bar N when N % barInterval === (barPhase ?? 0). */
  barPhase?: number;
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
      { beat: 0.5, velocity: 0.7, direction: "up" },
      { beat: 1.5, velocity: 0.7, direction: "up" },
      { beat: 2.5, velocity: 0.7, direction: "up" },
      { beat: 3.5, velocity: 0.7, direction: "up" },
    ],
  },
  {
    id: "shuffle-comp",
    label: "Shuffle Comp",
    hits: [
      { beat: 0, velocity: 0.9, direction: "down" },
      { beat: 1.5, velocity: 0.6, direction: "up" },
    ],
  },
  {
    id: "jazz-comp",
    label: "Jazz Comping",
    hits: [
      { beat: 0, velocity: 0.75, style: "staccato", direction: "down" },
      { beat: 1.5, velocity: 0.6, style: "staccato", direction: "up" },
      { beat: 3.5, velocity: 0.7, style: "staccato", direction: "up" },
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
    // Researched chicken-scratch (Jimmy Nolen / James Brown): a single root-note
    // anchor on the one, one plain chord stab on the 2, then two syncopated
    // color (rootless funk grip) downstroke stabs on the "&" of 3 and "&" of 4,
    // with muted ghost 16ths weaving between. Down on numbers/"&", up on "e"/"a".
    hits: [
      { beat: 0, velocity: 0.9, direction: "down", articulation: "root" },
      { beat: 0.5, velocity: 0.24, direction: "down", articulation: "muted" },
      { beat: 0.75, velocity: 0.22, direction: "up", articulation: "muted" },
      { beat: 1.0, velocity: 0.85, direction: "down", articulation: "stab" },
      { beat: 1.5, velocity: 0.24, direction: "down", articulation: "muted" },
      { beat: 1.75, velocity: 0.22, direction: "up", articulation: "muted" },
      { beat: 2.25, velocity: 0.2, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.6, direction: "down", articulation: "color-stab" },
      { beat: 2.75, velocity: 0.22, direction: "up", articulation: "muted" },
      { beat: 3.25, velocity: 0.2, direction: "up", articulation: "muted" },
      { beat: 3.5, velocity: 0.62, direction: "down", articulation: "color-stab" },
      { beat: 3.75, velocity: 0.2, direction: "up", articulation: "muted" },
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
  {
    id: "bossa-comp",
    label: "Bossa Comp",
    bars: 2,
    voicing: "rootless-jazz",
    // LH bass (root on beat 1, fifth on beat 3) + RH rootless chords on the
    // off-beats. Authentic 2-bar arc: bar 1 is the basic sparse comp (2 stabs),
    // bar 2 intensifies into a busier run of anticipated off-beat stabs (4).
    // Every hit is short (no sustain) — a plucky, detached comp.
    hits: [
      // bar 1 — basic: bass on 1 & 3, chord stabs on the & of 2 and & of 4
      { beat: 0, velocity: 0.6, voiceRole: "bass-root" },
      { beat: 1.5, velocity: 0.5, voiceRole: "chord" },
      { beat: 2, velocity: 0.55, voiceRole: "bass-fifth" },
      { beat: 3.5, velocity: 0.55, voiceRole: "chord" },
      // bar 2 — busier: chord stabs on the & of 1, 2 and 4, anticipating the
      // following beats for forward momentum.
      { beat: 4, velocity: 0.6, voiceRole: "bass-root" },
      { beat: 4.5, velocity: 0.5, voiceRole: "chord" },
      { beat: 5.5, velocity: 0.5, voiceRole: "chord" },
      { beat: 6, velocity: 0.55, voiceRole: "bass-fifth" },
      { beat: 7.5, velocity: 0.55, voiceRole: "chord" },
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
    turnaround: true,
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
    turnaround: true,
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
    turnaround: true,
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
    // JB funk, locked to the one: root anchor on beat 1, a soft root ghost on
    // the "a" of 1, an octave pop mid-bar, the fifth for color, and a b7 that
    // leads back to the root. Sparse and staccato so it interlocks with the
    // chicken-scratch guitar rather than crowding it.
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 0.75, velocity: 0.4, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.8, note: "octave", articulation: "staccato" },
      { beat: 2.5, velocity: 0.55, note: "fifth", articulation: "staccato" },
      { beat: 3.5, velocity: 0.7, note: "flat-seventh", articulation: "staccato" },
    ],
  },
  {
    id: "bossa",
    label: "Bossa Nova",
    // Root–fifth surdo (tonic–dominant alternation) — the recognizable bossa
    // pulse. The clave lock comes from the drums + comp; this stays 1-bar.
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "legato" },
      { beat: 2, velocity: 0.8, note: "fifth", articulation: "legato" },
    ],
    turnaround: true,
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
    bars: 2,
    // Soft surdo heartbeat: beats 1 & 3 of each bar.
    kicks: [
      { beat: 0, velocity: 0.5 },
      { beat: 2, velocity: 0.6 },
      { beat: 4, velocity: 0.5 },
      { beat: 6, velocity: 0.6 },
    ],
    // No backbeat snare — the cross-stick clave carries the rhythm.
    snares: [],
    // Straight 8th hats across both bars (beats 0..7.5).
    hats: [
      { beat: 0, velocity: 0.4 }, { beat: 0.5, velocity: 0.3 },
      { beat: 1, velocity: 0.4 }, { beat: 1.5, velocity: 0.3 },
      { beat: 2, velocity: 0.4 }, { beat: 2.5, velocity: 0.3 },
      { beat: 3, velocity: 0.4 }, { beat: 3.5, velocity: 0.3 },
      { beat: 4, velocity: 0.4 }, { beat: 4.5, velocity: 0.3 },
      { beat: 5, velocity: 0.4 }, { beat: 5.5, velocity: 0.3 },
      { beat: 6, velocity: 0.4 }, { beat: 6.5, velocity: 0.3 },
      { beat: 7, velocity: 0.4 }, { beat: 7.5, velocity: 0.3 },
    ],
    // 3-2 bossa clave: bar 1 @ 0, 1.5, 3 · bar 2 @ 5 (bar2 beat 1), 6.5 (bar2 "3&").
    crossStick: [
      { beat: 0, velocity: 0.8 },
      { beat: 1.5, velocity: 0.7 },
      { beat: 3, velocity: 0.75 },
      { beat: 5, velocity: 0.7 },
      { beat: 6.5, velocity: 0.8 },
    ],
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
    // Locked on the one: hardest kick on beat 1, a syncopated push on the "a"
    // of 1, and the "and of 3" anchor — three kicks that lock with the bass
    // and leave space, rather than a four-on-the-floor thump.
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
    barPhase: 3, // turnaround: fires on the 4th bar of each 4-bar group
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
    barInterval: 4,
    barPhase: 0, // fires on the 1st bar of each 4-bar group
    pattern: {
      id: "crash-bar-1-pattern",
      label: "Crash",
      kicks: [],
      snares: [],
      hats: [],
      ride: [{ beat: 0, velocity: 0.9 }],
    },
  },
  {
    id: "funk-fill-4",
    label: "Funk Turnaround Fill",
    barInterval: 4,
    barPhase: 3,
    pattern: {
      id: "funk-fill-4-pattern",
      label: "Funk Fill",
      kicks: [{ beat: 0, velocity: 0.9 }],
      snares: [
        { beat: 2, velocity: 0.4 },
        { beat: 2.5, velocity: 0.5 },
        { beat: 2.75, velocity: 0.4 },
        { beat: 3, velocity: 0.6 },
        { beat: 3.25, velocity: 0.6 },
        { beat: 3.5, velocity: 0.8 },
        { beat: 3.75, velocity: 0.9 },
      ],
      hats: [],
    },
  },
  {
    id: "jazz-turnaround-4",
    label: "Jazz Turnaround",
    barInterval: 4,
    barPhase: 3,
    pattern: {
      id: "jazz-turnaround-4-pattern",
      label: "Jazz Turnaround",
      kicks: [],
      snares: [
        { beat: 2, velocity: 0.35 },
        { beat: 2.5, velocity: 0.4 },
        { beat: 3, velocity: 0.45 },
        { beat: 3.5, velocity: 0.55 },
      ],
      hats: [],
      ride: [{ beat: 3, velocity: 0.6 }],
    },
  },
  {
    id: "blues-fill-4",
    label: "Blues Shuffle Fill",
    barInterval: 4,
    barPhase: 3,
    pattern: {
      id: "blues-fill-4-pattern",
      label: "Blues Fill",
      kicks: [{ beat: 0, velocity: 0.9 }],
      snares: [
        { beat: 2, velocity: 0.5 },
        { beat: 2.5, velocity: 0.6 },
        { beat: 3, velocity: 0.7 },
        { beat: 3.5, velocity: 0.9 },
      ],
      hats: [],
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

export const CHORD_VARIATIONS: readonly ChordVariation[] = [
  {
    id: "funk-turnaround-chord",
    label: "Funk Turnaround Comp",
    barInterval: 4,
    barPhase: 3,
    // Pushed turnaround bar: a strong stab on the one, anticipated color stabs
    // driving into the next chord.
    hits: [
      { beat: 0, velocity: 0.92, direction: "down", articulation: "stab" },
      { beat: 1.5, velocity: 0.6, direction: "up", articulation: "muted" },
      { beat: 2.5, velocity: 0.7, direction: "down", articulation: "color-stab" },
      { beat: 3.5, velocity: 0.75, direction: "down", articulation: "color-stab" },
    ],
  },
];

export const BASS_VARIATIONS: readonly BassVariation[] = [
  {
    id: "funk-turnaround-bass",
    label: "Funk Turnaround Walk",
    barInterval: 4,
    barPhase: 3,
    // Walk-up turnaround: root anchor, octave pop, then a chromatic approach
    // into the next chord on the last beat.
    hits: [
      { beat: 0, velocity: 1, note: "root", articulation: "staccato" },
      { beat: 1.5, velocity: 0.7, note: "octave", articulation: "staccato" },
      { beat: 2.5, velocity: 0.6, note: "fifth", articulation: "staccato" },
      { beat: 3, velocity: 0.8, note: "chromatic-approach", articulation: "legato" },
    ],
  },
];

export function getChordVariation(id: string): ChordVariation | undefined {
  return CHORD_VARIATIONS.find((v) => v.id === id);
}

export function getBassVariation(id: string): BassVariation | undefined {
  return BASS_VARIATIONS.find((v) => v.id === id);
}

/**
 * Pure gating predicate: does `variation` fire on the given absolute bar index?
 * Total — a non-positive `barInterval` never fires (no divide-by-zero / nonsense).
 */
export function variationFiresOnBar(
  variation: { barInterval: number; barPhase?: number },
  absoluteBar: number,
): boolean {
  if (variation.barInterval <= 0) return false;
  return absoluteBar % variation.barInterval === (variation.barPhase ?? 0);
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
 * Select the hits belonging to a single bar of a multi-bar pattern cell and
 * shift them back to bar-local beats (0..beatsPerBar). `cellBarIndex` is
 * `absoluteBar % bars`. Pure — used for 2-bar patterns (e.g. the bossa clave);
 * 1-bar patterns never call this (they keep the `repeatPatternToBeats` path).
 */
export function sliceCellToBar<T extends { beat: number }>(
  hits: readonly T[],
  cellBarIndex: number,
  beatsPerBar: number,
): T[] {
  const offset = cellBarIndex * beatsPerBar;
  return hits
    .filter((h) => h.beat >= offset && h.beat < offset + beatsPerBar)
    .map((h) => ({ ...h, beat: h.beat - offset }));
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
