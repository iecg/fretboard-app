import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { TUNINGS, STANDARD_TUNING } from "../guitar";
import { MAX_FRET, FRET_ZOOM_MIN, FRET_ZOOM_MAX, FRET_ZOOM_DEFAULT } from "../constants";
import { k, rawStringStorage, constrainedNumberStorage, GET_ON_INIT } from "../utils/storage";

const fretCountStorage = constrainedNumberStorage({ min: 0, max: MAX_FRET, integer: true });
const fretZoomStorage = constrainedNumberStorage({
  min: FRET_ZOOM_MIN,
  max: FRET_ZOOM_MAX,
  integer: true,
});

export const tuningNameAtom = atomWithStorage(
  k("tuningName"),
  "Standard",
  rawStringStorage(),
  GET_ON_INIT,
);

export const fretZoomAtom = atomWithStorage(
  k("fretZoom"),
  FRET_ZOOM_DEFAULT,
  fretZoomStorage,
  GET_ON_INIT,
);

export const fretStartAtom = atomWithStorage(
  k("fretStart"),
  0,
  fretCountStorage,
  GET_ON_INIT,
);

export const fretEndAtom = atomWithStorage(
  k("fretEnd"),
  MAX_FRET,
  fretCountStorage,
  GET_ON_INIT,
);

export const currentTuningAtom = atom(
  (get) => TUNINGS[get(tuningNameAtom)] || STANDARD_TUNING,
);