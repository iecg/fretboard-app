# Help Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale, hardcoded-English help modal with a tabbed, fully-i18n (en + es), diagram-equipped reference that matches the current app.

**Architecture:** Content lives as a typed config (`HELP_TABS`) whose every string is an i18n key; `HelpModal.tsx` renders a tab bar + the active tab's sections from that config. Five inline-SVG diagram components key off the app's semantic CSS tokens so they stay theme-correct. A versioned `helpWhatsNewSeenAtom` replaces the one-off chord-mode-removal notice.

**Tech Stack:** React 19, TypeScript, Jotai (`atomWithStorage`), Radix Dialog, `motion/react`, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-07-help-modal-redesign-design.md`

---

## Conventions for the implementer

- Package manager is **pnpm**. Run a single test file with:
  `pnpm exec vitest run src/components/HelpModal/HelpModal.test.tsx`
- Run the i18n test with:
  `pnpm exec vitest run src/i18n/help.test.ts`
- Commit after each task with a Conventional Commit (`feat(help): …`, `test(help): …`, `refactor(help): …`).
- The app stores notes as sharps; tunings high-string-first. Not relevant to this UI text but keep copy accurate.
- All user-facing strings go through `t("help.…")` from `useTranslation` (`src/hooks/useTranslation.ts`). It returns plain strings and warns on a missing key.

## File Structure

**New**
- `src/components/HelpModal/helpContent.ts` — `HELP_TABS` config + `DiagramId` union + current What's-new notice id.
- `src/components/HelpModal/diagrams/HelpDiagram.tsx` — `id` → diagram switch.
- `src/components/HelpModal/diagrams/LayoutMapDiagram.tsx`
- `src/components/HelpModal/diagrams/NoteRoleLegendDiagram.tsx`
- `src/components/HelpModal/diagrams/ShapeDiagram.tsx`
- `src/components/HelpModal/diagrams/VoiceLeadingDiagram.tsx`
- `src/components/HelpModal/diagrams/ShortcutTableDiagram.tsx`
- `src/components/HelpModal/diagrams/diagrams.module.css`
- `src/i18n/help.test.ts` — i18n coverage test across en + es.

**Modified**
- `src/i18n/types.ts` — add `help` block to `Dictionary`.
- `src/i18n/en.ts`, `src/i18n/es.ts` — add `help` content.
- `src/store/uiAtoms.ts` — replace `seenChordModeRemovalNoticeAtom` with `helpWhatsNewSeenAtom`.
- `src/components/HelpModal/HelpModal.tsx` — render tabs + panels from config.
- `src/components/HelpModal/HelpModal.module.css` — tab bar + diagram layout styles.
- `src/components/HelpModal/HelpModal.test.tsx` — rewrite.

---

## Task 1: i18n `help` type + content (en + es)

**Files:**
- Modify: `src/i18n/types.ts` (add `help` to `Dictionary`)
- Modify: `src/i18n/en.ts` (replace existing `help` object)
- Modify: `src/i18n/es.ts` (replace existing `help` object)

The existing `help` object in en.ts/es.ts is `{ whatsNew, chordModeRemoved, gotIt }`. It is replaced wholesale by the structure below. The `chordModeRemoved` string is deleted.

- [ ] **Step 1: Add the `help` interface to `Dictionary`**

In `src/i18n/types.ts`, replace the current `help` member of `Dictionary` with:

```ts
  help: {
    title: string;
    close: string;
    tabs: {
      start: string;
      notes: string;
      shapes: string;
      play: string;
      settings: string;
    };
    whatsNew: { label: string; body: string; dismiss: string };
    sections: {
      gettingStarted: string;
      layout: string;
      inspector: string;
      noteColors: string;
      noteLabels: string;
      degreeStrip: string;
      hearNotes: string;
      choosingScale: string;
      patterns: string;
      chordsVoicings: string;
      circle: string;
      diatonic: string;
      buildProgression: string;
      backingTrack: string;
      playback: string;
      settings: string;
      shortcuts: string;
    };
    items: {
      introBody: string;
      layoutMobileLabel: string;
      layoutMobileBody: string;
      layoutDesktopLabel: string;
      layoutDesktopBody: string;
      inspectorOverlayLabel: string;
      inspectorOverlayBody: string;
      inspectorSongLabel: string;
      inspectorSongBody: string;
      noteColorsBody: string;
      noteLabelsLabel: string;
      noteLabelsBody: string;
      degreeStripBody: string;
      hearNotesBody: string;
      rootLabel: string;
      rootBody: string;
      scaleLabel: string;
      scaleBody: string;
      parRelLabel: string;
      parRelBody: string;
      patternAllLabel: string;
      patternAllBody: string;
      patternCagedLabel: string;
      patternCagedBody: string;
      patternNpsLabel: string;
      patternNpsBody: string;
      fullChordsLabel: string;
      fullChordsBody: string;
      voicingLabel: string;
      voicingBody: string;
      circleBody: string;
      diatonicBody: string;
      presetLabel: string;
      presetBody: string;
      sequenceLabel: string;
      sequenceBody: string;
      timeLabel: string;
      timeBody: string;
      backingTrackBody: string;
      transportLabel: string;
      transportBody: string;
      voiceLeadingLabel: string;
      voiceLeadingBody: string;
      practiceLabel: string;
      practiceBody: string;
      settingsBody: string;
      shortcutsBody: string;
    };
    roles: {
      root: string;
      chordTone: string;
      scaleNote: string;
      colorTone: string;
      resolution: string;
    };
    voiceLeading: { anticipation: string; hold: string; departing: string };
    shortcuts: {
      play: string;
      stop: string;
      loop: string;
      mute: string;
      track1: string;
      track2: string;
      track3: string;
      track4: string;
      steps: string;
      scale: string;
      chord: string;
    };
    layoutDiagram: { mobile: string; desktop: string; overlay: string; song: string };
  };
