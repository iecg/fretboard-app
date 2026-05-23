import { useAtom, useAtomValue } from "jotai";
import {
  voicingStringSetAtom,
  stringSetOptionsAtom,
} from "../../store/chordOverlayAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { StringSetPicker } from "../shared/StringSetPicker";

/**
 * Picks which consecutive-string window the Close voicing engine should
 * restrict candidates to. Rendered only when voicing === "close" by the
 * parent ChordOverlayControls.
 */
export function ChordStringSetPicker() {
  const { t } = useTranslation();
  const [value, setValue] = useAtom(voicingStringSetAtom);
  const options = useAtomValue(stringSetOptionsAtom);

  return (
    <StringSetPicker
      label={t("inspector.chordStringSetLabel")}
      allLabel={t("inspector.chordStringSetAll")}
      value={value}
      onChange={setValue}
      options={options}
      width="fixed"
      widthValue="8rem"
    />
  );
}
