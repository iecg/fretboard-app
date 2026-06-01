import type { ChordInstrumentId } from "./instruments/types";

export interface GenreStyle {
  id: string;
  label: string;
  chordInstrument: ChordInstrumentId;
  chordPattern: string;
  bassPattern: string;
  drumPattern: string;
  drumVariations: string[];
  tempoRange: [number, number];
  suggestedTempo: number;
  swing: number;
}

export const GENRE_STYLES: readonly GenreStyle[] = [
  {
    id: "pop", label: "Pop", chordInstrument: "piano",
    chordPattern: "straight-quarters", bassPattern: "root-fifth",
    drumPattern: "pop", drumVariations: ["open-hat-and-of-4", "fill-every-4"],
    tempoRange: [100, 130], suggestedTempo: 115, swing: 0,
  },
  {
    id: "rock", label: "Rock", chordInstrument: "strum",
    chordPattern: "pop-8ths", bassPattern: "pedal",
    drumPattern: "rock", drumVariations: ["open-hat-and-of-4", "crash-bar-1", "fill-every-4"],
    tempoRange: [110, 140], suggestedTempo: 120, swing: 0,
  },
  {
    id: "blues", label: "Blues", chordInstrument: "organ",
    chordPattern: "shuffle-comp", bassPattern: "shuffle",
    drumPattern: "blues-shuffle", drumVariations: ["blues-fill-4"],
    tempoRange: [70, 110], suggestedTempo: 85, swing: 0.33,
  },
  {
    id: "jazz", label: "Jazz", chordInstrument: "piano",
    chordPattern: "jazz-comp", bassPattern: "walking",
    drumPattern: "jazz-ride", drumVariations: ["jazz-turnaround-4"],
    tempoRange: [100, 160], suggestedTempo: 130, swing: 0.33,
  },
  {
    id: "ballad", label: "Ballad", chordInstrument: "piano",
    chordPattern: "ballad-whole", bassPattern: "arpeggiated",
    drumPattern: "ballad", drumVariations: [],
    tempoRange: [60, 80], suggestedTempo: 70, swing: 0,
  },
  {
    id: "funk", label: "Funk", chordInstrument: "strum",
    chordPattern: "funk-scratch", bassPattern: "funk-syncopated",
    drumPattern: "funk", drumVariations: ["open-hat-and-of-4", "funk-fill-4"],
    tempoRange: [96, 120], suggestedTempo: 110, swing: 0,
  },
  {
    id: "bossa-nova", label: "Bossa Nova", chordInstrument: "piano",
    chordPattern: "bossa-comp", bassPattern: "bossa",
    drumPattern: "bossa", drumVariations: [],
    tempoRange: [120, 140], suggestedTempo: 130, swing: 0,
  },
];

export function getGenreStyle(id: string): GenreStyle | undefined {
  return GENRE_STYLES.find((g) => g.id === id);
}
