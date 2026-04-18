import { useState, useMemo, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  rootNoteAtom,
  scaleNameAtom,
  chordRootAtom,
  chordTypeAtom,
  linkChordRootAtom,
  chordFretSpreadAtom,
  viewModeAtom,
  focusPresetAtom,
  customMembersAtom,
  fingeringPatternAtom,
  cagedShapesAtom,
  npsPositionAtom,
  fretStartAtom,
  fretEndAtom,
  displayFormatAtom,
  tuningNameAtom,
  accidentalModeAtom,
  enharmonicDisplayAtom,
  setRootNoteAtom,
  scaleBrowseModeAtom,
} from "../store/atoms";
import {
  SCALES,
  NOTES,
  CHORD_DEFINITIONS,
  getScaleNotes,
  getChordNotes,
  getNoteDisplay,
  getDivergentNotes,
  formatAccidental,
  resolveAccidentalMode,
  getAvailableFocusPresets,
  applyFocusPreset,
  type ViewMode,
  type FocusPreset,
  type ChordMemberName,
  type ResolvedChordMember,
  type NoteRole,
  type ChordRowEntry,
  type LegendItem,
} from "../theory";
import { getActiveScaleBrowseOption } from "../theoryCatalog";
import { STANDARD_TUNING, TUNINGS } from "../guitar";
import {
  CAGED_SHAPES,
  getCagedCoordinates,
  get3NPSCoordinates,
  findMainShape,
  getShapeCenterFret,
  type ShapePolygon,
  type CagedShape,
} from "../shapes";

export type {
  ViewMode,
  FocusPreset,
  ChordMemberName,
  ResolvedChordMember,
  NoteRole,
  ChordRowEntry,
  LegendItem,
};

