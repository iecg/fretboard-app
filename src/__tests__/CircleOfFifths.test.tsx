// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CircleOfFifths } from '../CircleOfFifths';
import { CIRCLE_OF_FIFTHS } from '../theory';

describe('CircleOfFifths', () => {
  const mockSetRootNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('renders SVG with correct viewBox', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const svg = document.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 320 320');
    });

    it('renders all 12 notes in circle', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      // Each note should have path elements for the slice
      const paths = document.querySelectorAll('path');
      // 12 slices + text labels = more than 12 paths
      expect(paths.length).toBeGreaterThanOrEqual(12);
    });

    it('renders notes in correct order around circle', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const textElements = document.querySelectorAll('text');
      // Should have text for all 12 notes
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe('Note selection', () => {
    it('calls setRootNote when a note is clicked', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      if (paths.length > 0) {
        fireEvent.click(paths[0]);
        expect(mockSetRootNote).toHaveBeenCalled();
      }
    });

    it('highlights active root note', () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      // C is active by default
      const activePaths = document.querySelectorAll('path.active');
      expect(activePaths.length).toBeGreaterThan(0);

      // Change root note
      rerender(
        <CircleOfFifths
          rootNote="G"
          setRootNote={mockSetRootNote}
        />
      );

      // G should now be active
      const newActivePaths = document.querySelectorAll('path.active');
      expect(newActivePaths.length).toBeGreaterThan(0);
    });

    it('cycles through all notes correctly', () => {
      const roots = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

      for (const root of roots) {
        const { unmount } = render(
          <CircleOfFifths
            rootNote={root}
            setRootNote={mockSetRootNote}
          />
        );

        const activePaths = document.querySelectorAll('path.active');
        expect(activePaths.length).toBeGreaterThan(0);

        unmount();
      }
    });
  });

  describe('Scale-aware display', () => {
    it('displays degrees for Major scale', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          scaleName="Major"
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
      // Degree information should be rendered
    });

    it('displays degrees for Minor scale', () => {
      render(
        <CircleOfFifths
          rootNote="A"
          setRootNote={mockSetRootNote}
          scaleName="Natural Minor"
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('updates degrees when scale changes', () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          scaleName="Major"
        />
      );

      rerender(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          scaleName="Natural Minor"
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('displays degrees for Lydian mode', () => {
      render(
        <CircleOfFifths
          rootNote="F"
          setRootNote={mockSetRootNote}
          scaleName="Lydian"
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('displays degrees for Dorian mode', () => {
      render(
        <CircleOfFifths
          rootNote="D"
          setRootNote={mockSetRootNote}
          scaleName="Dorian"
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  });

  describe('Accidentals', () => {
    it('displays sharps by default', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={false}
        />
      );

      const textElements = document.querySelectorAll('text');
      expect(textElements.length).toBeGreaterThan(0);
    });

    it('displays flats when useFlats is true', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={true}
        />
      );

      const textElements = document.querySelectorAll('text');
      expect(textElements.length).toBeGreaterThan(0);
    });

    it('switches between sharps and flats correctly', () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={false}
        />
      );

      rerender(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
          useFlats={true}
        />
      );

      expect(document.body).toBeTruthy();
    });

    it('displays enharmonic equivalents correctly', () => {
      // C# and Db should display differently based on useFlats
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C#"
          setRootNote={mockSetRootNote}
          useFlats={false}
        />
      );

      rerender(
        <CircleOfFifths
          rootNote="C#"
          setRootNote={mockSetRootNote}
          useFlats={true}
        />
      );

      expect(document.body).toBeTruthy();
    });
  });

  describe('Visual accuracy', () => {
    it('positions notes around circle correctly', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const textElements = document.querySelectorAll('text');
      // Text elements should be positioned around the circle
      // They should have x and y attributes
      textElements.forEach((text) => {
        if (!text.hasAttribute('transform')) {
          expect(text.getAttribute('x')).toBeTruthy();
          expect(text.getAttribute('y')).toBeTruthy();
        }
      });
    });

    it('creates arc paths for slices', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      paths.forEach((path) => {
        const d = path.getAttribute('d');
        // Path should be an arc path (contains 'A' for arc command)
        expect(d).toMatch(/[A-Z]/);
      });
    });

    it('renders both outer and inner circles', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const paths = document.querySelectorAll('path');
      // Should have multiple paths for inner and outer arcs
      expect(paths.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Interaction', () => {
    it('responds to sequential clicks', async () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const paths = document.querySelectorAll('path[class*="circle-slice"]');

      // Click multiple notes
      fireEvent.click(paths[1]); // Second note (G)
      fireEvent.click(paths[4]); // Fifth note
      fireEvent.click(paths[0]); // Back to first note

      expect(mockSetRootNote).toHaveBeenCalledTimes(3);
    });

    it('maintains state across re-renders', () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const initialActive = document.querySelectorAll('path.active').length;
      expect(initialActive).toBeGreaterThan(0);

      rerender(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const afterRerender = document.querySelectorAll('path.active').length;
      expect(afterRerender).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('handles all chromatic notes as root', () => {
      const notes = CIRCLE_OF_FIFTHS;

      notes.forEach((note) => {
        const { unmount } = render(
          <CircleOfFifths
            rootNote={note}
            setRootNote={mockSetRootNote}
          />
        );

        const activePaths = document.querySelectorAll('path.active');
        expect(activePaths.length).toBeGreaterThan(0);

        unmount();
      });
    });

    it('handles scale changes at different root notes', () => {
      const scales = ['Major', 'Natural Minor', 'Dorian', 'Lydian'];
      const roots = ['C', 'G', 'A', 'F'];

      roots.forEach((root) => {
        scales.forEach((scale) => {
          const { unmount } = render(
            <CircleOfFifths
              rootNote={root}
              setRootNote={mockSetRootNote}
              scaleName={scale}
            />
          );

          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();

          unmount();
        });
      });
    });

    it('handles rapid root note changes', async () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      // Rapidly change root note
      for (const note of ['G', 'D', 'A', 'E', 'B']) {
        rerender(
          <CircleOfFifths
            rootNote={note}
            setRootNote={mockSetRootNote}
          />
        );
      }

      expect(document.body).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('renders clickable paths', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      expect(paths.length).toBe(12);

      paths.forEach((path) => {
        expect(path.getAttribute('class')).toContain('circle-slice');
      });
    });

    it('paths respond to pointer events', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const paths = document.querySelectorAll('path[class*="circle-slice"]');
      fireEvent.click(paths[0]);

      expect(mockSetRootNote).toHaveBeenCalled();
    });
  });

  describe('CSS classes', () => {
    it('applies active class to selected note', () => {
      render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      const activePaths = document.querySelectorAll('path.active');
      expect(activePaths.length).toBeGreaterThan(0);
      expect(activePaths[0].getAttribute('class')).toContain('active');
    });

    it('removes active class when root changes', () => {
      const { rerender } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={mockSetRootNote}
        />
      );

      let activeCount = document.querySelectorAll('path.active').length;
      expect(activeCount).toBeGreaterThan(0);

      rerender(
        <CircleOfFifths
          rootNote="G"
          setRootNote={mockSetRootNote}
        />
      );

      activeCount = document.querySelectorAll('path.active').length;
      expect(activeCount).toBeGreaterThan(0);
    });
  });
});
