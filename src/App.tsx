import { useState, useMemo } from "react";
import { Fretboard } from "./Fretboard";
import {
  SCALES,
  CHORDS,
  NOTES,
  getScaleNotes,
  getChordNotes,
  getNoteDisplay,
} from "./theory";
import { STANDARD_TUNING, TUNINGS } from "./guitar";
import { Music, Settings2, Volume2, VolumeX, ChevronDown } from "lucide-react";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  type CagedShape,
  type CellColor,
} from "./shapes";
import "./App.css";

type FingeringPattern = "all" | "caged" | "3nps";

// Inline dropdown drawer component
function DrawerSelector({
  label,
  value,
  options,
  onSelect,
  nullable = false,
}: {
  label: string;
  value: string | null;
  options: string[];
  onSelect: (opt: string | null) => void;
  nullable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="drawer-selector">
      <button className="drawer-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="drawer-label">{label}</span>
        <span className="drawer-value">{value ?? "None"}</span>
        <ChevronDown className={`drawer-chevron ${open ? "open" : ""}`} />
      </button>
      {open && (
        <div className="drawer-options custom-scrollbar">
          {nullable && (
            <button
              className={`drawer-option ${value === null ? "active" : ""}`}
              onClick={() => { onSelect(null); setOpen(false); }}
            >
              None
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt}
              className={`drawer-option ${value === opt ? "active" : ""}`}
              onClick={() => { onSelect(opt); setOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  // Scale
  const [rootNote, setRootNote] = useState<string>("C");
  const [scaleName, setScaleName] = useState<string>("Major");

  // Chord overlay — fully independent
  const [chordRoot, setChordRoot] = useState<string>("C");
  const [chordType, setChordType] = useState<string | null>(null);
  const [linkChordRoot, setLinkChordRoot] = useState<boolean>(true);
  const [hideNonChordNotes, setHideNonChordNotes] = useState<boolean>(false);

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useState<FingeringPattern>("all");
  const [cagedShape, setCagedShape] = useState<CagedShape | "all">("all");
  const [npsPosition, setNpsPosition] = useState<number>(0);

  // Display
  const [displayFormat, setDisplayFormat] = useState<"notes" | "degrees">("notes");
  const [tuningName, setTuningName] = useState<string>("Standard");
  const [fretZoom, setFretZoom] = useState<number>(45);

  // Audio
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const END_FRET = 22;
  const currentTuning = TUNINGS[tuningName] || STANDARD_TUNING;

  // When root note changes, keep chord root linked if toggled
  const handleSetRootNote = (note: string) => {
    setRootNote(note);
    if (linkChordRoot) setChordRoot(note);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    synth.setMute(nextMute);
  };

  // Compute active chord tones (independent of scale)
  const chordTones = useMemo(() => {
    if (!chordType) return [];
    return getChordNotes(chordRoot, chordType);
  }, [chordRoot, chordType]);

  const { highlightNotes, boxBounds, cellColorMap } = useMemo(() => {
    let coords: string[] = [];
    let bounds: { minFret: number; maxFret: number }[] = [];
    let colorMap: Record<string, CellColor> = {};

    if (fingeringPattern === "caged") {
      if (cagedShape === "all") {
        const allCoords = new Set<string>();
        const allBounds: { minFret: number; maxFret: number }[] = [];
        const mergedColorMap: Record<string, CellColor> = {};
        for (const shape of CAGED_SHAPES) {
          const res = getCagedCoordinates(rootNote, shape, scaleName, currentTuning, 24);
          res.coordinates.forEach((c) => allCoords.add(c));
          allBounds.push(...res.bounds);
          for (const [key, entry] of Object.entries(res.cellColorMap ?? {})) {
            const existing = mergedColorMap[key];
            if (existing && existing.isRightEdge && entry.isLeftEdge) {
              mergedColorMap[key] = { color: entry.color, isLeftEdge: false, isRightEdge: false, splitColor: existing.color };
            } else {
              mergedColorMap[key] = entry;
            }
          }
        }
        coords = Array.from(allCoords);
        bounds = allBounds;
        colorMap = mergedColorMap;
      } else {
        const res = getCagedCoordinates(rootNote, cagedShape, scaleName, currentTuning, 24);
        coords = res.coordinates;
        bounds = res.bounds;
        colorMap = res.cellColorMap ?? {};
      }
    } else if (fingeringPattern === "3nps") {
      if (npsPosition === 0) {
        coords = getScaleNotes(rootNote, scaleName);
      } else {
        const res = get3NPSCoordinates(rootNote, scaleName, currentTuning, 24, npsPosition);
        coords = res.coordinates;
        bounds = res.bounds;
      }
    } else {
      coords = getScaleNotes(rootNote, scaleName);
    }

    return { highlightNotes: coords, boxBounds: bounds, cellColorMap: colorMap };
  }, [rootNote, scaleName, fingeringPattern, cagedShape, npsPosition, currentTuning]);

  const summaryNotes = useMemo(() => getScaleNotes(rootNote, scaleName), [rootNote, scaleName]);

  const summaryLabel = (() => {
    const root = getNoteDisplay(rootNote, rootNote);
    let label = `${root} ${scaleName}`;
    if (chordType) label += ` + ${getNoteDisplay(chordRoot, chordRoot)} ${chordType}`;
    if (fingeringPattern === "caged")
      label += cagedShape === "all" ? " — All CAGED" : ` — ${cagedShape} Shape`;
    else if (fingeringPattern === "3nps")
      label += npsPosition === 0 ? " — All Positions" : ` — Position ${npsPosition}`;
    return label;
  })();

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Music className="icon" />
          </div>
          <div className="title-container">
            <h1>FretFlow</h1>
            <p>Interactive Fretboard & Music Theory</p>
          </div>
        </div>
        <button onClick={toggleMute} className="mute-btn" title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <VolumeX className="icon icon-muted" /> : <Volume2 className="icon icon-active" />}
        </button>
      </header>

      {/* Main Fretboard */}
      <main className="main-fretboard">
        <Fretboard
          tuning={currentTuning}
          highlightNotes={highlightNotes}
          rootNote={rootNote}
          endFret={END_FRET}
          boxBounds={boxBounds}
          chordTones={chordTones}
          hideNonChordNotes={hideNonChordNotes}
          displayFormat={displayFormat}
          cellColorMap={cellColorMap}
          fretZoom={fretZoom}
          onZoomChange={setFretZoom}
        />
      </main>

      {/* Controls Panel */}
      <div className="controls-panel">

        {/* Col 1: Settings */}
        <div className="control-group">
          <h2><Settings2 className="icon" /> Settings</h2>

          <div className="control-section">
            <span className="section-label">Fingering Pattern</span>
            <div className="toggle-group">
              {(["all", "caged", "3nps"] as FingeringPattern[]).map((fp) => (
                <button key={fp} className={`toggle-btn ${fingeringPattern === fp ? "active" : ""}`}
                  onClick={() => setFingeringPattern(fp)}>
                  {fp === "all" ? "All" : fp.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {fingeringPattern === "caged" && (
            <div className="control-section">
              <span className="section-label">Shape</span>
              <div className="toggle-group">
                <button className={`toggle-btn ${cagedShape === "all" ? "active" : ""}`} onClick={() => setCagedShape("all")}>All</button>
                {CAGED_SHAPES.map((s) => (
                  <button key={s} className={`toggle-btn ${cagedShape === s ? "active" : ""}`} onClick={() => setCagedShape(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {fingeringPattern === "3nps" && (
            <div className="control-section">
              <span className="section-label">Position</span>
              <div className="toggle-group">
                <button className={`toggle-btn ${npsPosition === 0 ? "active" : ""}`} onClick={() => setNpsPosition(0)}>All</button>
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <button key={p} className={`toggle-btn ${npsPosition === p ? "active" : ""}`} onClick={() => setNpsPosition(p)}>{p}</button>
                ))}
              </div>
            </div>
          )}

          <div className="control-section">
            <span className="section-label">Display</span>
            <div className="toggle-group">
              {(["notes", "degrees"] as const).map((fmt) => (
                <button key={fmt} className={`toggle-btn ${displayFormat === fmt ? "active" : ""}`}
                  onClick={() => setDisplayFormat(fmt)}>
                  {fmt === "notes" ? "Notes" : "Intervals"}
                </button>
              ))}
            </div>
          </div>

          <label className="tuning-select-label">
            <span>Tuning</span>
            <select value={tuningName} onChange={(e) => setTuningName(e.target.value)} className="tuning-select">
              {Object.keys(TUNINGS).map((pt) => <option key={pt} value={pt}>{pt}</option>)}
            </select>
          </label>
        </div>

        {/* Col 2: Circle of Fifths + Chord Root */}
        <div className="control-group col-span-2">
          <div className="group-header">
            <h2>Root Note</h2>
            <span className="badge">Interactive Circle</span>
          </div>
          <CircleOfFifths rootNote={rootNote} setRootNote={handleSetRootNote} />
        </div>

        {/* Col 3: Scale & Chord drawers */}
        <div className="control-group">
          <h2>Scale & Chord</h2>

          <DrawerSelector
            label="Scale"
            value={scaleName}
            options={Object.keys(SCALES)}
            onSelect={(v) => v && setScaleName(v)}
          />

          <DrawerSelector
            label="Chord Overlay"
            value={chordType}
            options={Object.keys(CHORDS)}
            onSelect={(v) => { setChordType(v); if (v && linkChordRoot) setChordRoot(rootNote); }}
            nullable
          />

          {chordType && (
            <>
              <div className="chord-root-row">
                <label className="link-toggle">
                  <input type="checkbox" checked={linkChordRoot}
                    onChange={(e) => {
                      setLinkChordRoot(e.target.checked);
                      if (e.target.checked) setChordRoot(rootNote);
                    }} />
                  <span>Link chord root to scale</span>
                </label>
                {!linkChordRoot && (
                  <>
                    <span className="section-label">Chord Root</span>
                    <div className="note-grid">
                      {NOTES.map((n) => (
                        <button key={n} className={`note-btn ${chordRoot === n ? "active" : ""}`}
                          onClick={() => setChordRoot(n)}>
                          {getNoteDisplay(n, n)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <label className="link-toggle">
                <input type="checkbox" checked={hideNonChordNotes}
                  onChange={(e) => setHideNonChordNotes(e.target.checked)} />
                <span>Arpeggio view (hide scale)</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="summary-area">
        <div className="summary-title">{summaryLabel}:</div>
        <div className="summary-notes">
          {summaryNotes.map((n, i) => (
            <span key={i} className="summary-note">{getNoteDisplay(n, rootNote)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;

