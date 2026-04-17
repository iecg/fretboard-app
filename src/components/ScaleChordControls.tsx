import { useId } from "react";
import { DrawerSelector } from "../DrawerSelector";
import { NoteGrid } from "./NoteGrid";
import { NOTES } from "../theory";
import "./ScaleChordControls.css";
import shared from "./shared.module.css";

interface ScaleChordControlsProps {
  scaleName: string;
  setScaleName: (scale: string) => void;
  chordType: string | null;
  setChordType: (chord: string | null) => void;
  chordRoot: string;
  setChordRoot: (note: string) => void;
  linkChordRoot: boolean;
  setLinkChordRoot: (linked: boolean) => void;
  hideNonChordNotes: boolean;
  setHideNonChordNotes: (hide: boolean) => void;
  chordIntervalFilter: string;
  setChordIntervalFilter: (filter: string) => void;
  rootNote: string;
  useFlats: boolean;
  scaleOptions: (string | { divider: string })[];
  chordOptions: (string | { divider: string })[];
  chordFilterOptions: string[];
}

export function ScaleChordControls({
  scaleName,
  setScaleName,
  chordType,
  setChordType,
  chordRoot,
  setChordRoot,
  linkChordRoot,
  setLinkChordRoot,
  hideNonChordNotes,
  setHideNonChordNotes,
  chordIntervalFilter,
  setChordIntervalFilter,
  rootNote,
  useFlats,
  scaleOptions,
  chordOptions,
  chordFilterOptions,
}: ScaleChordControlsProps) {
  const linkChordRootId = useId();
  const hideNonChordNotesId = useId();

  return (
    <>
      <DrawerSelector
        label="Scale"
        value={scaleName}
        options={scaleOptions}
        onSelect={setScaleName}
      />

      <DrawerSelector
        label="Chord Overlay"
        value={chordType}
        options={chordOptions}
        onSelect={(v: string | null) => {
          setChordType(v);
          if (v && linkChordRoot) setChordRoot(rootNote);
        }}
        nullable
      />

      {chordType && (
        <>
          <div className={shared["chord-root-row"]}>
            <label className={shared["link-toggle"]} htmlFor={linkChordRootId}>
              <input
                id={linkChordRootId}
                type="checkbox"
                checked={linkChordRoot}
                onChange={(e) => {
                  setLinkChordRoot(e.target.checked);
                  if (e.target.checked) setChordRoot(rootNote);
                }}
              />
              <span>Link chord root to scale</span>
            </label>
            {!linkChordRoot && (
              <>
                <span className={shared["section-label"]}>Chord Root</span>
                <NoteGrid
                  notes={NOTES}
                  selected={chordRoot}
                  onSelect={setChordRoot}
                  useFlats={useFlats}
                />
              </>
            )}
          </div>

          <label className={shared["link-toggle"]} htmlFor={hideNonChordNotesId}>
            <input
              id={hideNonChordNotesId}
              type="checkbox"
              checked={hideNonChordNotes}
              onChange={(e) => setHideNonChordNotes(e.target.checked)}
            />
            <span>Chord only (hide scale)</span>
          </label>

          <DrawerSelector
            label="Interval Filter"
            value={chordIntervalFilter}
            options={chordFilterOptions}
            onSelect={setChordIntervalFilter}
          />
        </>
      )}
    </>
  );
}
