import { k } from "../utils/storage";

const MODE_KEY = k("chordOverlayMode");
const HIDDEN_KEY = k("chordOverlayHidden");
const ROOT_OVERRIDE_KEY = k("chordRootOverride");
const QUALITY_OVERRIDE_KEY = k("chordQualityOverride");
const DEGREE_KEY = k("chordDegree");

/**
 * One-shot migration from the legacy chord-overlay-mode storage shape.
 * - `"off"` → set chordOverlayHidden = true
 * - `"manual"` / `"degree"` → cleanup only
 * Idempotent: subsequent calls find no MODE_KEY and exit.
 *
 * Phase 2.6 — paired with the model unification in Phase 2.5.
 */
export function runChordModeMigration(): void {
  // Fail open: localStorage can throw (e.g. SecurityError in private mode or
  // restricted contexts). The migration runs at startup before React mounts —
  // an uncaught throw here would crash app boot.
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw == null) return;

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw; // tolerate legacy un-encoded values
    }

    if (value === "off") {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(true));
    }

    localStorage.removeItem(MODE_KEY);
    localStorage.removeItem(ROOT_OVERRIDE_KEY);
    localStorage.removeItem(QUALITY_OVERRIDE_KEY);
    localStorage.removeItem(DEGREE_KEY);
  } catch {
    // Storage unavailable; nothing to migrate. Continue app boot.
  }
}
