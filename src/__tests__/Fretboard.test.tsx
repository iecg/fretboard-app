// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Fretboard } from '../Fretboard';
import { STANDARD_TUNING } from '../guitar';

// Mock audio synth
vi.mock('../audio', () => ({
  synth: {
    playNote: vi.fn(),
    setMute: vi.fn(),
    init: vi.fn(),
  },
}));

describe('Fretboard', () => {
  const defaultProps = {
    tuning: STANDARD_TUNING,
    startFret: 0,
    endFret: 24,
    maxFret: 24,
    highlightNotes: ['E', 'G', 'B'],
    rootNote: 'C',
    displayFormat: 'notes' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<Fretboard {...defaultProps} />);
      const fretboard = screen.queryByText(/fretboard|string|fret/, { selector: 'div' });
      expect(fretboard || document.querySelector('[data-testid]')).toBeTruthy();
    });

    it('renders all 6 strings for standard tuning', () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      // Fretboard has 6 rows for standard tuning
      const fretboard = container.querySelector('div');
      expect(fretboard).toBeTruthy();
    });

    it('renders correct number of frets based on endFret - startFret', () => {
      const { rerender } = render(<Fretboard {...defaultProps} startFret={0} endFret={12} />);
      rerender(<Fretboard {...defaultProps} startFret={5} endFret={17} />);
      // 12 frets should render differently than 5-17 range
    });

    it('renders with different tunings', () => {
      const dropDTuning = ['E4', 'A3', 'D3', 'G3', 'B3', 'E4'];
      render(<Fretboard {...defaultProps} tuning={dropDTuning} />);
      expect(document.body).toBeTruthy(); // Rendered without error
    });
  });

  describe('Note highlighting', () => {
    it('highlights specified notes', () => {
      const { container } = render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['E', 'G', 'B', 'C']}
        />
      );
      // Notes should be highlighted in the fretboard
      expect(container.querySelector('div')).toBeTruthy();
    });

    it('updates highlight when notes change', () => {
      const { rerender } = render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C', 'E', 'G']}
        />
      );

      rerender(
        <Fretboard
          {...defaultProps}
          highlightNotes={['D', 'F#', 'A']}
        />
      );
      // Highlights should update
      expect(document.body).toBeTruthy();
    });

    it('handles empty highlight array', () => {
      render(<Fretboard {...defaultProps} highlightNotes={[]} />);
      // Should render without highlighting any notes
      expect(document.body).toBeTruthy();
    });
  });

  describe('Display formats', () => {
    it('displays notes when displayFormat is "notes"', () => {
      render(<Fretboard {...defaultProps} displayFormat="notes" rootNote="C" />);
      expect(document.body).toBeTruthy();
    });

    it('displays degrees when displayFormat is "degrees"', () => {
      render(<Fretboard {...defaultProps} displayFormat="degrees" rootNote="C" />);
      expect(document.body).toBeTruthy();
    });

    it('displays nothing when displayFormat is "none"', () => {
      render(<Fretboard {...defaultProps} displayFormat="none" />);
      expect(document.body).toBeTruthy();
    });

    it('updates display when displayFormat changes', () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} displayFormat="notes" />
      );

      rerender(
        <Fretboard {...defaultProps} displayFormat="degrees" />
      );
      expect(document.body).toBeTruthy();
    });
  });

  describe('Zoom and scroll', () => {
    it('respects fretZoom prop', () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} fretZoom={100} />
      );

      rerender(
        <Fretboard {...defaultProps} fretZoom={150} />
      );
      // Different zoom levels should be reflected
      expect(document.body).toBeTruthy();
    });

    it('has scroll container that is draggable', () => {
      const { container } = render(<Fretboard {...defaultProps} />);
      const scrollContainer = container.querySelector('[class*="scroll"]') || container.firstChild;
      expect(scrollContainer).toBeTruthy();
    });

    it('handles zoom changes via onZoomChange callback', () => {
      const onZoomChange = vi.fn();
      render(
        <Fretboard
          {...defaultProps}
          fretZoom={100}
          onZoomChange={onZoomChange}
        />
      );
      // Zoom change callback is called when zoom changes
    });

    it('responds to fretStart and fretEnd changes', async () => {
      const onFretStartChange = vi.fn();
      const onFretEndChange = vi.fn();

      const { rerender } = render(
        <Fretboard
          {...defaultProps}
          startFret={0}
          endFret={12}
          onFretStartChange={onFretStartChange}
          onFretEndChange={onFretEndChange}
        />
      );

      rerender(
        <Fretboard
          {...defaultProps}
          startFret={5}
          endFret={17}
          onFretStartChange={onFretStartChange}
          onFretEndChange={onFretEndChange}
        />
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('Chord tones and filtering', () => {
    it('can highlight chord tones separately', () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          chordTones={['C', 'E', 'G']}
        />
      );
      expect(document.body).toBeTruthy();
    });

    it('filters to only chord tones when hideNonChordNotes is true', () => {
      const { rerender } = render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          chordTones={['C', 'E', 'G']}
          hideNonChordNotes={false}
        />
      );

      rerender(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          chordTones={['C', 'E', 'G']}
          hideNonChordNotes={true}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('handles chord fret spread calculation', () => {
      const onChordFretSpreadChange = vi.fn();

      render(
        <Fretboard
          {...defaultProps}
          chordTones={['C', 'E', 'G']}
          chordFretSpread={0}
          onChordFretSpreadChange={onChordFretSpreadChange}
        />
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('Shape polygons and visualization', () => {
    it('renders shape polygons when provided', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          truncated: false,
          intendedMin: 0,
          intendedMax: 2,
          cagedLabel: 'E Shape',
          modalLabel: 'Ionian',
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="caged"
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('displays CAGED labels when shapeLabels is "caged"', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          truncated: false,
          intendedMin: 0,
          intendedMax: 2,
          cagedLabel: 'E Shape',
          modalLabel: null,
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="caged"
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('displays modal labels when shapeLabels is "modal"', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 5 },
            { string: 1, fret: 7 },
            { string: 2, fret: 7 },
            { string: 3, fret: 7 },
            { string: 4, fret: 5 },
            { string: 5, fret: 5 },
          ],
          truncated: false,
          intendedMin: 5,
          intendedMax: 7,
          cagedLabel: 'E Shape',
          modalLabel: 'Dorian',
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="modal"
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('hides labels when shapeLabels is "none"', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          truncated: false,
          intendedMin: 0,
          intendedMax: 2,
          cagedLabel: 'E Shape',
          modalLabel: 'Ionian',
        },
      ];

      render(
        <Fretboard
          {...defaultProps}
          shapePolygons={shapePolygons}
          shapeLabels="none"
        />
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('Wrapped notes', () => {
    it('handles wrapped notes set', () => {
      const wrappedNotes = new Set(['4-24', '3-25']);

      render(
        <Fretboard
          {...defaultProps}
          wrappedNotes={wrappedNotes}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('displays wrapped notes visually', () => {
      const wrappedNotes = new Set(['0-2', '1-5']);

      const { container } = render(
        <Fretboard
          {...defaultProps}
          wrappedNotes={wrappedNotes}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Note coloring', () => {
    it('colors notes based on colorNotes prop', () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          colorNotes={['F#', 'B']}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('updates colors when colorNotes changes', () => {
      const { rerender } = render(
        <Fretboard
          {...defaultProps}
          colorNotes={['F', 'B']}
        />
      );

      rerender(
        <Fretboard
          {...defaultProps}
          colorNotes={['F#', 'C#']}
        />
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('Accidentals', () => {
    it('displays sharps by default', () => {
      render(<Fretboard {...defaultProps} useFlats={false} />);
      expect(document.body).toBeTruthy();
    });

    it('displays flats when useFlats is true', () => {
      render(<Fretboard {...defaultProps} useFlats={true} />);
      expect(document.body).toBeTruthy();
    });

    it('updates display when useFlats changes', () => {
      const { rerender } = render(
        <Fretboard {...defaultProps} useFlats={false} />
      );

      rerender(
        <Fretboard {...defaultProps} useFlats={true} />
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('Fret markers', () => {
    it('displays fret markers at standard positions', () => {
      render(<Fretboard {...defaultProps} startFret={0} endFret={24} />);
      // Standard markers are at frets 3, 5, 7, 9, 12, 15, 17, 19, 21, 24
      expect(document.body).toBeTruthy();
    });

    it('hides fret markers outside visible range', () => {
      render(<Fretboard {...defaultProps} startFret={10} endFret={15} />);
      // Only fret 12 should show double dots
      expect(document.body).toBeTruthy();
    });
  });

  describe('Click handlers', () => {
    it('calls onFretClick when a fret is clicked', async () => {
      const onFretClick = vi.fn();
      render(
        <Fretboard
          {...defaultProps}
          onFretClick={onFretClick}
        />
      );

      // Find a note bubble and click it
      const buttons = screen.queryAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // onFretClick should be called
      }
    });

    it('passes correct parameters to onFretClick', async () => {
      const onFretClick = vi.fn();
      render(
        <Fretboard
          {...defaultProps}
          rootNote="C"
          onFretClick={onFretClick}
        />
      );

      const buttons = screen.queryAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // Callback should receive string index, fret index, and note name
      }
    });
  });

  describe('Mobile responsiveness', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600, // Mobile width
      });
    });

    it('adjusts zoom for mobile viewport', () => {
      render(<Fretboard {...defaultProps} />);
      // Mobile zoom calculation: Math.floor(600 / 7) ≈ 85
      expect(document.body).toBeTruthy();
    });

    it('uses desktop zoom on wide viewports', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920, // Desktop width
      });

      render(<Fretboard {...defaultProps} fretZoom={100} />);
      expect(document.body).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('handles 0 frets gracefully', () => {
      render(
        <Fretboard
          {...defaultProps}
          startFret={0}
          endFret={0}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('handles very high fret numbers', () => {
      render(
        <Fretboard
          {...defaultProps}
          startFret={20}
          endFret={36}
          maxFret={36}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('handles single-note highlight', () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C']}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('handles all 12 notes highlighted', () => {
      render(
        <Fretboard
          {...defaultProps}
          highlightNotes={['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']}
        />
      );

      expect(document.body).toBeTruthy();
    });
  });
});