```

- [ ] **Step 2: Replace the English `help` object** in `src/i18n/en.ts`

Find the current `help: { whatsNew, chordModeRemoved, gotIt }` block and replace it with:

```ts
  help: {
    title: "Help",
    close: "Close help",
    tabs: {
      start: "Start",
      notes: "Notes",
      shapes: "Scales & Shapes",
      play: "Progressions & Songs",
      settings: "Settings & Shortcuts",
    },
    whatsNew: {
      label: "What's new",
      body: "Progressions and songs are here — load a preset, play it back with a backing track, and watch the fretboard follow the chords. Single-shape CAGED is the new default too.",
      dismiss: "Got it",
    },
    sections: {
      gettingStarted: "Getting started",
      layout: "Layout",
      inspector: "The Inspector",
      noteColors: "Note colors",
      noteLabels: "Note labels",
      degreeStrip: "Degree strip",
      hearNotes: "Hear the notes",
      choosingScale: "Choosing a scale",
      patterns: "Fingering patterns",
      chordsVoicings: "Chords & voicings",
      circle: "Circle of Fifths",
      diatonic: "Diatonic chords",
      buildProgression: "Build a progression",
      backingTrack: "Backing track",
      playback: "Playback",
      settings: "Settings",
      shortcuts: "Keyboard shortcuts",
    },
    items: {
      introBody:
        "FretFlow is an interactive guitar fretboard and music-theory tool. Pick a root note, a scale, and an optional chord overlay to see notes and intervals light up across the neck.",
      layoutMobileLabel: "Mobile",
      layoutMobileBody:
        "The fretboard fills the screen. A tab bar switches the Inspector between the Overlay panel (scale, chord, shapes, labels) and the Song panel (progression and backing track).",
      layoutDesktopLabel: "Tablet & desktop",
      layoutDesktopBody:
        "The Inspector sits beside the fretboard as cards, so every control is visible at once.",
      inspectorOverlayLabel: "Overlay tab",
      inspectorOverlayBody:
        "Builds what you see on the fretboard: scale, chord, fingering shapes, voicings, and note labels.",
      inspectorSongLabel: "Song tab",
      inspectorSongBody:
        "Builds what you hear: key, progression preset, sequence, tempo, and backing track.",
      noteColorsBody:
        "Every dot is colored by its musical role. The legend below matches the colors on your fretboard.",
      noteLabelsLabel: "Notes / Intervals / None",
      noteLabelsBody:
        "Choose what shows inside each dot — note names, interval numbers, or nothing for a clean board.",
      degreeStripBody:
        "The strip above the fretboard lists the scale's notes with their interval below each one. Chord tones highlight when a chord is active.",
      hearNotesBody:
        "Tap any dot to hear it. Use the speaker icon in the header to mute or unmute.",
      rootLabel: "Root",
      rootBody:
        "Tap a note in the grid, or a wedge in the Circle of Fifths, to set the tonic.",
      scaleLabel: "Scale",
      scaleBody:
        "Pick a family and mode, then step through modes or keys with the arrows.",
      parRelLabel: "Parallel / Relative",
      parRelBody:
        "Parallel keeps the same root while you browse modes; Relative cycles through related keys.",
      patternAllLabel: "All",
      patternAllBody: "Lights up every scale note, with no position boxes.",
      patternCagedLabel: "CAGED",
      patternCagedBody:
        "Overlapping position shapes across the neck. Click a shape (C A G E D) to isolate it; Shift-click to combine. Turn on Shape Labels to letter each box.",
      patternNpsLabel: "3NPS",
      patternNpsBody:
        "Three notes per string. Use the position selector (1–7 or All) to isolate one hand position.",
      fullChordsLabel: "Full Chords",
      fullChordsBody:
        "Shows canonical CAGED chord voicings instead of scattered chord tones.",
      voicingLabel: "Voicing",
      voicingBody:
        "Off, Full, or Close — plus a string set (Bass to Treble) to focus the voicing on part of the neck.",
      circleBody:
        "Tap a key to change the root. Degree markers show how the scale's intervals map onto each key. On mobile, open it from the Overlay tab.",
      diatonicBody:
        "Open Chords in the Overlay tab and pick a chord by Roman numeral; its tones highlight in a distinct color. To change the root or quality, edit the active step in the Song tab.",
      presetLabel: "Preset",
      presetBody:
        "Start from a preset grouped by genre — Pop / Rock, Blues, Jazz, Folk, Modal, or Minor.",
      sequenceLabel: "Sequence",
      sequenceBody:
        "Add, remove, and reorder steps. Each step is one chord the song loops through.",
      timeLabel: "Time & tempo",
      timeBody: "Set the time signature and tempo for the whole song.",
      backingTrackBody:
        "Generated accompaniment plays along with the progression. Toggle Chord, Bass, Drums, and the Metronome independently, and pick a pattern per instrument.",
      transportLabel: "Transport",
      transportBody:
        "Play, pause, and stop from the header. Loop repeats the progression. When stopped, step through chords with the arrow keys.",
      voiceLeadingLabel: "Voice leading",
      voiceLeadingBody:
        "As chords change, the fretboard glows: anticipation (the next chord's guide tones before the change), hold (common tones), and departing (tones that resolve away).",
      practiceLabel: "Practice cues",
      practiceBody:
        "The practice bar shows coaching cues — Land on (all chord tones) and Tension (chord tones outside the scale, with the nearest in-scale target). It never hides fretboard notes.",
      settingsBody:
        "Open the gear icon for Tuning, Zoom, Fret Range, Accidentals, Enharmonic Display, Sound Quality, Theme, and Language. Use Reset to restore defaults.",
      shortcutsBody: "These work whenever you're not typing in a field.",
    },
    roles: {
      root: "Root",
      chordTone: "Chord tone",
      scaleNote: "Scale note",
      colorTone: "Color tone",
      resolution: "Resolution target",
    },
    voiceLeading: {
      anticipation: "Anticipation",
      hold: "Hold",
      departing: "Departing",
    },
    shortcuts: {
      play: "Play / pause",
      stop: "Stop",
      loop: "Toggle loop",
      mute: "Mute / unmute",
      track1: "Toggle chord track",
      track2: "Toggle bass track",
      track3: "Toggle drums track",
      track4: "Toggle metronome",
      steps: "Previous / next step",
      scale: "Show / hide scale",
      chord: "Show / hide chord",
    },
    layoutDiagram: {
      mobile: "Mobile",
      desktop: "Desktop",
      overlay: "Overlay",
      song: "Song",
    },
  },
