import { k } from "../utils/storage";

/**
 * One-shot, silent migration for the v2.0 redesign. Removes localStorage keys
 * for atoms retired in v2.0. New atoms initialize themselves to their
 * defaults; the user does not see a migration UI.
 *
 * Retired keys (Plan A scope — Plans B & C extend this list):
 *   - region            (regionAtom)
 *   - chordFretSpread   (chordFretSpreadAtom)
 *
 * Idempotent: re-running on a clean store is a no-op.
 * Fail-safe: any localStorage error is swallowed so app boot proceeds.
 */
export function runV2RedesignMigration(): void {
  const KEYS_TO_RETIRE = [k("region"), k("chordFretSpread")];

  try {
    for (const key of KEYS_TO_RETIRE) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode, SecurityError, etc.). App proceeds.
  }
}
