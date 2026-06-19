import { useAtom } from "jotai";
import { useMemo } from "react";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { beatsPerBarAtom, timeSignatureDenominatorAtom } from "@fretflow/fretboard/store/progressionAtoms";
import type { TimeSignatureDenominator } from "@fretflow/fretboard/store/progressionAtoms";
import { useTranslation } from "../../hooks/useTranslation";

const SIGNATURES: ReadonlyArray<{ beats: number; denominator: TimeSignatureDenominator }> = [
  { beats: 2, denominator: 4 },
  { beats: 3, denominator: 4 },
  { beats: 4, denominator: 4 },
  { beats: 5, denominator: 4 },
  { beats: 6, denominator: 8 },
  { beats: 7, denominator: 8 },
  { beats: 9, denominator: 8 },
  { beats: 12, denominator: 8 },
];

function signatureId(beats: number, denominator: number): string {
  return `${beats}/${denominator}`;
}

export function TimeSignaturePicker() {
  const { t } = useTranslation();
  const [beats, setBeats] = useAtom(beatsPerBarAtom);
  const [denominator, setDenominator] = useAtom(timeSignatureDenominatorAtom);

  const value = signatureId(beats, denominator);

  const options = useMemo(
    () =>
      SIGNATURES.map((s) => ({
        value: signatureId(s.beats, s.denominator),
        label: signatureId(s.beats, s.denominator),
      })),
    [],
  );

  const handleChange = (id: string) => {
    const selected = SIGNATURES.find(
      (s) => signatureId(s.beats, s.denominator) === id,
    );
    if (!selected) return;
    setBeats(selected.beats);
    setDenominator(selected.denominator);
  };

  return (
    <LabeledSelect
      label={t("inspector.timeSignatureAriaLabel")}
      hideLabel
      width="fill"
      value={value}
      options={options}
      onChange={handleChange}
    />
  );
}