```

- [ ] **Step 3: Replace the Spanish `help` object** in `src/i18n/es.ts`

Find the current `help` block and replace it with:

```ts
  help: {
    title: "Ayuda",
    close: "Cerrar ayuda",
    tabs: {
      start: "Inicio",
      notes: "Notas",
      shapes: "Escalas y formas",
      play: "Progresiones y canciones",
      settings: "Ajustes y atajos",
    },
    whatsNew: {
      label: "Novedades",
      body: "Ya están las progresiones y canciones: carga un preset, reprodúcelo con pista de acompañamiento y mira cómo el diapasón sigue los acordes. El modo CAGED de una sola forma también es el nuevo valor por defecto.",
      dismiss: "Entendido",
    },
    sections: {
      gettingStarted: "Primeros pasos",
      layout: "Disposición",
      inspector: "El Inspector",
      noteColors: "Colores de las notas",
      noteLabels: "Etiquetas de notas",
      degreeStrip: "Tira de grados",
      hearNotes: "Escuchar las notas",
      choosingScale: "Elegir una escala",
      patterns: "Patrones de digitación",
      chordsVoicings: "Acordes y voicings",
      circle: "Círculo de quintas",
      diatonic: "Acordes diatónicos",
      buildProgression: "Crear una progresión",
      backingTrack: "Pista de acompañamiento",
      playback: "Reproducción",
      settings: "Ajustes",
      shortcuts: "Atajos de teclado",
    },
    items: {
      introBody:
        "FretFlow es una herramienta interactiva de diapasón y teoría musical para guitarra. Elige una tónica, una escala y un acorde opcional para ver las notas e intervalos iluminarse a lo largo del mástil.",
      layoutMobileLabel: "Móvil",
      layoutMobileBody:
        "El diapasón ocupa la pantalla. Una barra de pestañas alterna el Inspector entre el panel Overlay (escala, acorde, formas, etiquetas) y el panel Song (progresión y acompañamiento).",
      layoutDesktopLabel: "Tableta y escritorio",
      layoutDesktopBody:
        "El Inspector se sitúa junto al diapasón como tarjetas, así todos los controles están visibles a la vez.",
      inspectorOverlayLabel: "Pestaña Overlay",
      inspectorOverlayBody:
        "Construye lo que ves en el diapasón: escala, acorde, formas de digitación, voicings y etiquetas de notas.",
      inspectorSongLabel: "Pestaña Song",
      inspectorSongBody:
        "Construye lo que oyes: tonalidad, preset de progresión, secuencia, tempo y acompañamiento.",
      noteColorsBody:
        "Cada punto se colorea según su función musical. La leyenda de abajo coincide con los colores de tu diapasón.",
      noteLabelsLabel: "Notas / Intervalos / Ninguno",
      noteLabelsBody:
        "Elige qué se muestra dentro de cada punto: nombres de notas, números de intervalo o nada para un diapasón limpio.",
      degreeStripBody:
        "La tira sobre el diapasón lista las notas de la escala con su intervalo debajo de cada una. Las notas del acorde se resaltan cuando hay un acorde activo.",
      hearNotesBody:
        "Toca cualquier punto para oírlo. Usa el icono del altavoz en la cabecera para silenciar o activar el sonido.",
      rootLabel: "Tónica",
      rootBody:
        "Toca una nota en la cuadrícula, o un sector del Círculo de quintas, para fijar la tónica.",
      scaleLabel: "Escala",
      scaleBody:
        "Elige una familia y un modo, y recorre los modos o tonalidades con las flechas.",
      parRelLabel: "Paralela / Relativa",
      parRelBody:
        "Paralela mantiene la misma tónica mientras exploras modos; Relativa recorre tonalidades relacionadas.",
      patternAllLabel: "Todas",
      patternAllBody: "Ilumina todas las notas de la escala, sin cajas de posición.",
      patternCagedLabel: "CAGED",
      patternCagedBody:
        "Formas de posición superpuestas a lo largo del mástil. Haz clic en una forma (C A G E D) para aislarla; Mayús+clic para combinar. Activa Etiquetas de forma para nombrar cada caja.",
      patternNpsLabel: "3NPS",
      patternNpsBody:
        "Tres notas por cuerda. Usa el selector de posición (1–7 o Todas) para aislar una posición de la mano.",
      fullChordsLabel: "Acordes completos",
      fullChordsBody:
        "Muestra los voicings de acorde CAGED canónicos en lugar de notas de acorde dispersas.",
      voicingLabel: "Voicing",
      voicingBody:
        "Off, Completo o Cerrado, más un conjunto de cuerdas (de Graves a Agudas) para centrar el voicing en una parte del mástil.",
      circleBody:
        "Toca una tonalidad para cambiar la tónica. Los marcadores de grado muestran cómo se asignan los intervalos de la escala a cada tonalidad. En móvil, ábrelo desde la pestaña Overlay.",
      diatonicBody:
        "Abre Acordes en la pestaña Overlay y elige un acorde por su numeral romano; sus notas se resaltan en un color distinto. Para cambiar la tónica o la cualidad, edita el paso activo en la pestaña Song.",
      presetLabel: "Preset",
      presetBody:
        "Empieza desde un preset agrupado por género: Pop / Rock, Blues, Jazz, Folk, Modal o Menor.",
      sequenceLabel: "Secuencia",
      sequenceBody:
        "Añade, quita y reordena pasos. Cada paso es un acorde por el que la canción pasa en bucle.",
      timeLabel: "Compás y tempo",
      timeBody: "Define el compás y el tempo de toda la canción.",
      backingTrackBody:
        "El acompañamiento generado suena junto con la progresión. Activa Acorde, Bajo, Batería y el Metrónomo de forma independiente, y elige un patrón por instrumento.",
      transportLabel: "Transporte",
      transportBody:
        "Reproduce, pausa y detén desde la cabecera. El bucle repite la progresión. Con la reproducción detenida, avanza entre acordes con las flechas.",
      voiceLeadingLabel: "Conducción de voces",
      voiceLeadingBody:
        "Al cambiar los acordes, el diapasón brilla: anticipación (las notas guía del siguiente acorde antes del cambio), retención (notas comunes) y salida (notas que resuelven hacia otra).",
      practiceLabel: "Pistas de práctica",
      practiceBody:
        "La barra de práctica muestra pistas de apoyo: Aterriza en (todas las notas del acorde) y Tensión (notas del acorde fuera de la escala, con el objetivo dentro de la escala más cercano). Nunca oculta notas del diapasón.",
      settingsBody:
        "Abre el icono de engranaje para Afinación, Zoom, Rango de trastes, Alteraciones, Visualización enarmónica, Calidad de sonido, Tema e Idioma. Usa Restablecer para volver a los valores por defecto.",
      shortcutsBody: "Funcionan siempre que no estés escribiendo en un campo.",
    },
    roles: {
      root: "Tónica",
      chordTone: "Nota del acorde",
      scaleNote: "Nota de la escala",
      colorTone: "Nota de color",
      resolution: "Objetivo de resolución",
    },
    voiceLeading: {
      anticipation: "Anticipación",
      hold: "Retención",
      departing: "Salida",
    },
    shortcuts: {
      play: "Reproducir / pausar",
      stop: "Detener",
      loop: "Alternar bucle",
      mute: "Silenciar / activar",
      track1: "Alternar pista de acorde",
      track2: "Alternar pista de bajo",
      track3: "Alternar pista de batería",
      track4: "Alternar metrónomo",
      steps: "Paso anterior / siguiente",
      scale: "Mostrar / ocultar escala",
      chord: "Mostrar / ocultar acorde",
    },
    layoutDiagram: {
      mobile: "Móvil",
      desktop: "Escritorio",
      overlay: "Overlay",
      song: "Song",
    },
  },
