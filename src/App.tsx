import { useState, useMemo, useRef, useEffect } from "react";
import { Fretboard } from "./Fretboard";
import {
  SCALES,
  NOTES,
  INTERVAL_NAMES,
  CHORDS,
  getScaleNotes,
  getChordNotes,
  getIntervalNotes,
  getNoteDisplay,
  getDivergentNotes,
} from "./theory";
import { STANDARD_TUNING, TUNINGS } from "./guitar";
import { Music, Settings2, Volume2, VolumeX, ChevronDown, RotateCcw } from "lucide-react";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  type CagedShape,
  type ShapePolygon,
} from "./shapes";
import "./App.css";

type FingeringPattern = "all" | "caged" | "3nps";

// Chord interval filter presets — sets of allowed semitone intervals from chord root
const CHORD_INTERVAL_FILTERS: Record<string, Set<number>> = {
  'All':           new Set([0,1,2,3,4,5,6,7,8,9,10,11]),
  'Triad':         new Set([0, 3, 4, 6, 7, 8]),
  '7th Chord':     new Set([0, 3, 4, 6, 7, 8, 10, 11]),
  'Power Chord':   new Set([0, 7]),
  'Guide Tones':   new Set([3, 4, 10, 11]),
  'Shell Voicing': new Set([0, 3, 4, 10, 11]),
  'Root & 3rd':    new Set([0, 3, 4]),
  'Root & 5th':    new Set([0, 6, 7, 8]),
  'Root & 7th':    new Set([0, 10, 11]),
  '3rd & 5th':     new Set([3, 4, 6, 7, 8]),
  '3rd & 7th':     new Set([3, 4, 10, 11]),
};
const CHORD_FILTER_OPTIONS = Object.keys(CHORD_INTERVAL_FILTERS);

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
  options: (string | { divider: string })[];
  onSelect: (opt: string | null) => void;
  nullable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="drawer-selector" ref={containerRef}>
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
          {options.map((opt, i) =>
            typeof opt === 'string' ? (
              <button
                key={opt}
                className={`drawer-option ${value === opt ? "active" : ""}`}
                onClick={() => { onSelect(opt); setOpen(false); }}
              >
                {opt}
              </button>
            ) : (
              <div key={`div-${i}`} className="drawer-divider">{opt.divider}</div>
            )
          )}
        </div>
      )}
    </div>
  );
}

const SCALE_OPTIONS: (string | { divider: string })[] = [
  { divider: 'Major Modes' },
  'Major', 'Lydian', 'Mixolydian',
  { divider: 'Minor Modes' },
  'Natural Minor', 'Dorian', 'Phrygian', 'Locrian',
  { divider: 'Harmonic' },
  'Harmonic Minor',
  { divider: 'Pentatonic' },
  'Minor Pentatonic', 'Major Pentatonic',
  { divider: 'Blues' },
  'Minor Blues', 'Major Blues',
];

const CHORD_OPTIONS: (string | { divider: string })[] = [
  { divider: 'Triads' },
  'Major Triad', 'Minor Triad', 'Diminished Triad',
  { divider: 'Seventh Chords' },
  'Major 7th', 'Minor 7th', 'Dominant 7th',
  { divider: 'Other' },
  'Power Chord (5)',
];


