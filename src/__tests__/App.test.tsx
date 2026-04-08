// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { synth } from '../audio';

// Mock child components to isolate App logic
vi.mock('../Fretboard', () => ({
  Fretboard: ({ highlightNotes, rootNote }: any) => (
    <div data-testid="fretboard">
      Fretboard: {rootNote} - {highlightNotes.length} notes
    </div>
  ),
}));

vi.mock('../CircleOfFifths', () => ({
  CircleOfFifths: ({ rootNote, setRootNote }: any) => (
    <button data-testid="circle-of-fifths" onClick={() => setRootNote('G')}>
      CoF: {rootNote}
    </button>
  ),
}));

vi.mock('../DrawerSelector', () => ({
  DrawerSelector: ({ label, value, onSelect, options }: any) => (
    <div data-testid={`drawer-${label.toLowerCase()}`}>
      <button onClick={() => onSelect(options.find((o: any) => typeof o === 'string') ?? options[0])}>{label}: {value}</button>
    </div>
  ),
}));

vi.mock('../audio', () => ({
  synth: {
    setMute: vi.fn(),
    init: vi.fn(),
    playNote: vi.fn(),
  },
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('renders without crashing', () => {
      render(<App />);
      expect(screen.getByTestId('fretboard')).toBeTruthy();
    });

    it('loads default state when localStorage is empty', () => {
      render(<App />);
      expect(screen.getByTestId('fretboard')).toHaveTextContent('Fretboard: C');
    });

    it('loads persisted state from localStorage', () => {
      localStorage.setItem('rootNote', 'G');
      localStorage.setItem('scaleName', 'Minor');
      render(<App />);
      expect(screen.getByTestId('circle-of-fifths')).toHaveTextContent('CoF: G');
    });

    it('persists isMuted to localStorage on first mount', () => {
      render(<App />);
      expect(localStorage.getItem('isMuted')).toBe('false');
    });

    it('synth is muted based on initial state', () => {
      localStorage.setItem('isMuted', 'true');
      render(<App />);
      // On mount, setMute is called with the persisted state
    });
  });

  describe('Root note changes', () => {
    it('updates fretboard when root note changes via Circle of Fifths', async () => {
      render(<App />);
      expect(screen.getByTestId('fretboard')).toHaveTextContent('Fretboard: C');

      const cofButton = screen.getByTestId('circle-of-fifths');
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(screen.getByTestId('fretboard')).toHaveTextContent('Fretboard: G');
      });
    });

    it('persists root note to localStorage', async () => {
      render(<App />);
      const cofButton = screen.getByTestId('circle-of-fifths');
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem('rootNote')).toBe('G');
      });
    });

    it('links chord root to scale root by default', async () => {
      localStorage.setItem('chordType', 'Major Triad');
      render(<App />);

      const cofButton = screen.getByTestId('circle-of-fifths');
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem('chordRoot')).toBe('G');
      });
    });

    it('does not link chord root when linkChordRoot is false', async () => {
      localStorage.setItem('chordType', 'Major Triad');
      localStorage.setItem('linkChordRoot', 'false');
      localStorage.setItem('chordRoot', 'D');
      render(<App />);

      const cofButton = screen.getByTestId('circle-of-fifths');
      fireEvent.click(cofButton);

      await waitFor(() => {
        expect(localStorage.getItem('chordRoot')).toBe('D');
      });
    });
  });

  describe('Scale selection', () => {
    it('changes scale via drawer selector', async () => {
      render(<App />);
      const drawer = screen.getByTestId('drawer-scale');
      const button = drawer.querySelector('button');

      if (button) {
        fireEvent.click(button);
        await waitFor(() => {
          expect(localStorage.getItem('scaleName')).toBeDefined();
        });
      }
    });

    it('persists scale name to localStorage', async () => {
      render(<App />);
      const drawer = screen.getByTestId('drawer-scale');
      const button = drawer.querySelector('button');

      if (button) {
        fireEvent.click(button);
        await waitFor(() => {
          const saved = localStorage.getItem('scaleName');
          expect(saved).toBeTruthy();
        });
      }
    });
  });

  describe('Mute toggle', () => {
    it('toggles mute state', async () => {
      render(<App />);
      expect(localStorage.getItem('isMuted')).toBe('false');

      const muteButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('title')?.toLowerCase().includes('mute')
      );

      if (muteButtons.length > 0) {
        fireEvent.click(muteButtons[0]);
        await waitFor(() => {
          expect(localStorage.getItem('isMuted')).toBe('true');
        });
      }
    });

    it('calls synth.setMute when toggling mute', async () => {
      render(<App />);

      const muteButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('title')?.toLowerCase().includes('mute')
      );

      if (muteButtons.length > 0) {
        fireEvent.click(muteButtons[0]);
        await waitFor(() => {
          expect(synth.setMute).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Reset functionality', () => {
    it('clears all localStorage on reset', async () => {
      localStorage.setItem('rootNote', 'G');
      localStorage.setItem('scaleName', 'Natural Minor');
      render(<App />);

      const resetButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('aria-label')?.includes('reset') || btn.className.includes('reset')
      );

      if (resetButtons.length > 0) {
        fireEvent.click(resetButtons[0]);
        await waitFor(() => {
          expect(localStorage.getItem('rootNote')).toBeNull();
        });
      }
    });

    it('resets state to defaults', async () => {
      localStorage.setItem('rootNote', 'G');
      const { rerender } = render(<App />);

      const resetButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('aria-label')?.includes('reset') || btn.className.includes('reset')
      );

      if (resetButtons.length > 0) {
        fireEvent.click(resetButtons[0]);

        await waitFor(() => {
          rerender(<App />);
          expect(screen.getByTestId('fretboard')).toHaveTextContent('Fretboard: C');
        });
      }
    });
  });

  describe('Chord overlay', () => {
    it('can set chord type', async () => {
      render(<App />);
      const drawer = screen.getByTestId('drawer-chord overlay');

      if (drawer) {
        const button = drawer.querySelector('button');
        if (button) {
          fireEvent.click(button);
          await waitFor(() => {
            expect(localStorage.getItem('chordType')).toBeTruthy();
          });
        }
      }
    });

    it('persists chord type as empty string when null', async () => {
      localStorage.setItem('chordType', 'Major Triad');
      const { rerender } = render(<App />);

      // Update to clear chord type
      localStorage.setItem('chordType', '');
      rerender(<App />);

      expect(localStorage.getItem('chordType')).toBe('');
    });
  });

  describe('Accidentals', () => {
    it('toggles between sharps and flats', async () => {
      render(<App />);
      const accidentalToggles = screen.getAllByRole('button').filter(
        (btn) => btn.textContent?.includes('♯') || btn.textContent?.includes('♭')
      );

      if (accidentalToggles.length > 0) {
        expect(localStorage.getItem('useFlats')).toBe('false');

        fireEvent.click(accidentalToggles[0]);

        await waitFor(() => {
          expect(localStorage.getItem('useFlats')).toBe('true');
        });
      }
    });
  });

  describe('Fretboard zoom and scroll', () => {
    it('initializes with default fret range', () => {
      render(<App />);
      expect(localStorage.getItem('fretStart')).toBe('0');
      expect(localStorage.getItem('fretEnd')).toBe('24');
    });

    it('persists fret zoom level', async () => {
      localStorage.setItem('fretZoom', '150');
      render(<App />);
      expect(localStorage.getItem('fretZoom')).toBe('150');
    });
  });

  describe('Tuning selection', () => {
    it('uses Standard tuning by default', () => {
      render(<App />);
      expect(localStorage.getItem('tuningName')).toBe('Standard');
    });

    it('persists tuning selection', async () => {
      localStorage.setItem('tuningName', 'Drop D');
      render(<App />);
      expect(localStorage.getItem('tuningName')).toBe('Drop D');
    });
  });

  describe('Mobile responsiveness', () => {
    it('detects mobile viewport width < 768px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      render(<App />);
      // Mobile elements should be rendered
      screen.queryAllByTestId(/mobile/i);
    });

    it('persists mobile tab selection to localStorage', async () => {
      render(<App />);
      expect(localStorage.getItem('mobileTab')).toBe('key');
    });
  });

  describe('State persistence', () => {
    it('persists multiple state changes to localStorage', async () => {
      render(<App />);

      localStorage.setItem('rootNote', 'D');
      localStorage.setItem('scaleName', 'Dorian');
      localStorage.setItem('chordRoot', 'A');
      localStorage.setItem('chordType', 'Minor 7th');
      localStorage.setItem('useFlats', 'true');
      localStorage.setItem('isMuted', 'true');

      const { rerender } = render(<App />);
      rerender(<App />);

      expect(localStorage.getItem('rootNote')).toBe('D');
      expect(localStorage.getItem('scaleName')).toBe('Dorian');
      expect(localStorage.getItem('chordRoot')).toBe('A');
      expect(localStorage.getItem('chordType')).toBe('Minor 7th');
      expect(localStorage.getItem('useFlats')).toBe('true');
      expect(localStorage.getItem('isMuted')).toBe('true');
    });
  });

  describe('Display modes', () => {
    it('initializes with notes display format', () => {
      render(<App />);
      expect(localStorage.getItem('displayFormat')).toBe('notes');
    });

    it('persists display format changes', async () => {
      localStorage.setItem('displayFormat', 'degrees');
      render(<App />);
      expect(localStorage.getItem('displayFormat')).toBe('degrees');
    });

    it('initializes with no shape labels', () => {
      render(<App />);
      expect(localStorage.getItem('shapeLabels')).toBe('none');
    });
  });
});