```

- [ ] **Step 4: Verify the project type-checks**

Run: `pnpm exec tsc -b`
Expected: PASS (no errors). The `Dictionary` type now requires the new `help` shape; en.ts and es.ts both satisfy it.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(help): add tabbed help i18n content (en + es)"
```

---

## Task 2: i18n coverage test

**Files:**
- Create: `src/i18n/help.test.ts`

This test fails until Task 3's `helpContent.ts` exists, so it is written but expected to fail at the import step first, then pass after Task 3. To keep Task 2 self-contained, it asserts only the dictionaries here; the config-driven assertion is added in Task 3.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { en } from "./en";
import { es } from "./es";

// Walks an object and yields every leaf key path.
function leafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? leafPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("i18n/help", () => {
  it("en and es expose the same help key paths", () => {
    const enPaths = leafPaths(en.help as unknown as Record<string, unknown>, "help").sort();
    const esPaths = leafPaths(es.help as unknown as Record<string, unknown>, "help").sort();
    expect(esPaths).toEqual(enPaths);
  });

  it("no help string is empty", () => {
    const enPaths = leafPaths(en.help as unknown as Record<string, unknown>);
    for (const value of Object.values(flatten(en.help))) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    expect(enPaths.length).toBeGreaterThan(0);
  });
});

// Flattens nested string objects into a single-level record of leaf values.
function flatten(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      Object.assign(out, flatten(value as Record<string, unknown>));
    } else {
      out[key] = value;
    }
  }
  return out;
}
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/i18n/help.test.ts`
Expected: PASS (both assertions hold for the Task 1 content).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/help.test.ts
git commit -m "test(help): assert en/es help parity and non-empty strings"
```

---

## Task 3: `helpContent.ts` config + config-driven coverage

**Files:**
- Create: `src/components/HelpModal/helpContent.ts`
- Modify: `src/i18n/help.test.ts` (add config-driven assertion)

- [ ] **Step 1: Write the config**

```ts
// Drives the help modal: tabs → sections → items, each referencing i18n keys.
export type DiagramId =
  | "layoutMap"
  | "noteRoleLegend"
  | "shapes"
  | "voiceLeading"
  | "shortcutTable";

export interface HelpItem {
  /** i18n key for the bold lead-in label; omit for plain paragraphs. */
  labelKey?: string;
  /** i18n key for the body text. */
  bodyKey: string;
}

export interface HelpSection {
  /** i18n key for the section heading. */
  titleKey: string;
  /** Optional diagram rendered below the heading. */
  diagram?: DiagramId;
  items: HelpItem[];
}

export interface HelpTab {
  id: "start" | "notes" | "shapes" | "play" | "settings";
  labelKey: string;
  sections: HelpSection[];
}

/** Id of the current What's-new notice. Bump when the notice copy changes. */
export const CURRENT_WHATS_NEW_ID = "2026-06-progressions";

export const HELP_TABS: HelpTab[] = [
  {
    id: "start",
    labelKey: "help.tabs.start",
    sections: [
      {
        titleKey: "help.sections.gettingStarted",
        items: [{ bodyKey: "help.items.introBody" }],
      },
      {
        titleKey: "help.sections.layout",
        diagram: "layoutMap",
        items: [
          { labelKey: "help.items.layoutMobileLabel", bodyKey: "help.items.layoutMobileBody" },
          { labelKey: "help.items.layoutDesktopLabel", bodyKey: "help.items.layoutDesktopBody" },
        ],
      },
      {
        titleKey: "help.sections.inspector",
        items: [
          { labelKey: "help.items.inspectorOverlayLabel", bodyKey: "help.items.inspectorOverlayBody" },
          { labelKey: "help.items.inspectorSongLabel", bodyKey: "help.items.inspectorSongBody" },
        ],
      },
    ],
  },
  {
    id: "notes",
    labelKey: "help.tabs.notes",
    sections: [
      {
        titleKey: "help.sections.noteColors",
        diagram: "noteRoleLegend",
        items: [{ bodyKey: "help.items.noteColorsBody" }],
      },
      {
        titleKey: "help.sections.noteLabels",
        items: [{ labelKey: "help.items.noteLabelsLabel", bodyKey: "help.items.noteLabelsBody" }],
      },
      {
        titleKey: "help.sections.degreeStrip",
        items: [{ bodyKey: "help.items.degreeStripBody" }],
      },
      {
        titleKey: "help.sections.hearNotes",
        items: [{ bodyKey: "help.items.hearNotesBody" }],
      },
    ],
  },
  {
    id: "shapes",
    labelKey: "help.tabs.shapes",
    sections: [
      {
        titleKey: "help.sections.choosingScale",
        items: [
          { labelKey: "help.items.rootLabel", bodyKey: "help.items.rootBody" },
          { labelKey: "help.items.scaleLabel", bodyKey: "help.items.scaleBody" },
          { labelKey: "help.items.parRelLabel", bodyKey: "help.items.parRelBody" },
        ],
      },
      {
        titleKey: "help.sections.patterns",
        diagram: "shapes",
        items: [
          { labelKey: "help.items.patternAllLabel", bodyKey: "help.items.patternAllBody" },
          { labelKey: "help.items.patternCagedLabel", bodyKey: "help.items.patternCagedBody" },
          { labelKey: "help.items.patternNpsLabel", bodyKey: "help.items.patternNpsBody" },
        ],
      },
      {
        titleKey: "help.sections.chordsVoicings",
        items: [
          { labelKey: "help.items.fullChordsLabel", bodyKey: "help.items.fullChordsBody" },
          { labelKey: "help.items.voicingLabel", bodyKey: "help.items.voicingBody" },
        ],
      },
      {
        titleKey: "help.sections.circle",
        items: [{ bodyKey: "help.items.circleBody" }],
      },
    ],
  },
  {
    id: "play",
    labelKey: "help.tabs.play",
    sections: [
      {
        titleKey: "help.sections.diatonic",
        items: [{ bodyKey: "help.items.diatonicBody" }],
      },
      {
        titleKey: "help.sections.buildProgression",
        items: [
          { labelKey: "help.items.presetLabel", bodyKey: "help.items.presetBody" },
          { labelKey: "help.items.sequenceLabel", bodyKey: "help.items.sequenceBody" },
          { labelKey: "help.items.timeLabel", bodyKey: "help.items.timeBody" },
        ],
      },
      {
        titleKey: "help.sections.backingTrack",
        items: [{ bodyKey: "help.items.backingTrackBody" }],
      },
      {
        titleKey: "help.sections.playback",
        diagram: "voiceLeading",
        items: [
          { labelKey: "help.items.transportLabel", bodyKey: "help.items.transportBody" },
          { labelKey: "help.items.voiceLeadingLabel", bodyKey: "help.items.voiceLeadingBody" },
          { labelKey: "help.items.practiceLabel", bodyKey: "help.items.practiceBody" },
        ],
      },
    ],
  },
  {
    id: "settings",
    labelKey: "help.tabs.settings",
    sections: [
      {
        titleKey: "help.sections.settings",
        items: [{ bodyKey: "help.items.settingsBody" }],
      },
      {
        titleKey: "help.sections.shortcuts",
        diagram: "shortcutTable",
        items: [{ bodyKey: "help.items.shortcutsBody" }],
      },
    ],
  },
];
```