export default function useDisplayState() {
  // Scale
  const rootNote = useAtomValue(rootNoteAtom);
  const [scaleName, setScaleName] = useAtom(scaleNameAtom);
  const [scaleBrowseMode, setScaleBrowseMode] = useAtom(scaleBrowseModeAtom);

  // Chord overlay
  const [chordRoot, setChordRoot] = useAtom(chordRootAtom);
  const [chordType, setChordType] = useAtom(chordTypeAtom);
  const [linkChordRoot, setLinkChordRoot] = useAtom(linkChordRootAtom);
  const chordFretSpread = useAtomValue(chordFretSpreadAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [focusPreset, setFocusPreset] = useAtom(focusPresetAtom);
  const [customMembers, setCustomMembers] = useAtom(customMembersAtom);

  // Fingering
  const [fingeringPattern, setFingeringPattern] = useAtom(fingeringPatternAtom);
  const [cagedShapes, setCagedShapes] = useAtom(cagedShapesAtom);
  const [npsPosition, setNpsPosition] = useAtom(npsPositionAtom);

  // Fret range (for auto-center calculation)
  const startFret = useAtomValue(fretStartAtom);
  const endFret = useAtomValue(fretEndAtom);

  // Display
  const [displayFormat, setDisplayFormat] = useAtom(displayFormatAtom);
  const tuningName = useAtomValue(tuningNameAtom);

  // Accidentals
  const accidentalMode = useAtomValue(accidentalModeAtom);
  const enharmonicDisplay = useAtomValue(enharmonicDisplayAtom);

  // Root note setter (write atom for CoF root selection — syncs chordRoot when linked)
  const setRootNote = useSetAtom(setRootNoteAtom);

  // Internalized local state
  const [clickedShape, setClickedShape] = useState<CagedShape | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  // When in CAGED mode, reset to E shape whenever the scale changes
  const prevScaleNameRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevScaleNameRef.current;
    prevScaleNameRef.current = scaleName;
    if (prev === null || prev === scaleName) return;
    if (fingeringPattern !== "caged") return;
    setCagedShapes(new Set<CagedShape>(["E"]));
  }, [scaleName, fingeringPattern, setCagedShapes]);

  // Callbacks
  const onShapeClick = (shape: CagedShape | null) => {
    setClickedShape(shape);
  };

  const onRecenter = () => {
    setRecenterKey((k) => k + 1);
  };

  // useMemo derivations (copied verbatim from App.tsx)

  const useFlats = useMemo(
    () => resolveAccidentalMode(rootNote, scaleName, accidentalMode),
    [rootNote, scaleName, accidentalMode],
  );

  const currentTuning = TUNINGS[tuningName] || STANDARD_TUNING;

  // All chord tones for the selected chord (unfiltered; used for degree strip)
  const chordTones = useMemo(() => {
    if (!chordType) return [];
    return getChordNotes(chordRoot, chordType);
  }, [chordRoot, chordType]);

  // Available focus presets for the current chord quality
  const availableFocusPresets = useMemo((): FocusPreset[] => {
    if (!chordType) return ["all", "custom"];
    return getAvailableFocusPresets(chordType);
  }, [chordType]);

  // Resolved chord members with note names attached
  const chordMembers = useMemo((): ResolvedChordMember[] => {
    if (!chordType) return [];
    const def = CHORD_DEFINITIONS[chordType];
    if (!def) return [];
    const rootIndex = NOTES.indexOf(chordRoot);
    if (rootIndex === -1) return [];
    return def.members.map((m) => ({
      ...m,
      note: NOTES[(rootIndex + m.semitone) % 12],
    }));
  }, [chordRoot, chordType]);

  // Active chord members after applying focus preset (with graceful fallback)
  const activeChordMembers = useMemo((): ResolvedChordMember[] => {
    if (!chordType) return [];
    const def = CHORD_DEFINITIONS[chordType];
    if (!def) return [];
    const rootIndex = NOTES.indexOf(chordRoot);
    if (rootIndex === -1) return [];
    const effectivePreset = availableFocusPresets.includes(focusPreset)
      ? focusPreset
      : "all";
    const members = applyFocusPreset(def, effectivePreset, customMembers);
    return members.map((m) => ({
      ...m,
      note: NOTES[(rootIndex + m.semitone) % 12],
    }));
  }, [chordRoot, chordType, focusPreset, customMembers, availableFocusPresets]);

  // Note names from active chord members — passed to Fretboard as chordTones
  const activeChordTones = useMemo(
    () => activeChordMembers.map((m) => m.note),
    [activeChordMembers],
  );

  // Whether any chord member falls outside the current scale
  const hasOutsideChordMembers = useMemo(() => {
    if (!chordType || chordTones.length === 0) return false;
    const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
    return chordTones.some((note) => !scaleNoteSet.has(note));
  }, [chordType, chordTones, rootNote, scaleName]);

  // Shared note-role map: every chromatic note → its overlay role when chord active.
  // Consumed by both the fretboard and the summary strip for consistent semantics.
  const noteRoleMap = useMemo((): Map<string, NoteRole> => {
    if (!chordType) return new Map();
    const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
    const activeChordToneSet = new Set(activeChordTones);
    const map = new Map<string, NoteRole>();
    for (const note of NOTES) {
      const isInScale = scaleNoteSet.has(note);
      const isActiveChordTone = activeChordToneSet.has(note);
      const isChordRootNote = note === chordRoot;
      if (isChordRootNote && isActiveChordTone) {
        map.set(note, "chord-root");
      } else if (isActiveChordTone && isInScale) {
        map.set(note, "chord-tone-in-scale");
      } else if (isActiveChordTone && !isInScale) {
        map.set(note, "chord-tone-outside-scale");
      } else if (isInScale) {
        map.set(note, "scale-only");
      }
    }
    return map;
  }, [chordType, rootNote, scaleName, chordRoot, activeChordTones]);

  // Chord row entries for the summary strip, filtered by viewMode.
  const summaryChordRow = useMemo((): ChordRowEntry[] => {
    if (!chordType) return [];
    const scaleNoteSet = new Set(getScaleNotes(rootNote, scaleName));
    const entries = activeChordMembers.map((m): ChordRowEntry => {
      const inScale = scaleNoteSet.has(m.note);
      const isRoot = m.name === "root";
      let role: ChordRowEntry["role"];
      if (isRoot) {
        role = "chord-root";
      } else if (inScale) {
        role = "chord-tone-in-scale";
      } else {
        role = "chord-tone-outside-scale";
      }
      return {
        internalNote: m.note,
        displayNote: formatAccidental(getNoteDisplay(m.note, chordRoot, useFlats)),
        memberName: m.name === "root" ? "1" : formatAccidental(m.name),
        role,
        inScale,
      };
    });
    // In outside view: keep only outside-scale entries (plus outside chord root).
    if (viewMode === "outside") {
      return entries.filter(
        (e) =>
          e.role === "chord-tone-outside-scale" ||
          (e.role === "chord-root" && !e.inScale),
      );
    }
    return entries;
  }, [
    chordType,
    activeChordMembers,
    rootNote,
    scaleName,
    chordRoot,
    useFlats,
    viewMode,
  ]);

  // Legend items: only roles actually present in the current chord row.
  const summaryLegendItems = useMemo((): LegendItem[] => {
    if (!chordType) return [];
    const rolesPresent = new Set(summaryChordRow.map((e) => e.role));
    const items: LegendItem[] = [];
    if (rolesPresent.has("chord-root"))
      items.push({ role: "chord-root", label: "Chord root" });
    if (rolesPresent.has("chord-tone-in-scale"))
      items.push({ role: "chord-tone-in-scale", label: "Chord tone" });
    if (rolesPresent.has("chord-tone-outside-scale"))
      items.push({ role: "chord-tone-outside-scale", label: "Outside scale" });
    // In compare mode, mention scale-only only when that role is actually present on the board.
    const hasScaleOnly = Array.from(noteRoleMap.values()).includes("scale-only");
    if (viewMode === "compare" && hasScaleOnly) {
      items.push({ role: "scale-only", label: "Scale only" });
    }
    return items;
  }, [chordType, summaryChordRow, viewMode, noteRoleMap]);

  // hideNonChordNotes derived from viewMode for Fretboard rendering path
  const hideNonChordNotes = viewMode === "chord";

  const {
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
  } = useMemo(() => {
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
      const res = get3NPSCoordinates(
        rootNote,
        scaleName,
        currentTuning,
        24,
        npsPosition,
      );
      coords = res.coordinates;
      bounds = res.bounds;
    } else {
      coords = getScaleNotes(rootNote, scaleName);
    }

    // Compute auto-center target for CAGED mode
    let autoCenterTarget: number | undefined;
    if (fingeringPattern === "caged" && polygons.length > 0) {
      // If a shape was clicked, center that specific shape
      if (clickedShape) {
        const clickedPoly = polygons.find((p) => p.shape === clickedShape);
        if (clickedPoly && !clickedPoly.truncated) {
          autoCenterTarget = getShapeCenterFret(clickedPoly);
        }
      }
      // Otherwise find the main (lowest complete) shape
      if (autoCenterTarget === undefined) {
        const mainShape = findMainShape(
          polygons,
          mergedWrappedNotes,
          startFret,
          endFret,
        );
        if (mainShape) {
          autoCenterTarget = getShapeCenterFret(mainShape);
        }
      }
    } else if (fingeringPattern === "3nps" && bounds.length > 0) {
      // Center on the lowest note of the current 3NPS position
      const lowestBounds = bounds.reduce((a, b) =>
        a.minFret <= b.minFret ? a : b,
      );
      autoCenterTarget = lowestBounds.minFret;
    }

    return {
      highlightNotes: coords,
      boxBounds: bounds,
      shapePolygons: polygons,
      wrappedNotes: mergedWrappedNotes,
      autoCenterTarget,
    };
  }, [
    rootNote,
    scaleName,
    fingeringPattern,
    cagedShapes,
    npsPosition,
    currentTuning,
    startFret,
    endFret,
    clickedShape,
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

  const activeBrowseOption = useMemo(
    () =>
      getActiveScaleBrowseOption(
        rootNote,
        scaleName,
        scaleBrowseMode,
        useFlats,
      ),
    [rootNote, scaleName, scaleBrowseMode, useFlats],
  );

  const scaleLabel = `${formatAccidental(activeBrowseOption.label)}`;

  const chordLabel = chordType
    ? `${formatAccidental(getNoteDisplay(chordRoot, chordRoot, useFlats))} ${chordType}`
    : null;

  const chordSummaryNotes = useMemo(() => {
    if (!chordType || chordTones.length === 0) return [];
    const chordRootIdx = NOTES.indexOf(chordRoot);
    const chordToneSet = new Set(chordTones);
    return NOTES.slice(chordRootIdx)
      .concat(NOTES.slice(0, chordRootIdx))
      .filter((n) => chordToneSet.has(n));
  }, [chordType, chordTones, chordRoot]);

  // Chord member interval labels for header display (e.g. "1 3 5")
  const chordMemberLabels = useMemo(
    () =>
      activeChordMembers
        .map((m) => (m.name === "root" ? "1" : formatAccidental(m.name)))
        .join(" "),
    [activeChordMembers],
  );

  // Unified ribbon header — left side text
  const summaryHeaderLeft = useMemo(() => {
    if (!chordType) return scaleLabel;
    if (viewMode === "chord") return chordLabel ?? "";
    if (viewMode === "outside") return "Outside tones";
    return scaleLabel; // compare
  }, [chordType, viewMode, scaleLabel, chordLabel]);

  // Unified ribbon header — right side text (null when no chord)
  const summaryHeaderRight = useMemo((): string | null => {
    if (!chordType || !chordLabel) return null;
    if (viewMode === "chord") return "Chord only";
    if (viewMode === "outside") return `against ${scaleLabel}`;
    // compare: chord label + member intervals
    return chordMemberLabels
      ? `${chordLabel} \u2022 ${chordMemberLabels}`
      : chordLabel;
  }, [chordType, viewMode, scaleLabel, chordLabel, chordMemberLabels]);

  // Primary strip mode: "scale" for compare or no chord, "chord"/"outside" for those viewModes
  const summaryPrimaryMode = useMemo((): "scale" | "chord" | "outside" => {
    if (!chordType || viewMode === "compare") return "scale";
    if (viewMode === "chord") return "chord";
    return "outside";
  }, [chordType, viewMode]);

  // Whether the secondary compact chord rail should appear (compare mode only, when it adds info)
  const showSecondaryChordRail = useMemo(
    () =>
      !!(
        chordType &&
        viewMode === "compare" &&
        (chordRoot !== rootNote || focusPreset !== "all" || hasOutsideChordMembers)
      ),
    [chordType, viewMode, chordRoot, rootNote, focusPreset, hasOutsideChordMembers],
  );

  return {
    // Atom values
    rootNote,
    scaleName,
    scaleBrowseMode,
    chordRoot,
    chordType,
    linkChordRoot,
    hideNonChordNotes,
    chordFretSpread,
    viewMode,
    focusPreset,
    customMembers,
    fingeringPattern,
    cagedShapes,
    npsPosition,
    startFret,
    endFret,
    displayFormat,
    tuningName,
    accidentalMode,
    enharmonicDisplay,
    // Setters
    setScaleName,
    setScaleBrowseMode,
    setChordRoot,
    setChordType,
    setLinkChordRoot,
    setViewMode,
    setFocusPreset,
    setCustomMembers,
    setFingeringPattern,
    setCagedShapes,
    setNpsPosition,
    setDisplayFormat,
    setRootNote,
    // Derived values
    useFlats,
    currentTuning,
    chordTones,
    chordMembers,
    availableFocusPresets,
    activeChordMembers,
    activeChordTones,
    hasOutsideChordMembers,
    noteRoleMap,
    summaryChordRow,
    summaryLegendItems,
    chordMemberLabels,
    summaryHeaderLeft,
    summaryHeaderRight,
    summaryPrimaryMode,
    showSecondaryChordRail,
    highlightNotes,
    boxBounds,
    shapePolygons,
    wrappedNotes,
    autoCenterTarget,
    colorNotes,
    summaryNotes,
    scaleLabel,
    chordLabel,
    chordSummaryNotes,
    // Internal state + callbacks
    clickedShape,
    recenterKey,
    onShapeClick,
    onRecenter,
  };
}
