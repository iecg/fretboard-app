import { k } from "../utils/storage";

type V2Voicing = "off" | "full" | "close";

/**
 * One-shot, silent migration for the v2.0 redesign. Maps v1 voicing-era keys
 * to the new single `voicing` atom and removes retired localStorage keys.
 * New atoms initialize themselves to their defaults; the user does not see
 * a migration UI.
 *
 * Retired keys:
 *   - region                 (regionAtom)
 *   - chordFretSpread        (chordFretSpreadAtom)
 *   - voicingType            (voicingTypeAtom)
 *   - voicingInversion       (voicingInversionAtom)
 *   - voicingStringSet       (voicingStringSetAtom)
 *   - voicingConnectors      (voicingConnectorsAtom)
 *   - voicingSectionExpanded (voicingSectionExpandedAtom)
 *
 * Migration mapping (v1 → v2 `voicing`):
 *   - voicingConnectors === false  → "off"          (precedence: connectors-off wins)
 *   - voicingType === "caged"      → "full"
 *   - voicingType === "drop2"      → "close"
 *   - voicingType === "triad"      → "close"
 *
 * The mapped value is only written when no `voicing` key already exists, so
 * a user who already ran v2.0 keeps their explicit choice.
 *
 * Idempotent: re-running on a clean store is a no-op.
 * Fail-safe: any localStorage error is swallowed so app boot proceeds.
 */
export function runV2RedesignMigration(): void {
  try {
    const rawType = safeParse(localStorage.getItem(k("voicingType")));
    const rawConnectors = safeParse(localStorage.getItem(k("voicingConnectors")));

    let nextVoicing: V2Voicing | null = null;
    if (rawConnectors === false) {
      nextVoicing = "off";
    } else if (rawType === "caged") {
      nextVoicing = "full";
    } else if (rawType === "drop2" || rawType === "triad") {
      nextVoicing = "close";
    }
    if (nextVoicing !== null && localStorage.getItem(k("voicing")) === null) {
      localStorage.setItem(k("voicing"), JSON.stringify(nextVoicing));
    }

    const KEYS_TO_RETIRE = [
      k("region"),
      k("chordFretSpread"),
      k("voicingType"),
      k("voicingInversion"),
      k("voicingStringSet"),
      k("voicingConnectors"),
      k("voicingSectionExpanded"),
    ];
    for (const key of KEYS_TO_RETIRE) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode, SecurityError, etc.). App proceeds.
  }
}

function safeParse(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