- [ ] **Step 2: Add the config-driven coverage assertion** to `src/i18n/help.test.ts`

Append this block inside the existing `describe("i18n/help", …)`:

```ts
  it("every key referenced by HELP_TABS resolves in en and es", async () => {
    const { HELP_TABS } = await import("../components/HelpModal/helpContent");
    const dicts = { en, es } as const;

    const resolve = (dict: typeof en, path: string): unknown =>
      path.split(".").reduce<unknown>(
        (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
        dict,
      );

    const keys = HELP_TABS.flatMap((tab) => [
      tab.labelKey,
      ...tab.sections.flatMap((s) => [
        s.titleKey,
        ...s.items.flatMap((i) => [i.labelKey, i.bodyKey].filter(Boolean) as string[]),
      ]),
    ]);

    for (const lang of ["en", "es"] as const) {
      for (const key of keys) {
        expect(typeof resolve(dicts[lang], key), `${lang}:${key}`).toBe("string");
      }
    }
  });
```

- [ ] **Step 3: Run the test**

Run: `pnpm exec vitest run src/i18n/help.test.ts`
Expected: PASS (all three assertions).

- [ ] **Step 4: Commit**

```bash
git add src/components/HelpModal/helpContent.ts src/i18n/help.test.ts
git commit -m "feat(help): add HELP_TABS config + config-driven i18n coverage test"
```

---

## Task 4: `helpWhatsNewSeenAtom` (replace chord-mode notice)

**Files:**
- Modify: `src/store/uiAtoms.ts:28-33` (replace `seenChordModeRemovalNoticeAtom`)

- [ ] **Step 1: Replace the atom**

In `src/store/uiAtoms.ts`, delete:

```ts
export const seenChordModeRemovalNoticeAtom = atomWithStorage<boolean>(
  k("seenChordModeRemovalNotice"),
  false,
  booleanStorage,
  GET_ON_INIT,
);
```

and add (the file already imports `k`, `rawStringStorage`, `GET_ON_INIT`):

```ts
// Stores the id of the most recently dismissed What's-new notice.
// Empty string means the user has never dismissed any notice.
export const helpWhatsNewSeenAtom = atomWithStorage<string>(
  k("helpWhatsNewSeen"),
  "",
  rawStringStorage<string>(),
  GET_ON_INIT,
);
```

- [ ] **Step 2: Confirm `booleanStorage` is still used elsewhere** (avoid an unused-import lint error)

Run: `rg -n "booleanStorage" src/store/uiAtoms.ts`
Expected: at least one remaining usage (e.g. `themeAtom`/`displayFormatAtom` adapters). If the only match is the import line, remove `booleanStorage` from the import on line 3. Then:

Run: `pnpm exec tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/store/uiAtoms.ts
git commit -m "refactor(help): replace chord-mode notice atom with versioned helpWhatsNewSeenAtom"
```

---

## Task 5: Diagram components

**Files:**
- Create: `src/components/HelpModal/diagrams/diagrams.module.css`
- Create: `src/components/HelpModal/diagrams/LayoutMapDiagram.tsx`
- Create: `src/components/HelpModal/diagrams/NoteRoleLegendDiagram.tsx`
- Create: `src/components/HelpModal/diagrams/ShapeDiagram.tsx`
- Create: `src/components/HelpModal/diagrams/VoiceLeadingDiagram.tsx`
- Create: `src/components/HelpModal/diagrams/ShortcutTableDiagram.tsx`
- Create: `src/components/HelpModal/diagrams/HelpDiagram.tsx`
- Create: `src/components/HelpModal/diagrams/HelpDiagram.test.tsx`

Diagrams reference stable semantic accent tokens already defined in `src/styles/semantic.css`:
`--neon-orange` (chord/root), `--neon-cyan` (scale), `--neon-violet` (color tone),
`--note-incoming` (resolution target). They are intentionally schematic, not a pixel-mirror
of the fretboard fill pipeline.

- [ ] **Step 1: Write the CSS module**

`src/components/HelpModal/diagrams/diagrams.module.css`:

```css
.legend {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  margin: var(--space-2) 0 var(--space-3);
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid currentColor;
}

.legendLabel {
  font-size: 0.875rem;
  color: var(--chrome-fg);
}

.diagram {
  margin: var(--space-2) 0 var(--space-3);
  width: 100%;
  height: auto;
}

.shortcutTable {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-2) 0 var(--space-3);
  font-size: 0.875rem;
}

.shortcutTable td {
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--surface-card-border);
  color: var(--chrome-fg);
}

.keycap {
  display: inline-block;
  min-width: 1.5rem;
  padding: 2px 6px;
  text-align: center;
  border: 1px solid var(--surface-card-border);
  border-radius: var(--radius-sm);
  background: var(--surface-float);
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
}
```

