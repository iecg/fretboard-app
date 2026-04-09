import { useState, useMemo, useEffect } from "react";
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
  getNoteDisplayInScale,
  getDivergentNotes,
  formatAccidental,
} from "./theory";
import { STANDARD_TUNING, TUNINGS } from "./guitar";
import {
  Music,
  Settings2,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";
import { synth } from "./audio";
import { CircleOfFifths } from "./CircleOfFifths";
import { DEGREE_COLORS, getDegreesForScale } from "./degrees";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  type CagedShape,
  type ShapePolygon,
} from "./shapes";
import { DrawerSelector } from "./DrawerSelector";
import "./App.css";


type FingeringPattern = "all" | "caged" | "3nps";

// Chord interval filter presets — sets of allowed semitone intervals from chord root
const CHORD_INTERVAL_FILTERS: Record<string, Set<number>> = {
  All: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  Triad: new Set([0, 3, 4, 6, 7, 8]),
  "7th Chord": new Set([0, 3, 4, 6, 7, 8, 10, 11]),
  "Power Chord": new Set([0, 7]),
  "Guide Tones": new Set([3, 4, 10, 11]),
  "Shell Voicing": new Set([0, 3, 4, 10, 11]),
  "Root & 3rd": new Set([0, 3, 4]),
  "Root & 5th": new Set([0, 6, 7, 8]),
  "Root & 7th": new Set([0, 10, 11]),
  "3rd & 5th": new Set([3, 4, 6, 7, 8]),
  "3rd & 7th": new Set([3, 4, 10, 11]),
};
const CHORD_FILTER_OPTIONS = Object.keys(CHORD_INTERVAL_FILTERS);

const SCALE_OPTIONS: (string | { divider: string })[] = [
  { divider: "Major Modes" },
  "Major",
  "Lydian",
  "Mixolydian",
  { divider: "Minor Modes" },
  "Natural Minor",
  "Dorian",
  "Phrygian",
  "Locrian",
  { divider: "Harmonic" },
  "Harmonic Minor",
  { divider: "Pentatonic" },
  "Minor Pentatonic",
  "Major Pentatonic",
  { divider: "Blues" },
  "Minor Blues",
  "Major Blues",
];

const CHORD_OPTIONS: (string | { divider: string })[] = [
  { divider: "Triads" },
  "Major Triad",
  "Minor Triad",
  "Diminished Triad",
  { divider: "Seventh Chords" },
  "Major 7th",
  "Minor 7th",
  "Dominant 7th",
  { divider: "Other" },
  "Power Chord (5)",
];

