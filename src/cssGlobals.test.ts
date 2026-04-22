import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

/**
 * Approved global CSS classes — strings hardcoded in className attributes.
 * Module-scoped classes (from *.module.css imports) are excluded automatically.
 *
 * Format: class name → reason/justification
 *
 * **Style classes** (intentional, semantic, cross-component):
 * - app-container: layout wrapper, app-level structure
 * - panel-surface: shared panel styling; variants: --compact, --inset
 * - dashboard-card: card wrapper for dashboard layout
 * - icon: icon size/spacing utility for lucide-react icons
 * - icon-active, icon-muted: icon state modifiers
 * - loading-spinner: Suspense fallback animation
 * - custom-scrollbar: scrollbar styling utility
 * - brand-mark: brand icon container
 * - hide-scrollbar: scrollbar hiding utility
 *
 * **Note state/semantic classes** (fretboard data-driven, no CSS):
 * - root-active: root note highlight (data-driven)
 * - note-active: scale note highlight
 * - note-blue: blue note emphasis
 * - chord-tone: chord membership
 * - note-scale-only: scale note without chord overlay
 * - note-scale-dimmed: scale note dimmed by chord overlay
 * - chord-outside: out-of-scale chord note
 * - note-inactive: no role (hidden by default)
 * - note-dimmed: reduced emphasis (unused; deprecated)
 * - note-played: ping animation after synth
 * - note-enharmonic: enharmonic label styling
 * - note-main-label: main note label
 * - hidden: visibility state (no CSS rule)
 *
 * **Utility/behavioral classes** (CSS rules or no CSS):
 * - fretboard-board: fretboard container
 * - fretboard-neck: fretboard inner wrapper
 * - fretboard-main-svg: SVG viewport
 * - fretboard-outer: outer fretboard wrapper
 * - fretboard-wrapper: scroll container
 * - string-row: string row container (no CSS rule; layout only)
 * - string-line: string line element
 * - string-notes: notes container
 * - note-cell: note cell container
 * - note-bubble: note circle button
 * - marker-dot: fret marker circle
 * - marker-double: double marker container
 * - fret-backgrounds: fret column backgrounds
 * - fret-column: fret column element
 * - fret-zero: nut fret styling
 * - fret-standard: standard fret wire styling
 * - fret-numbers-row: fret numbers display
 * - fret-number: individual fret number
 * - strings-container: strings layer
 * - fret-marker-container: marker positioning container
 *
 * **Form/control utilities**:
 * - control-group: control grouping container
 * - col-span-2: flex column spanning utility
 * - controls-panel, controls-panel--dashboard: panel wrapper
 * - controls-panel-column: column layout helper
 * - toolbar-btn: small action button
 * - viewport-jumps, zoom-controls, fret-range-controls: toolbar containers
 * - toolbar-range-val, toolbar-range-sep: range display
 * - pattern-btn: pattern selection button
 * - pattern-list: pattern list container
 * - pattern-section: pattern section wrapper
 * - mode-grid: layout grid for mode buttons
 * - tuning-select, tuning-select-label: tuning control
 * - badge: badge display
 * - range-separator: range separator symbol
 * - error-fallback: error boundary fallback
 * - main-fretboard: main fretboard wrapper
 *
 * **Disclosure/summary utilities**:
 * - summary-area, summary-content: summary container
 * - summary-row, summary-row--chord: summary row styling
 * - summary-row-label: summary label
 * - summary-note, summary-note--chord: note display
 * - summary-note-name, summary-note-degree: note parts
 * - summary-notes: notes flex container
 * - summary-disclosure-btn, summary-disclosure-btn--open: disclosure toggle
 * - summary-disclosure-label, summary-disclosure-icon: disclosure parts
 *
 * **Circle of Fifths**:
 * - circle-slice-focus-ring: CoF slice focus
 * - circle-note-label: CoF note label
 * - circle-degree-label: CoF degree label
 * - circle-center-note: CoF center note
 * - circle-center-signature: CoF signature
 *
 * **Mobile/Responsive**:
 * - mobile-tab-panel, mobile-theory-tab, mobile-view-tab: mobile tab sections
 * - mobile-tab-content: tab content wrapper
 * - cof-container, cof-toggle: mobile CoF container
 * - fret-range-mobile, fret-range-group, fret-range-label: mobile fret range
 *
 * **Settings/UI overlays**:
 * - help-modal-overlay, help-modal, help-modal--full-width: help modal styling
 * - help-modal-header, help-modal-close, help-modal-content: modal parts
 * - version-badge, kofi-badge-btn, kofi-badge-icon: version/donation footer
 * - kofi-header-btn, kofi-btn-desktop, kofi-btn-mobile: header donation button
 *
 * **Chord/degree components**:
 * - chord-row-strip-header, chord-row-list, chord-row-item: chord row structure
 * - chord-row-chip, chord-row-note, chord-row-interval: chord parts
 * - chord-row-legend, chord-row-legend-item, chord-row-legend-swatch, chord-row-legend-label: legend
 * - degree-chip-strip-header, degree-chip-strip-list: degree list
 * - degree-chip-item, degree-chip, degree-chip-note, degree-chip-interval: degree parts
 * - scale-eye-toggle: scale visibility toggle
 *
 * **Fret range display**:
 * - fret-group, fret-start, fret-end: fret group structure
 * - fret-label, fret-value, fret-btn: fret parts
 *
 * **Layout/spacing**:
 * - summary-shell: summary container shell
 * - chord-dock-shell: chord dock container shell
 * - chord-overlay-dock: chord overlay dock
 *
 * **Scale selector**:
 * - theory-mode-browser: scale browser container
 * - theory-browser-main, theory-browser-selector: browser parts
 * - theory-nav-btn: browser navigation button
 * - theory-chord-section, theory-chord-content: chord section container
 * - theory-disclosure-title, theory-disclosure-summary: disclosure text
 */
