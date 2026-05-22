import { atomWithStorage } from "jotai/utils";
import type { HandSize } from "@fretflow/core";
import { k, GET_ON_INIT, createStorage, enumValidator } from "../utils/storage";

const HAND_SIZES = ["small", "medium", "large"] as const;

const handSizeStorage = createStorage<HandSize>({
  validate: enumValidator(HAND_SIZES),
});

/**
 * The user's hand-span preference, used to filter Close voicing positions by
 * physical width. Lives in the Settings overlay (not the View tab) because it's
 * a one-time preference, not a daily-use control.
 */
export const handSizeAtom = atomWithStorage<HandSize>(
  k("handSize"),
  "medium",
  handSizeStorage,
  GET_ON_INIT,
);