function App() {
  const END_FRET = 24;

  // Scale
  const [rootNote, setRootNote] = useState<string>(() => localStorage.getItem('rootNote') ?? 'C');
  const [scaleName, setScaleName] = useState<string>(() => localStorage.getItem('scaleName') ?? 'Major');

  // Chord overlay — fully independent
  const [chordRoot, setChordRoot] = useState<string>(() => localStorage.getItem('chordRoot') ?? 'C');
  const [chordType, setChordType] = useState<string | null>(() => {
    const saved = localStorage.getItem('chordType');
    return saved !== null ? (saved === '' ? null : saved) : null;
  });
  const [linkChordRoot, setLinkChordRoot] = useState<boolean>(() => {
    const saved = localStorage.getItem('linkChordRoot');
    return saved !== null ? saved === 'true' : true;
  });
  const [hideNonChordNotes, setHideNonChordNotes] = useState<boolean>(() => {
    const saved = localStorage.getItem('hideNonChordNotes');
    return saved !== null ? saved === 'true' : false;
  });
  const [chordFretSpread, setChordFretSpread] = useState<number>(() => {
    const saved = localStorage.getItem('chordFretSpread');
    return saved !== null ? Number(saved) : 0;
  });
  const [chordIntervalFilter, setChordIntervalFilter] = useState<string>(() => localStorage.getItem('chordIntervalFilter') ?? 'All');

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useState<FingeringPattern>(() => {
    const saved = localStorage.getItem('fingeringPattern');
    return (saved as FingeringPattern) ?? 'all';
  });
  const [cagedShapes, setCagedShapes] = useState<Set<CagedShape>>(() => {
    const saved = localStorage.getItem('cagedShapes');
    if (saved !== null) {
      try {
        return new Set(JSON.parse(saved) as CagedShape[]);
      } catch {
        // fall through to default
      }
    }
    return new Set(CAGED_SHAPES);
  });
  const [npsPosition, setNpsPosition] = useState<number>(() => {
    const saved = localStorage.getItem('npsPosition');
    return saved !== null ? Number(saved) : 0;
  });

  // Display
  const [displayFormat, setDisplayFormat] = useState<"notes" | "degrees" | "none">(() => {
    const saved = localStorage.getItem('displayFormat');
    return (saved as "notes" | "degrees" | "none") ?? 'notes';
  });
  const [shapeLabels, setShapeLabels] = useState<"modal" | "caged" | "none">(() => {
    const saved = localStorage.getItem('shapeLabels');
    return (saved as "modal" | "caged" | "none") ?? 'none';
  });
  const [tuningName, setTuningName] = useState<string>(() => localStorage.getItem('tuningName') ?? 'Standard');
  const [fretZoom, setFretZoom] = useState<number>(() => {
    const saved = localStorage.getItem('fretZoom');
    return saved !== null ? Number(saved) : 100;
  });
  const [fretStart, setFretStart] = useState<number>(() => {
    const saved = localStorage.getItem('fretStart');
    return saved !== null ? Number(saved) : 0;
  });
  const [fretEnd, setFretEnd] = useState<number>(() => {
    const saved = localStorage.getItem('fretEnd');
    return saved !== null ? Number(saved) : END_FRET;
  });

  // Accidentals
  const [useFlats, setUseFlats] = useState<boolean>(() => {
    const saved = localStorage.getItem('useFlats');
    return saved !== null ? saved === 'true' : false;
  });

  // Audio
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('isMuted');
    return saved !== null ? saved === 'true' : false;
  });

  // Viewport / mobile detection
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const handler = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const isLandscapeMobile = viewportWidth < 768 && viewportHeight < viewportWidth;
  const isMobile = viewportWidth < 768 || isLandscapeMobile;
  const isTabletPortrait = viewportWidth >= 768 && viewportWidth < 1366 && viewportHeight >= viewportWidth;
  const isLandscapeTablet = viewportWidth >= 1024 && viewportWidth < 1366 && viewportHeight < viewportWidth;
  type LayoutMode = 'mobile' | 'landscape-mobile' | 'tablet-portrait' | 'landscape-tablet' | 'desktop';
  const layoutMode: LayoutMode =
    isLandscapeMobile ? 'landscape-mobile' :
    isTabletPortrait  ? 'tablet-portrait' :
    isLandscapeTablet ? 'landscape-tablet' :
    isMobile          ? 'mobile' :
    'desktop';

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'key' | 'scale' | 'settings'>(() => {
    const saved = localStorage.getItem('mobileTab');
    return (saved as 'key' | 'scale' | 'settings') ?? 'key';
  });

  // Tablet-portrait tab state
  const [tabletTab, setTabletTab] = useState<'settings' | 'scales'>(() => {
    const saved = localStorage.getItem('tabletTab');
    return (saved as 'settings' | 'scales') ?? 'settings';
  });

  // Persist all user state to localStorage
  useEffect(() => {
    localStorage.setItem('rootNote', rootNote);
    localStorage.setItem('scaleName', scaleName);
    localStorage.setItem('chordRoot', chordRoot);
    localStorage.setItem('chordType', chordType ?? '');
    localStorage.setItem('linkChordRoot', String(linkChordRoot));
    localStorage.setItem('hideNonChordNotes', String(hideNonChordNotes));
    localStorage.setItem('chordFretSpread', String(chordFretSpread));
    localStorage.setItem('chordIntervalFilter', chordIntervalFilter);
    localStorage.setItem('fingeringPattern', fingeringPattern);
    localStorage.setItem('cagedShapes', JSON.stringify(Array.from(cagedShapes)));
    localStorage.setItem('npsPosition', String(npsPosition));
    localStorage.setItem('displayFormat', displayFormat);
    localStorage.setItem('shapeLabels', shapeLabels);
    localStorage.setItem('tuningName', tuningName);
    localStorage.setItem('fretZoom', String(fretZoom));
    localStorage.setItem('fretStart', String(fretStart));
    localStorage.setItem('fretEnd', String(fretEnd));
    localStorage.setItem('useFlats', String(useFlats));
    localStorage.setItem('isMuted', String(isMuted));
    localStorage.setItem('mobileTab', mobileTab);
    localStorage.setItem('tabletTab', tabletTab);
  }, [rootNote, scaleName, chordRoot, chordType, linkChordRoot, hideNonChordNotes,
      chordFretSpread, chordIntervalFilter, fingeringPattern, cagedShapes, npsPosition,
      displayFormat, shapeLabels, tuningName, fretZoom, fretStart, fretEnd, useFlats, isMuted, mobileTab, tabletTab]);

  // Sync persisted mute state to audio synth on mount
  useEffect(() => {
    synth.setMute(isMuted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

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
    localStorage.clear();
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
    setUseFlats(false);
    setIsMuted(false);
    synth.setMute(false);
    setMobileTab('key');
  };

  // Compute active chord tones (independent of scale)
  const chordTones = useMemo(() => {
    if (!chordType) return [];
    return getChordNotes(chordRoot, chordType);
  }, [chordRoot, chordType]);

  // Apply interval filter to chord tones (always preserve root)
  const filteredChordTones = useMemo(() => {
    if (!chordType || chordIntervalFilter === "All") return chordTones;
    const allowed = CHORD_INTERVAL_FILTERS[chordIntervalFilter];
    const intervals = CHORDS[chordType];
    if (!intervals || !allowed) return chordTones;
    const filtered = intervals.filter((i) => allowed.has(i));
    // Always include root (interval 0) so root-active classification stays anchored
    if (!filtered.includes(0)) filtered.unshift(0);
    return getIntervalNotes(chordRoot, filtered);
  }, [chordRoot, chordType, chordIntervalFilter, chordTones]);

  const { highlightNotes, boxBounds, shapePolygons, wrappedNotes } =
    useMemo(() => {
      let coords: string[] = [];
      let bounds: { minFret: number; maxFret: number }[] = [];
      let polygons: ShapePolygon[] = [];
      const mergedWrappedNotes = new Set<string>();

      if (fingeringPattern === "caged") {
        const shapesToRender = CAGED_SHAPES.filter((s) => cagedShapes.has(s));
        const allCoords = new Set<string>();
        const allBounds: { minFret: number; maxFret: number }[] = [];
        const allPolygons: ShapePolygon[] = [];
        for (const shape of shapesToRender) {
          const res = getCagedCoordinates(
            rootNote,
            shape,
            scaleName,
            currentTuning,
            24,
          );
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
          const res = get3NPSCoordinates(
            rootNote,
            scaleName,
            currentTuning,
            24,
            npsPosition,
          );
          coords = res.coordinates;
          bounds = res.bounds;
        }
      } else {
        coords = getScaleNotes(rootNote, scaleName);
      }

      return {
        highlightNotes: coords,
        boxBounds: bounds,
        shapePolygons: polygons,
        wrappedNotes: mergedWrappedNotes,
      };
    }, [
      rootNote,
      scaleName,
      fingeringPattern,
      cagedShapes,
      npsPosition,
      currentTuning,
    ]);

  // Compute color notes: blue notes for blues scales, divergent notes for modal scales
  const colorNotes = useMemo(() => {
    const intervals = SCALES[scaleName];
    if (!intervals) return [];
    // Minor Blues: blue note is b5 (interval 6)
    if (scaleName === "Minor Blues") {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 6) % 12]] : [];
    }
    // Major Blues: blue note is b3 (interval 3)
    if (scaleName === "Major Blues") {
      const rootIdx = NOTES.indexOf(rootNote);
      return rootIdx >= 0 ? [NOTES[(rootIdx + 3) % 12]] : [];
    }
    // Modal scales: notes that diverge from the reference major/minor
    return getDivergentNotes(rootNote, scaleName);
  }, [rootNote, scaleName]);

  const summaryNotes = useMemo(
    () => getScaleNotes(rootNote, scaleName),
    [rootNote, scaleName],
  );

  const scaleLabel = `${formatAccidental(getNoteDisplayInScale(rootNote, rootNote, SCALES[scaleName] || [], useFlats))} ${scaleName}`;

  const chordLabel = chordType
    ? `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`
    : null;

  const chordSummaryNotes = useMemo(() => {
    if (!chordType || chordTones.length === 0) return [];
    const chordRootIdx = NOTES.indexOf(chordRoot);
    const chordToneSet = new Set(chordTones);
    return NOTES
      .slice(chordRootIdx)
      .concat(NOTES.slice(0, chordRootIdx))
      .filter(n => chordToneSet.has(n));
  }, [chordType, chordTones, chordRoot]);

  // Summary notes content (shared between mobile Key tab and desktop summary area)
  const summaryContent = (
    <div className="summary-area">
      <div className="summary-row">
        <div className="summary-row-label">{scaleLabel}</div>
        <div className="summary-notes">
          {summaryNotes.map((n, i) => {
            const rootIdx = NOTES.indexOf(rootNote);
            const noteIdx = NOTES.indexOf(n);
            const chromaticInterval = rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : -1;
            const degree = chromaticInterval !== -1 ? INTERVAL_NAMES[chromaticInterval] : null;
            const degreeMap = getDegreesForScale(scaleName);
            const romanNumeral = chromaticInterval !== -1 ? degreeMap[chromaticInterval] : undefined;
            const degreeColor = romanNumeral ? DEGREE_COLORS[romanNumeral] : undefined;
            return (
              <span key={i} className="summary-note" style={degreeColor ? { outline: `2px solid ${degreeColor}`, outlineOffset: '-2px' } : undefined}>
                <span className="summary-note-name">
                  {formatAccidental(getNoteDisplayInScale(n, rootNote, SCALES[scaleName] || [], useFlats))}
                </span>
                {degree && (
                  <span className="summary-note-degree" style={{ color: degreeColor }}>{formatAccidental(degree)}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {chordLabel && (
        <div className="summary-row summary-row--chord">
          <div className="summary-row-label">{chordLabel}</div>
          <div className="summary-notes">
            {chordSummaryNotes.map((n, i) => {
              const rootIdx = NOTES.indexOf(chordRoot);
              const noteIdx = NOTES.indexOf(n);
              const chromaticInterval = rootIdx !== -1 && noteIdx !== -1 ? (noteIdx - rootIdx + 12) % 12 : -1;
              const degree = chromaticInterval !== -1 ? INTERVAL_NAMES[chromaticInterval] : null;
              const degreeMap = getDegreesForScale(scaleName);
              const romanNumeral = chromaticInterval !== -1 ? degreeMap[chromaticInterval] : undefined;
              const degreeColor = romanNumeral ? DEGREE_COLORS[romanNumeral] : undefined;
              return (
                <span key={i} className="summary-note summary-note--chord" style={degreeColor ? { outline: `2px solid ${degreeColor}`, outlineOffset: '-2px' } : undefined}>
                  <span className="summary-note-name">
                    {formatAccidental(getNoteDisplay(n, chordRoot, useFlats))}
                  </span>
                  {degree && (
                    <span className="summary-note-degree" style={{ color: degreeColor }}>{formatAccidental(degree)}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Mobile tab content — Key tab (CoF + accidental toggle + summary)
  const keyTabContent = (
    <div className="mobile-tab-panel mobile-key-tab">
      <div className="cof-container">
        <CircleOfFifths
          rootNote={rootNote}
          setRootNote={handleSetRootNote}
          scaleName={scaleName}
          useFlats={useFlats}
        />
        <button
          className="accidental-toggle cof-toggle"
          onClick={() => setUseFlats(prev => !prev)}
          title={useFlats ? 'Showing flats — click for sharps' : 'Showing sharps — click for flats'}
        >
          {useFlats ? '♭' : '♯'}
        </button>
      </div>
      {summaryContent}
    </div>
  );

  // Mobile tab content — Scale & Chord tab
  const scaleChordTabContent = (
    <div className="mobile-tab-panel mobile-scale-chord-tab">
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
        onSelect={(v) => {
          setChordType(v);
          if (v && linkChordRoot) setChordRoot(rootNote);
        }}
        nullable
      />

      {chordType && (
        <>
          <div className="chord-root-row">
            <label className="link-toggle">
              <input
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
                <span className="section-label">Chord Root</span>
                <div className="note-grid">
                  {NOTES.map((n) => (
                    <button
                      key={n}
                      className={`note-btn ${chordRoot === n ? "active" : ""}`}
                      onClick={() => setChordRoot(n)}
                    >
                      {formatAccidental(getNoteDisplay(n, n, useFlats))}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <label className="link-toggle">
            <input
              type="checkbox"
              checked={hideNonChordNotes}
              onChange={(e) => setHideNonChordNotes(e.target.checked)}
            />
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
  );

  // Mobile tab content — Settings tab
  const settingsTabContent = (
    <div className="mobile-tab-panel mobile-settings-tab">
      <div className="control-section">
        <span className="section-label">Fingering Pattern</span>
        <div className="toggle-group">
          {(["all", "caged", "3nps"] as FingeringPattern[]).map((fp) => (
            <button
              key={fp}
              className={`toggle-btn ${fingeringPattern === fp ? "active" : ""}`}
              onClick={() => setFingeringPattern(fp)}
            >
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
                onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}
              >
                All
              </button>
              {CAGED_SHAPES.map((s) => (
                <button
                  key={s}
                  className={`toggle-btn ${cagedShapes.has(s) ? "active" : ""}`}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setCagedShapes((prev) => {
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
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="control-section">
            <span className="section-label">Shape Labels</span>
            <div className="toggle-group">
              {(["none", "caged", "modal"] as const).map((opt) => (
                <button
                  key={opt}
                  className={`toggle-btn ${shapeLabels === opt ? "active" : ""}`}
                  onClick={() => setShapeLabels(opt)}
                >
                  {opt === "none"
                    ? "None"
                    : opt === "caged"
                      ? "CAGED"
                      : "Modal"}
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
            <button
              className={`toggle-btn ${npsPosition === 0 ? "active" : ""}`}
              onClick={() => setNpsPosition(0)}
            >
              All
            </button>
            {[1, 2, 3, 4, 5, 6, 7].map((p) => (
              <button
                key={p}
                className={`toggle-btn ${npsPosition === p ? "active" : ""}`}
                onClick={() => setNpsPosition(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="control-section">
        <span className="section-label">Note Labels</span>
        <div className="toggle-group">
          {(["notes", "degrees", "none"] as const).map((fmt) => (
            <button
              key={fmt}
              className={`toggle-btn ${displayFormat === fmt ? "active" : ""}`}
              onClick={() => setDisplayFormat(fmt)}
            >
              {fmt === "notes"
                ? "Notes"
                : fmt === "degrees"
                  ? "Intervals"
                  : "None"}
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

      {!isTabletPortrait && (
        <div className="control-section">
          <span className="section-label">Fret Range</span>
          <div className="fret-range-mobile">
            <div className="fret-range-group">
              <span className="fret-range-label">Start</span>
              <button className="toolbar-btn" onClick={() => setFretStart(s => Math.max(0, s - 1))} disabled={fretStart <= 0}>−</button>
              <span className="toolbar-range-val">{fretStart}</span>
              <button className="toolbar-btn" onClick={() => setFretStart(s => Math.min(fretEnd - 1, s + 1))} disabled={fretStart >= fretEnd - 1}>+</button>
            </div>
            <div className="fret-range-group">
              <span className="fret-range-label">End</span>
              <button className="toolbar-btn" onClick={() => setFretEnd(e => Math.max(fretStart + 1, e - 1))} disabled={fretEnd <= fretStart + 1}>−</button>
              <span className="toolbar-range-val">{fretEnd}</span>
              <button className="toolbar-btn" onClick={() => setFretEnd(e => Math.min(END_FRET, e + 1))} disabled={fretEnd >= END_FRET}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container" data-layout-mode={layoutMode}>
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
          <a
            href="https://ko-fi.com/E1E01XFJ0G"
            target="_blank"
            rel="noopener noreferrer"
            className="kofi-header-btn"
            title="Support FretFlow on Ko-fi"
          >
            <img
              src="https://storage.ko-fi.com/cdn/brandasset/v2/support_me_on_kofi_blue.png"
              alt="Support me on Ko-fi"
              className="kofi-btn-desktop"
            />
            <img
              src="https://storage.ko-fi.com/cdn/brandasset/v2/kofi_symbol.png"
              alt="Ko-fi"
              className="kofi-btn-mobile"
            />
          </a>
          <button
            className="mute-btn"
            title="Settings"
            disabled
            style={{ opacity: 0.4, cursor: "default" }}
          >
            <Settings2 className="icon" />
          </button>
          <button
            onClick={handleReset}
            className="mute-btn"
            title="Reset to defaults"
          >
            <RotateCcw className="icon" />
          </button>
          <button
            onClick={toggleMute}
            className="mute-btn"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="icon icon-muted" />
            ) : (
              <Volume2 className="icon icon-active" />
            )}
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
          useFlats={useFlats}
          scaleName={scaleName}
        />
      </main>

      {/* Tablet-portrait two-column panel: Settings/Scales tabs (left) + CoF (right) */}
      {isTabletPortrait && (
        <div className="tablet-portrait-panel">
          {/* Left column: Settings/Scales tabs */}
          <div className="tablet-portrait-settings-col">
            <div className="toggle-group">
              <button
                className={`toggle-btn ${tabletTab === 'settings' ? 'active' : ''}`}
                onClick={() => { setTabletTab('settings'); localStorage.setItem('tabletTab', 'settings'); }}
              >Settings</button>
              <button
                className={`toggle-btn ${tabletTab === 'scales' ? 'active' : ''}`}
                onClick={() => { setTabletTab('scales'); localStorage.setItem('tabletTab', 'scales'); }}
              >Scales</button>
            </div>
            {tabletTab === 'settings' && (
              <div className="tablet-tab-content">
                {settingsTabContent}
              </div>
            )}
            {tabletTab === 'scales' && (
              <div className="tablet-tab-content">
                {scaleChordTabContent}
              </div>
            )}
          </div>
          {/* Right column: CoF fixed-width */}
          <div className="tablet-portrait-cof-col">
            <h2>Key</h2>
            <button
              className="accidental-toggle"
              onClick={() => setUseFlats(prev => !prev)}
              title={useFlats ? 'Showing flats — click for sharps' : 'Showing sharps — click for flats'}
            >
              {useFlats ? '♭' : '♯'}
            </button>
            <CircleOfFifths
              rootNote={rootNote}
              setRootNote={handleSetRootNote}
              scaleName={scaleName}
              useFlats={useFlats}
            />
          </div>
        </div>
      )}

      {/* Summary bar — desktop and tablet-portrait (mobile shows it in Key tab) */}
      {(!isMobile || isTabletPortrait) && summaryContent}

      {/* Mobile inline tab bar + content — hidden on desktop */}
      {isMobile && (
        <>
          <div className="mobile-tab-bar">
            <button
              className={`mobile-tab ${mobileTab === 'key' ? 'active' : ''}`}
              onClick={() => setMobileTab('key')}
            >
              Key
            </button>
            <button
              className={`mobile-tab ${mobileTab === 'scale' ? 'active' : ''}`}
              onClick={() => setMobileTab('scale')}
            >
              Scale
            </button>
            <button
              className={`mobile-tab ${mobileTab === 'settings' ? 'active' : ''}`}
              onClick={() => setMobileTab('settings')}
            >
              Settings
            </button>
          </div>
          <div className="mobile-tab-content">
            {mobileTab === 'key' && keyTabContent}
            {mobileTab === 'scale' && scaleChordTabContent}
            {mobileTab === 'settings' && settingsTabContent}
          </div>
        </>
      )}

      {/* Controls Panel */}
      <div className="controls-panel">
        {/* Col 1: Settings */}
        <div className="control-group">
          <div className="control-section">
            <span className="section-label">Fingering Pattern</span>
            <div className="toggle-group">
              {(["all", "caged", "3nps"] as FingeringPattern[]).map((fp) => (
                <button
                  key={fp}
                  className={`toggle-btn ${fingeringPattern === fp ? "active" : ""}`}
                  onClick={() => setFingeringPattern(fp)}
                >
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
                    onClick={() => setCagedShapes(new Set(CAGED_SHAPES))}
                  >
                    All
                  </button>
                  {CAGED_SHAPES.map((s) => (
                    <button
                      key={s}
                      className={`toggle-btn ${cagedShapes.has(s) ? "active" : ""}`}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          setCagedShapes((prev) => {
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
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-section">
                <span className="section-label">Shape Labels</span>
                <div className="toggle-group">
                  {(["none", "caged", "modal"] as const).map((opt) => (
                    <button
                      key={opt}
                      className={`toggle-btn ${shapeLabels === opt ? "active" : ""}`}
                      onClick={() => setShapeLabels(opt)}
                    >
                      {opt === "none"
                        ? "None"
                        : opt === "caged"
                          ? "CAGED"
                          : "Modal"}
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
                <button
                  className={`toggle-btn ${npsPosition === 0 ? "active" : ""}`}
                  onClick={() => setNpsPosition(0)}
                >
                  All
                </button>
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <button
                    key={p}
                    className={`toggle-btn ${npsPosition === p ? "active" : ""}`}
                    onClick={() => setNpsPosition(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="control-section">
            <span className="section-label">Note Labels</span>
            <div className="toggle-group">
              {(["notes", "degrees", "none"] as const).map((fmt) => (
                <button
                  key={fmt}
                  className={`toggle-btn ${displayFormat === fmt ? "active" : ""}`}
                  onClick={() => setDisplayFormat(fmt)}
                >
                  {fmt === "notes"
                    ? "Notes"
                    : fmt === "degrees"
                      ? "Intervals"
                      : "None"}
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

        {/* Col 2: Circle of Fifths + Chord Root — hidden in tablet-portrait (rendered below fretboard instead) */}
        {!isTabletPortrait && (
          <div className="control-group col-span-2 key-column">
            <h2>Key</h2>
            {!isMobile && (
              <button
                className="accidental-toggle"
                onClick={() => setUseFlats(prev => !prev)}
                title={useFlats ? 'Showing flats — click for sharps' : 'Showing sharps — click for flats'}
              >
                {useFlats ? '♭' : '♯'}
              </button>
            )}
            <CircleOfFifths
              rootNote={rootNote}
              setRootNote={handleSetRootNote}
              scaleName={scaleName}
              useFlats={useFlats}
            />
          </div>
        )}

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
            onSelect={(v) => {
              setChordType(v);
              if (v && linkChordRoot) setChordRoot(rootNote);
            }}
            nullable
          />

          {chordType && (
            <>
              <div className="chord-root-row">
                <label className="link-toggle">
                  <input
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
                    <span className="section-label">Chord Root</span>
                    <div className="note-grid">
                      {NOTES.map((n) => (
                        <button
                          key={n}
                          className={`note-btn ${chordRoot === n ? "active" : ""}`}
                          onClick={() => setChordRoot(n)}
                        >
                          {formatAccidental(getNoteDisplay(n, n, useFlats))}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <label className="link-toggle">
                <input
                  type="checkbox"
                  checked={hideNonChordNotes}
                  onChange={(e) => setHideNonChordNotes(e.target.checked)}
                />
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

      <div className="version-badge">
        v{__APP_VERSION__}&nbsp;·&nbsp;© {new Date().getFullYear()} Isaac Cocar. All rights reserved.
      </div>

    </div>
  );
}

export default App;
