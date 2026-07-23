import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { TUNINGS, STANDARD_TUNING } from "@fretflow/core";
import {
  MAX_FRET,
  FRET_ZOOM_OUT_MIN,
  FRET_ZOOM_MAX,
  FRET_ZOOM_DEFAULT,
  STRING_ROW_PX_OVERRIDE_MIN,
  STRING_ROW_PX_OVERRIDE_MAX,
  STRING_ROW_PX_OVERRIDE_DEFAULT,
} from "@fretflow/core";
import { k, rawStringStorage, constrainedNumberStorage, GET_ON_INIT } from "../utils/storage";

const fretCountStorage = constrainedNumberStorage({ min: 0, max: MAX_FRET, integer: true });
// The storage floor is the zoom-OUT minimum (50), not FRET_ZOOM_MIN (100):
// sub-100 values are meaningful on sheet shells (they shrink the board to fit
// more frets) and must survive persistence. Desktop renders them as auto-fit.
const fretZoomStorage = constrainedNumberStorage({
  min: FRET_ZOOM_OUT_MIN,
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

const stringRowPxOverrideStorage = constrainedNumberStorage({
  min: STRING_ROW_PX_OVERRIDE_MIN,
  max: STRING_ROW_PX_OVERRIDE_MAX,
  integer: true,
});

/** 0 = use responsive layout default; non-zero overrides the row height. */
export const stringRowPxOverrideAtom = atomWithStorage(
  k("stringRowPxOverride"),
  STRING_ROW_PX_OVERRIDE_DEFAULT,
  stringRowPxOverrideStorage,
  GET_ON_INIT,
);

export const currentTuningAtom = atom(
  (get) => TUNINGS[get(tuningNameAtom)] || STANDARD_TUNING,
);