- [ ] **Step 2: Write `NoteRoleLegendDiagram.tsx`**

```tsx
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

const ROLES: { key: string; color: string }[] = [
  { key: "help.roles.root", color: "var(--neon-orange-bright, var(--neon-orange))" },
  { key: "help.roles.chordTone", color: "var(--neon-orange)" },
  { key: "help.roles.scaleNote", color: "var(--neon-cyan)" },
  { key: "help.roles.colorTone", color: "var(--neon-violet)" },
  { key: "help.roles.resolution", color: "var(--note-incoming)" },
];

export function NoteRoleLegendDiagram() {
  const { t } = useTranslation();
  return (
    <dl className={styles.legend} aria-label={t("help.sections.noteColors")}>
      {ROLES.map((role) => (
        <div key={role.key} style={{ display: "contents" }}>
          <dt className={styles.swatch} style={{ color: role.color }} aria-hidden="true" />
          <dd className={styles.legendLabel} style={{ margin: 0 }}>
            {t(role.key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 3: Write `LayoutMapDiagram.tsx`**

```tsx
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

export function LayoutMapDiagram() {
  const { t } = useTranslation();
  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 240 90"
      role="img"
      aria-label={`${t("help.layoutDiagram.mobile")} / ${t("help.layoutDiagram.desktop")}`}
    >
      <g fill="none" stroke="var(--surface-card-border)" strokeWidth="1.5">
        {/* Mobile: stacked board + tab bar */}
        <rect x="8" y="8" width="60" height="50" rx="4" fill="var(--surface-float)" />
        <rect x="8" y="62" width="28" height="18" rx="4" fill="var(--surface-panel)" />
        <rect x="40" y="62" width="28" height="18" rx="4" fill="var(--surface-panel)" />
        {/* Desktop: board + side cards */}
        <rect x="96" y="8" width="84" height="72" rx="4" fill="var(--surface-float)" />
        <rect x="186" y="8" width="46" height="22" rx="4" fill="var(--surface-panel)" />
        <rect x="186" y="33" width="46" height="22" rx="4" fill="var(--surface-panel)" />
        <rect x="186" y="58" width="46" height="22" rx="4" fill="var(--surface-panel)" />
      </g>
      <text x="38" y="20" textAnchor="middle" fontSize="7" fill="var(--chrome-fg-muted)">
        {t("help.layoutDiagram.mobile")}
      </text>
      <text x="164" y="20" textAnchor="middle" fontSize="7" fill="var(--chrome-fg-muted)">
        {t("help.layoutDiagram.desktop")}
      </text>
    </svg>
  );
}
```

- [ ] **Step 4: Write `ShapeDiagram.tsx`**

```tsx
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

// Schematic 6-string × 5-fret grid: a CAGED "box" cluster vs a 3NPS span.
export function ShapeDiagram() {
  const { t } = useTranslation();
  const strings = [0, 1, 2, 3, 4, 5];
  const frets = [0, 1, 2, 3, 4];
  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 240 80"
      role="img"
      aria-label={`${t("help.items.patternCagedLabel")} / ${t("help.items.patternNpsLabel")}`}
    >
      <g stroke="var(--surface-card-border)" strokeWidth="1">
        {strings.map((s) => (
          <line key={`s${s}`} x1="10" y1={10 + s * 12} x2="230" y2={10 + s * 12} />
        ))}
        {frets.map((f) => (
          <line key={`f${f}`} x1={10 + f * 26} y1="10" x2={10 + f * 26} y2="70" />
        ))}
      </g>
      {/* CAGED box: compact cluster (left) */}
      {strings.map((s) => (
        <circle key={`c${s}`} cx={36 + (s % 2) * 26} cy={10 + s * 12} r="4" fill="var(--neon-cyan)" />
      ))}
      {/* 3NPS span: three notes per string marching up the neck (right) */}
      {strings.map((s) =>
        [0, 1, 2].map((n) => (
          <circle
            key={`n${s}-${n}`}
            cx={140 + n * 22 + s * 2}
            cy={10 + s * 12}
            r="4"
            fill="var(--neon-orange)"
          />
        )),
      )}
    </svg>
  );
}
```

- [ ] **Step 5: Write `VoiceLeadingDiagram.tsx`**

```tsx
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

const STATES: { key: string; color: string }[] = [
  { key: "help.voiceLeading.anticipation", color: "var(--note-incoming)" },
  { key: "help.voiceLeading.hold", color: "var(--neon-cyan)" },
  { key: "help.voiceLeading.departing", color: "var(--neon-orange)" },
];