function App() {
  const END_FRET = 24;

  // Scale
  const [rootNote, setRootNote] = useState<string>("C");
  const [scaleName, setScaleName] = useState<string>("Major");

  // Chord overlay — fully independent
  const [chordRoot, setChordRoot] = useState<string>("C");
  const [chordType, setChordType] = useState<string | null>(null);
  const [linkChordRoot, setLinkChordRoot] = useState<boolean>(true);
  const [hideNonChordNotes, setHideNonChordNotes] = useState<boolean>(false);
  const [chordFretSpread, setChordFretSpread] = useState<number>(0);
  const [chordIntervalFilter, setChordIntervalFilter] = useState<string>("All");

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useState<FingeringPattern>("all");
  const [cagedShapes, setCagedShapes] = useState<Set<CagedShape>>(new Set(CAGED_SHAPES));
  const [npsPosition, setNpsPosition] = useState<number>(0);

  // Display
  const [displayFormat, setDisplayFormat] = useState<"notes" | "degrees" | "none">("notes");
  const [shapeLabels, setShapeLabels] = useState<"modal" | "caged" | "none">("none");
  const [tuningName, setTuningName] = useState<string>("Standard");
  const [fretZoom, setFretZoom] = useState<number>(100);
  const [fretStart, setFretStart] = useState<number>(0);
  const [fretEnd, setFretEnd] = useState<number>(END_FRET);

  // Audio
  const [isMuted, setIsMuted] = useState<boolean>(false);

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

  const handleReset = () => {
    setRootNote("C");
    setScaleName("Major");
    setChordRoot("C");
    setChordType(null);
    setLinkChordRoot(true);
    setHideNonChordNotes(false);
    setChordFretSpread(0);
    setChordIntervalFilter("All");
    setFingeringPattern("all");
    setCagedShapes(new Set(CAGED_SHAPES));
    setNpsPosition(0);
    setDisplayFormat("notes");
    setShapeLabels("none");
    setTuningName("Standard");
    setFretZoom(100);
    setFretStart(0);
    setFretEnd(END_FRET);
  };

  // Compute active chord tones (independent of scale)
  const chordTones = useMemo(() => {
    if (!chordType) return [];
    return getChordNotes(chordRoot, chordType);
  }, [chordRoot, chordType]);

  // Apply interval filter to chord tones (always preserve root)
  const filteredChordTones = useMemo(() => {
    if (!chordType || chordIntervalFilter === 'All') return chordTones;
    const allowed = CHORD_INTERVAL_FILTERS[chordIntervalFilter];
    const intervals = CHORDS[chordType];
    if (!intervals || !allowed) return chordTones;
    const filtered = intervals.filter(i => allowed.has(i));
    // Always include root (interval 0) so root-active classification stays anchored
    if (!filtered.includes(0)) filtered.unshift(0);
    return getIntervalNotes(chordRoot, filtered);
  }, [chordRoot, chordType, chordIntervalFilter, chordTones]);

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } = useMemo(() => {
    let coords: string[] = [];
    let bounds: { minFret: number; maxFret: number }[] = [];
    let polygons: ShapePolygon[] = [];
    const mergedWrappedNotes = new Set<string>();

    if (fingeringPattern === "caged") {
      const shapesToRender = CAGED_SHAPES.filter(s => cagedShapes.has(s));
      const allCoords = new Set<string>();
      const allBounds: { minFret: number; maxFret: number }[] = [];
      const allPolygons: ShapePolygon[] = [];
      for (const shape of shapesToRender) {
        const res = getCagedCoordinates(rootNote, shape, scaleName, currentTuning, 24);
        res.coordinates.forEach((c) => allCoords.add(c));
        allBounds.push(...res.bounds);
        allPolygons.push(...res.polygons);
        res.wrappedNotes.forEach((k) => mergedWrappedNotes.add(k));
      }

      coords = Array.from(allCoords);
      bounds = allBounds;
      polygons = allPolygons;
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

    return { highlightNotes: coords, boxBounds: bounds, shapePolygons: polygons, wrappedNotes: mergedWrappedNotes };
  }, [rootNote, scaleName, fingeringPattern, cagedShapes, npsPosition, currentTuning]);

  // Compute color notes: blue notes for blues scales, divergent notes for modal scales
  const colorNotes = useMemo(() => {
    const intervals = SCALES[scaleName];
    if (!intervals) return [];
    // Minor Blues: blue note is b5 (interval 6)
    if (scaleName === 'Minor Blues') {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 6) % 12]] : [];
    }
    // Major Blues: blue note is b3 (interval 3)
    if (scaleName === 'Major Blues') {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 3) % 12]] : [];
    }
    // Modal scales: notes that diverge from the reference major/minor
    return getDivergentNotes(rootNote, scaleName);
  }, [rootNote, scaleName]);

  const summaryNotes = useMemo(() => getScaleNotes(rootNote, scaleName), [rootNote, scaleName]);

  const summaryLabel = (() => {
    const root = getNoteDisplay(rootNote, rootNote);
    let label = `${root} ${scaleName}`;
    if (chordType) label += ` + ${getNoteDisplay(chordRoot, chordRoot)} ${chordType}`;
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
        <div className="header-actions">
          <button className="mute-btn" title="Settings" disabled style={{ opacity: 0.4, cursor: 'default' }}>
            <Settings2 className="icon" />
          </button>
          <button onClick={handleReset} className="mute-btn" title="Reset to defaults">
            <RotateCcw className="icon" />
          </button>
          <button onClick={toggleMute} className="mute-btn" title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <VolumeX className="icon icon-muted" /> : <Volume2 className="icon icon-active" />}
          </button>
        </div>
      </header>

      {/* Main Fretboard */}
      <main className="main-fretboard">
        <Fretboard
          tuning={currentTuning}
          highlightNotes={highlightNotes}
          rootNote={rootNote}
          startFret={fretStart}
          endFret={fretEnd}
          boxBounds={boxBounds}
          chordTones={filteredChordTones}
          chordFretSpread={chordFretSpread}
          onChordFretSpreadChange={setChordFretSpread}
          hideNonChordNotes={hideNonChordNotes}
          colorNotes={colorNotes}
          displayFormat={displayFormat}
          shapePolygons={shapePolygons}
          shapeLabels={shapeLabels}
          fretZoom={fretZoom}
          onZoomChange={setFretZoom}
          onFretStartChange={setFretStart}
          onFretEndChange={setFretEnd}
          maxFret={END_FRET}
          wrappedNotes={wrappedNotes}
        />
      </main>

      {/* Controls Panel */}
      <div className="controls-panel">

        {/* Col 1: Settings */}
        <div className="control-group">
          <h2><Settings2 className="icon" /></h2>

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
            <>
              <div className="control-section">
                <span className="section-label">Shape</span>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${cagedShapes.size === CAGED_SHAPES.length ? "active" : ""}`}
                    onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}>All</button>
                  {CAGED_SHAPES.map((s) => (
                    <button
                      key={s}
                      className={`toggle-btn ${cagedShapes.has(s) ? "active" : ""}`}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          setCagedShapes(prev => {
                            const next = new Set(prev);
                            if (next.has(s)) {
                              if (next.size > 1) next.delete(s);
                            } else {
                              next.add(s);
                            }
                            return next;
                          });
                        } else {
                          setCagedShapes(new Set([s]));
                        }
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div className="control-section">
                <span className="section-label">Shape Labels</span>
                <div className="toggle-group">
                  {(["none", "caged", "modal"] as const).map((opt) => (
                    <button key={opt} className={`toggle-btn ${shapeLabels === opt ? "active" : ""}`}
                      onClick={() => setShapeLabels(opt)}>
                      {opt === "none" ? "None" : opt === "caged" ? "CAGED" : "Modal"}
                    </button>
                  ))}
                </div>
              </div>
            </>
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
            <span className="section-label">Note Labels</span>
            <div className="toggle-group">
              {(["notes", "degrees", "none"] as const).map((fmt) => (
                <button key={fmt} className={`toggle-btn ${displayFormat === fmt ? "active" : ""}`}
                  onClick={() => setDisplayFormat(fmt)}>
                  {fmt === "notes" ? "Notes" : fmt === "degrees" ? "Intervals" : "None"}
                </button>
              ))}
            </div>
          </div>

          <DrawerSelector
            label="Tuning"
            value={tuningName}
            options={Object.keys(TUNINGS)}
            onSelect={(v) => v && setTuningName(v)}
          />
        </div>

        {/* Col 2: Circle of Fifths + Chord Root */}
        <div className="control-group col-span-2">
          <div className="group-header">
            <h2>Root Note</h2>
          </div>
          <CircleOfFifths rootNote={rootNote} setRootNote={handleSetRootNote} scaleName={scaleName} />
        </div>

        {/* Col 3: Scale & Chord drawers */}
        <div className="control-group">
          <h2>Scale & Chord</h2>

          <DrawerSelector
            label="Scale"
            value={scaleName}
            options={SCALE_OPTIONS}
            onSelect={(v) => v && setScaleName(v)}
          />

          <DrawerSelector
            label="Chord Overlay"
            value={chordType}
            options={CHORD_OPTIONS}
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
                <span>Chord only (hide scale)</span>
              </label>

              <DrawerSelector
                label="Interval Filter"
                value={chordIntervalFilter}
                options={CHORD_FILTER_OPTIONS}
                onSelect={(v) => v && setChordIntervalFilter(v)}
              />
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="summary-area">
        <div className="summary-title">{summaryLabel}:</div>
        <div className="summary-notes">
          {summaryNotes.map((n, i) => {
            const rootIdx = NOTES.indexOf(rootNote);
            const noteIdx = NOTES.indexOf(n);
            const degree = rootIdx !== -1 && noteIdx !== -1
              ? INTERVAL_NAMES[(noteIdx - rootIdx + 12) % 12]
              : null;
            return (
              <span key={i} className="summary-note">
                <span className="summary-note-name">{getNoteDisplay(n, rootNote)}</span>
                {degree && <span className="summary-note-degree">{degree}</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;

