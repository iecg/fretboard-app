import { lazy, Suspense, startTransition, useMemo } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { SCALE_FAMILIES, type ScaleFamily, type ScaleFamilyId } from "@fretflow/core";
import type { LabeledSelectGroup } from "../LabeledSelect/LabeledSelect";
import { LabeledSelect } from "../LabeledSelect/LabeledSelect";
import { setRootNoteAtom, setScaleNameAtom } from "../../store/actions";
import { enharmonicDisplayAtom } from "../../store/audioAtoms";
import { rootNoteAtom, scaleNameAtom, useFlatsAtom, scaleVisibleAtom } from "../../store/scaleAtoms";
import { GroupHeader, Prop, PropGrid } from "./InspectorGrid";
import { CircleOfFifthsSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { FingeringPatternControls } from "../FingeringPatternControls/FingeringPatternControls";
import { RootNoteSelect } from "../shared/RootNoteSelect";
import { Switch } from "../Switch/Switch";
import { useTranslation } from "../../hooks/useTranslation";
import useLayoutMode from "../../hooks/useLayoutMode";
import styles from "./ScaleTab.module.css";

// Look up a scale family by id; fail loudly at module init if the catalog id
// drifts. Prevents silent empty optgroups if `theoryCatalog.ts` is renamed.
function requireFamily(id: ScaleFamilyId): ScaleFamily {
  const family = SCALE_FAMILIES.find((f) => f.id === id);
  if (!family) {
    throw new Error(`theoryCatalog: scale family '${id}' not found`);
  }
  return family;
}

// Resolve scale families from the catalog once. Module-init `requireFamily`
// fails loudly if a catalog id ever drifts so empty optgroups can never
// silently appear in the UI.
const majorFamily = requireFamily("major");
const pentatonicFamily = requireFamily("pentatonic");
const bluesFamily = requireFamily("blues");
const harmonicMinorFamily = requireFamily("harmonic-minor");
const melodicMinorFamily = requireFamily("melodic-minor");

function familyOptions(family: ScaleFamily) {
  return family.members.map((m) => ({
    value: m.scaleName,
    label: m.displayLabel,
  }));
}

const CircleOfFifths = lazy(() =>
  import("../CircleOfFifths/CircleOfFifths").then((m) => ({
    default: m.CircleOfFifths,
  })),
);

export function ScaleTab() {
  const { t } = useTranslation();
  const rootNote = useAtomValue(rootNoteAtom);
  const setRootNote = useSetAtom(setRootNoteAtom);
  const scaleName = useAtomValue(scaleNameAtom);
  const setScaleName = useSetAtom(setScaleNameAtom);
  const useFlats = useAtomValue(useFlatsAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);
  const { tier } = useLayoutMode();
  const [visible, setVisible] = useAtom(scaleVisibleAtom);

  const handleRootNote = (note: string) => {
    startTransition(() => {
      setRootNote(note);
    });
  };

  const handleScaleName = (name: string) => {
    startTransition(() => {
      setScaleName(name);
    });
  };

  // Translated group labels — content (Greek mode names like Ionian/Dorian) is
  // catalog-sourced and intentionally not localized; the *group headings* and
  // the picker's accessible name are.
  const scaleGroups: LabeledSelectGroup[] = useMemo(
    () => [
      { groupLabel: t("inspector.scaleGroupMajorModes"), options: familyOptions(majorFamily) },
      { groupLabel: t("inspector.scaleGroupPentatonics"), options: familyOptions(pentatonicFamily) },
      { groupLabel: t("inspector.scaleGroupBlues"), options: familyOptions(bluesFamily) },
      {
        groupLabel: t("inspector.scaleGroupHarmonicMelodic"),
        options: [
          ...familyOptions(harmonicMinorFamily),
          ...familyOptions(melodicMinorFamily),
        ],
      },
    ],
    [t],
  );

  return (
    <div className={styles.root} data-inspector-tab="scale">
      <div className={styles.layerVisibilityRow}>
        <Switch
          label={t("inspector.scaleLayer")}
          checked={visible}
          onChange={setVisible}
        />
        <span aria-hidden="true">{t("inspector.scaleLayer")}</span>
      </div>
      <div className={styles.fingeringRow}>
        <PropGrid columns={tier === "mobile" ? 2 : 6}>
          <FingeringPatternControls />
        </PropGrid>
      </div>
      <div className={styles.columns}>
        <div className={styles.col}>
          <GroupHeader>{t("inspector.groupKey")}</GroupHeader>
          <PropGrid columns={2}>
            <Prop label={t("controls.root")} span={2}>
              <RootNoteSelect
                value={rootNote}
                onSelect={handleRootNote}
                useFlats={useFlats}
              />
            </Prop>
            <Prop label={t("inspector.scaleLabel")} span={2}>
              <LabeledSelect
                label={t("inspector.scaleLabel")}
                value={scaleName}
                groups={scaleGroups}
                onChange={handleScaleName}
                hideLabel
              />
            </Prop>
          </PropGrid>
        </div>
        <div className={styles.col} data-scale-col="wheel">
          <GroupHeader>{t("inspector.groupWheel")}</GroupHeader>
          <Suspense fallback={<CircleOfFifthsSkeleton />}>
            <CircleOfFifths
              rootNote={rootNote}
              setRootNote={setRootNote}
              scaleName={scaleName}
              useFlats={useFlats}
              enharmonicDisplay={enharmonicDisplay}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