export function VoiceLeadingDiagram() {
  const { t } = useTranslation();
  return (
    <dl className={styles.legend} aria-label={t("help.items.voiceLeadingLabel")}>
      {STATES.map((state) => (
        <div key={state.key} style={{ display: "contents" }}>
          <dt className={styles.swatch} style={{ color: state.color }} aria-hidden="true" />
          <dd className={styles.legendLabel} style={{ margin: 0 }}>
            {t(state.key)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 6: Write `ShortcutTableDiagram.tsx`**

```tsx
import { useTranslation } from "../../../hooks/useTranslation";
import styles from "./diagrams.module.css";

const SHORTCUTS: { keys: string; labelKey: string }[] = [
  { keys: "Space", labelKey: "help.shortcuts.play" },
  { keys: ".", labelKey: "help.shortcuts.stop" },
  { keys: "R", labelKey: "help.shortcuts.loop" },
  { keys: "M", labelKey: "help.shortcuts.mute" },
  { keys: "1", labelKey: "help.shortcuts.track1" },
  { keys: "2", labelKey: "help.shortcuts.track2" },
  { keys: "3", labelKey: "help.shortcuts.track3" },
  { keys: "4", labelKey: "help.shortcuts.track4" },
  { keys: "← →", labelKey: "help.shortcuts.steps" },
  { keys: "S", labelKey: "help.shortcuts.scale" },
  { keys: "C", labelKey: "help.shortcuts.chord" },
];

export function ShortcutTableDiagram() {
  const { t } = useTranslation();
  return (
    <table className={styles.shortcutTable}>
      <tbody>
        {SHORTCUTS.map((s) => (
          <tr key={s.labelKey}>
            <td>
              <span className={styles.keycap}>{s.keys}</span>
            </td>
            <td>{t(s.labelKey)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 7: Write `HelpDiagram.tsx` (the switch)**

```tsx
import type { DiagramId } from "../helpContent";
import { LayoutMapDiagram } from "./LayoutMapDiagram";
import { NoteRoleLegendDiagram } from "./NoteRoleLegendDiagram";
import { ShapeDiagram } from "./ShapeDiagram";
import { VoiceLeadingDiagram } from "./VoiceLeadingDiagram";
import { ShortcutTableDiagram } from "./ShortcutTableDiagram";

export function HelpDiagram({ id }: { id: DiagramId }) {
  switch (id) {
    case "layoutMap":
      return <LayoutMapDiagram />;
    case "noteRoleLegend":
      return <NoteRoleLegendDiagram />;
    case "shapes":
      return <ShapeDiagram />;
    case "voiceLeading":
      return <VoiceLeadingDiagram />;
    case "shortcutTable":
      return <ShortcutTableDiagram />;
  }
}
```

- [ ] **Step 8: Write the smoke test** `HelpDiagram.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HelpDiagram } from "./HelpDiagram";
import type { DiagramId } from "../helpContent";

const IDS: DiagramId[] = [
  "layoutMap",
  "noteRoleLegend",
  "shapes",
  "voiceLeading",
  "shortcutTable",
];

describe("HelpModal/diagrams/HelpDiagram", () => {
  it.each(IDS)("renders the %s diagram without error", (id) => {
    const { container } = render(<HelpDiagram id={id} />);
    expect(container.firstChild).not.toBeNull();
  });
});
```

- [ ] **Step 9: Run the smoke test**

Run: `pnpm exec vitest run src/components/HelpModal/diagrams/HelpDiagram.test.tsx`
Expected: PASS (5 cases).

- [ ] **Step 10: Commit**

```bash
git add src/components/HelpModal/diagrams
git commit -m "feat(help): add theme-aware inline-SVG help diagrams"
```

---

## Task 6: Rewrite `HelpModal.tsx`

**Files:**
- Modify: `src/components/HelpModal/HelpModal.tsx` (full body replacement)
- Modify: `src/components/HelpModal/HelpModal.module.css` (add tab styles)

The Radix Dialog shell, overlay, `motion` animation, sizing, and close button are preserved. Only the inner content (`help-modal-content`) changes to tabs + active panel, and the title/close use i18n.

- [ ] **Step 1: Add tab-bar styles** to `HelpModal.module.css`

Append:

```css
.help-modal-tabs {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2) clamp(1rem, 3vw, 1.25rem) 0;
  flex-wrap: wrap;
  flex-shrink: 0;
  border-bottom: 1px solid var(--surface-card-header-border);
  background: var(--surface-float);
}

.help-modal-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--chrome-fg-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.help-modal-tab:hover {
  color: var(--chrome-fg);
}

.help-modal-tab[aria-selected="true"] {
  color: var(--chrome-fg);
  border-bottom-color: var(--neon-cyan);
}

.help-modal-tab:focus-visible {
  outline: 2px solid var(--neon-cyan);
  outline-offset: -2px;
}

.help-modal-item-label {
  font-weight: 600;
  color: var(--chrome-fg);
}
```

- [ ] **Step 2: Replace the component body**

Replace the entire contents of `HelpModal.tsx` with:

```tsx
import { type RefObject, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAtom } from "jotai";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ANIMATION_DURATION_FAST, ANIMATION_EASE } from "@fretflow/core";
import { useTranslation } from "../../hooks/useTranslation";
import { helpWhatsNewSeenAtom } from "../../store/uiAtoms";
import { HELP_TABS, CURRENT_WHATS_NEW_ID, type HelpTab } from "./helpContent";
import { HelpDiagram } from "./diagrams/HelpDiagram";
import styles from "./HelpModal.module.css";
import sharedStyles from "../shared/shared.module.css";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

function HelpTabPanel({ tab }: { tab: HelpTab }) {
  const { t } = useTranslation();
  return (
    <div role="tabpanel" id={`help-panel-${tab.id}`} aria-labelledby={`help-tab-${tab.id}`}>
      {tab.sections.map((section) => (
        <section key={section.titleKey}>
          <h3>{t(section.titleKey)}</h3>
          {section.diagram ? <HelpDiagram id={section.diagram} /> : null}
          {section.items.map((item) => (
            <p key={item.bodyKey}>
              {item.labelKey ? (
                <>
                  <strong className={styles["help-modal-item-label"]}>
                    {t(item.labelKey)}
                  </strong>{" "}
                </>
              ) : null}
              {t(item.bodyKey)}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useTranslation();
  const [whatsNewSeen, setWhatsNewSeen] = useAtom(helpWhatsNewSeenAtom);
  const [activeTabId, setActiveTabId] = useState<HelpTab["id"]>("start");

  const activeTab = HELP_TABS.find((tab) => tab.id === activeTabId) ?? HELP_TABS[0];
  const showWhatsNew = whatsNewSeen !== CURRENT_WHATS_NEW_ID;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {isOpen ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className={styles["help-modal-overlay"]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className={styles["help-modal"]}
                data-testid="help-modal"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: ANIMATION_DURATION_FAST, ease: ANIMATION_EASE }}
              >
                <div className={styles["help-modal-header"]}>
                  <Dialog.Title className={styles["help-modal-title"]}>
                    {t("help.title")}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className={clsx(
                        sharedStyles["icon-button"],
                        sharedStyles["icon-button--sm"],
                        styles["help-modal-close"],
                      )}
                      aria-label={t("help.close")}
                    >
                      <X className="icon" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className={styles["help-modal-tabs"]} role="tablist" aria-label={t("help.title")}>
                  {HELP_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`help-tab-${tab.id}`}
                      aria-selected={tab.id === activeTabId}
                      aria-controls={`help-panel-${tab.id}`}
                      className={styles["help-modal-tab"]}
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      {t(tab.labelKey)}
                    </button>
                  ))}
                </div>

                <div className={styles["help-modal-content"]} data-testid="help-modal-content">
                  {showWhatsNew && activeTabId === "start" ? (
                    <aside
                      className={styles["help-modal-notice"]}
                      data-testid="help-modal-whats-new"
                      aria-label={t("help.whatsNew.label")}
                    >
                      <h3 className={styles["help-modal-notice-title"]}>
                        {t("help.whatsNew.label")}
                      </h3>
                      <p>{t("help.whatsNew.body")}</p>
                      <button
                        type="button"
                        className={styles["help-modal-notice-dismiss"]}
                        onClick={() => setWhatsNewSeen(CURRENT_WHATS_NEW_ID)}
                      >
                        {t("help.whatsNew.dismiss")}
                      </button>
                    </aside>
                  ) : null}

                  <HelpTabPanel tab={activeTab} />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/HelpModal/HelpModal.tsx src/components/HelpModal/HelpModal.module.css
git commit -m "feat(help): render tabbed help modal from config with diagrams + whats-new"
```

---

## Task 7: Rewrite `HelpModal.test.tsx`

**Files:**
- Modify: `src/components/HelpModal/HelpModal.test.tsx` (full replacement)

- [ ] **Step 1: Replace the test file**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { HelpModal } from "./HelpModal";
import styles from "./HelpModal.module.css";
import { en } from "../../i18n/en";
import { CURRENT_WHATS_NEW_ID } from "./helpContent";
import { makeAtomStore, renderWithStore } from "../../test-utils/renderWithAtoms";
import { helpWhatsNewSeenAtom } from "../../store/uiAtoms";

describe("HelpModal/HelpModal", () => {
  it("renders dialog when isOpen=true", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: en.help.title })).toBeInTheDocument();
  });

  it("does not render dialog when isOpen=false", () => {
    render(<HelpModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog", { name: en.help.title })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(en.help.close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the close button when the dialog opens", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText(en.help.close));
  });

  it("renders a tab for every help tab and starts on Start", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(screen.getByRole("tab", { name: en.help.tabs.start })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches panels when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    // Start tab shows the intro; Play tab does not.
    expect(screen.getByText(en.help.items.introBody)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: en.help.tabs.play }));
    expect(screen.queryByText(en.help.items.introBody)).not.toBeInTheDocument();
    expect(screen.getByText(en.help.items.backingTrackBody)).toBeInTheDocument();
  });

  it("documents the real keyboard shortcuts on the Settings tab", async () => {
    const user = userEvent.setup();
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: en.help.tabs.settings }));
    expect(screen.getByText(en.help.shortcuts.play)).toBeInTheDocument();
    expect(screen.getByText(en.help.shortcuts.loop)).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
  });

  it("does not contain stale Theory/View Inspector labels", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const strong = Array.from(document.querySelectorAll("strong")).map((el) => el.textContent);
    expect(strong).not.toContain("Theory");
    expect(strong).not.toContain("View");
  });

  it("does not contain a stale Focus section or removed lens names", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const strong = Array.from(document.querySelectorAll("strong")).map((el) => el.textContent);
    expect(strong).not.toContain("Focus");
    expect(screen.queryByText(/Tones lens/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lead lens/i)).not.toBeInTheDocument();
  });

  it("shows the What's-new notice when the current id has not been seen", () => {
    const store = makeAtomStore([[helpWhatsNewSeenAtom, ""]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    expect(screen.getByTestId("help-modal-whats-new")).toBeInTheDocument();
  });

  it("hides the What's-new notice when the current id has been seen", () => {
    const store = makeAtomStore([[helpWhatsNewSeenAtom, CURRENT_WHATS_NEW_ID]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    expect(screen.queryByTestId("help-modal-whats-new")).not.toBeInTheDocument();
  });

  it("dismissing the notice stores the current id and hides it", async () => {
    const user = userEvent.setup();
    const store = makeAtomStore([[helpWhatsNewSeenAtom, ""]]);
    renderWithStore(<HelpModal isOpen={true} onClose={vi.fn()} />, store);
    await user.click(screen.getByRole("button", { name: en.help.whatsNew.dismiss }));
    expect(store.get(helpWhatsNewSeenAtom)).toBe(CURRENT_WHATS_NEW_ID);
    expect(screen.queryByTestId("help-modal-whats-new")).not.toBeInTheDocument();
  });

  it("renders the close button at the sm icon-button size", () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText(en.help.close).className).toMatch(/icon-button--sm/);
    // keep the module import referenced
    expect(typeof styles["help-modal-close"]).toBe("string");
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/components/HelpModal/HelpModal.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 3: Commit**

```bash
git add src/components/HelpModal/HelpModal.test.tsx
git commit -m "test(help): cover tabbed modal, shortcuts, stale-term guards, whats-new"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: PASS. If an unused import remains in `uiAtoms.ts` or `HelpModal.tsx`, remove it and re-run.

- [ ] **Step 2: Full test suite**

Run: `pnpm run test`
Expected: PASS. Pay attention to any other test that imported `seenChordModeRemovalNoticeAtom`; search and update:
Run: `rg -n "seenChordModeRemovalNotice" src`
Expected: no matches. If any remain (e.g. a snapshot or another test), update them to `helpWhatsNewSeenAtom` semantics.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: PASS (`tsc -b && vite build`).

- [ ] **Step 4: Visual snapshots (if the help modal has a committed snapshot)**

Run: `rg -l "help" e2e`
If the help modal appears in a visual suite, run `pnpm run test:visual:update` and review the diff before committing the updated snapshot. Otherwise skip.

- [ ] **Step 5: Final commit (only if Step 1/2/4 changed files)**

```bash
git add -A
git commit -m "chore(help): lint/test cleanup after help modal redesign"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** tabbed structure (Task 6), full en+es i18n (Tasks 1–3), 5 inline-SVG diagrams keyed to semantic tokens (Task 5), versioned What's-new atom (Task 4), corrected shortcuts/Inspector/voicings/settings copy (Task 1 content), rewritten tests incl. i18n parity (Tasks 2, 3, 7). All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; every code step contains complete code; all i18n strings provided in both languages.
- **Type consistency:** `HelpTab["id"]` union (`start|notes|shapes|play|settings`) is used identically in `helpContent.ts`, `HelpModal.tsx`, and the tests; `DiagramId` union matches the `HelpDiagram` switch arms one-to-one (`layoutMap`, `noteRoleLegend`, `shapes`, `voiceLeading`, `shortcutTable`); `helpWhatsNewSeenAtom` stores a string id consistently across atom, modal, and tests; `CURRENT_WHATS_NEW_ID` is the single source of truth.
```