const APPROVED_GLOBALS = new Set([
  // Core semantic/utility classes (truly cross-cutting)
  "app-container",
  "panel-surface",
  "panel-surface--compact",
  "panel-surface--inset",
  "icon",
  "icon-active",
  "icon-muted",
  "loading-spinner",
  "custom-scrollbar",
  "hide-scrollbar",
  "brand-mark",
]);

/**
 * Scan TSX files for hardcoded global class names.
 * Ignores:
 *   - dynamic class generation (className={`...${var}...`})
 *   - clsx() calls
 *   - cva() calls
 *   - imports from .module.css
 * Only matches simple string literals: className="foo" or className='foo'
 */
function scanGlobalClasses(srcDir: string): Set<string> {
  const found = new Set<string>();
  const tsxFiles = findTsxFiles(srcDir);

  for (const file of tsxFiles) {
    const content = readFileSync(file, "utf-8");
    // Match className="..." or className='...' (quoted string literals only)
    // Supports both className="foo" and className={'bar'} formats with optional whitespace
    const matches = content.matchAll(
      /className=\{?\s*["']([a-z-]+(?:\s+[a-z-]+)*)["']\s*\}?/g
    );

    for (const match of matches) {
      const classes = match[1].split(/\s+/);
      for (const cls of classes) {
        // Skip module-scoped patterns (contain uppercase, numbers from hashing)
        if (!/^[a-z-]+$/.test(cls)) continue;
        // Skip very short classes that look like modules
        if (cls.length < 3) continue;
        found.add(cls);
      }
    }
  }

  return found;
}

function findTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findTsxFiles(entryPath));
      }
    } else if (entry.name.endsWith(".tsx")) {
      files.push(entryPath);
    }
  }

  return files;
}

describe("CSS Global Classes Guard", () => {
  const srcDir = join(__dirname, "..");

  it("should only use approved global class names", () => {
    const found = scanGlobalClasses(srcDir);
    const unapproved = Array.from(found).filter((cls) => !APPROVED_GLOBALS.has(cls));

    if (unapproved.length > 0) {
      const message =
        "Found unapproved global class names. Add them to APPROVED_GLOBALS with justification:\n" +
        unapproved.map((cls) => `  - "${cls}"`).join("\n");
      expect.fail(message);
    } else {
      expect(unapproved).toEqual([]);
    }
  });
});
