// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Fretboard } from '../Fretboard';
import { CircleOfFifths } from '../CircleOfFifths';
import App from '../App';
import { STANDARD_TUNING } from '../guitar';

// Mock components to avoid complex setup
vi.mock('../audio', () => ({
  synth: {
    setMute: vi.fn(),
    init: vi.fn(),
    playNote: vi.fn(),
  },
}));

describe('Component Snapshots', () => {
  describe('Fretboard snapshots', () => {
    it('renders C Major scale snapshot (0-24 frets)', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          rootNote="C"
          displayFormat="notes"
        />
      );
      expect(container).toMatchSnapshot('fretboard-c-major-full');
    });

    it('renders A Minor Pentatonic snapshot', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['A', 'C', 'D', 'E', 'G']}
          rootNote="A"
          displayFormat="notes"
        />
      );
      expect(container).toMatchSnapshot('fretboard-a-minor-pentatonic');
    });

    it('renders with degree display format snapshot', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['G', 'A', 'B', 'C', 'D', 'E', 'F#']}
          rootNote="G"
          displayFormat="degrees"
          scaleName="Major"
        />
      );
      expect(container).toMatchSnapshot('fretboard-degree-display');
    });

    it('renders with no display format snapshot', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#']}
          rootNote="E"
          displayFormat="none"
        />
      );
      expect(container).toMatchSnapshot('fretboard-no-display');
    });

    it('renders with chord tones highlighted snapshot', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          rootNote="C"
          displayFormat="notes"
          chordTones={['C', 'E', 'G']}
          hideNonChordNotes={false}
        />
      );
      expect(container).toMatchSnapshot('fretboard-with-chord-tones');
    });

    it('renders with chord tones filtered snapshot', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          rootNote="C"
          displayFormat="notes"
          chordTones={['C', 'E', 'G']}
          hideNonChordNotes={true}
        />
      );
      expect(container).toMatchSnapshot('fretboard-chord-tones-filtered');
    });

    it('renders with CAGED shapes snapshot', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 3 },
            { string: 2, fret: 2 },
            { string: 3, fret: 0 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          shape: 'E' as const,
          color: '#6366f1',
          truncated: false,
          intendedMin: 0,
          intendedMax: 3,
          cagedLabel: 'E Shape',
          modalLabel: 'Ionian',
        },
      ];

      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#']}
          rootNote="E"
          displayFormat="notes"
          shapePolygons={shapePolygons}
          shapeLabels="caged"
        />
      );
      expect(container).toMatchSnapshot('fretboard-caged-shapes');
    });

    it('renders high fret range snapshot (12-24)', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['D', 'E', 'F#', 'G', 'A', 'B', 'C#']}
          rootNote="D"
          displayFormat="notes"
        />
      );
      expect(container).toMatchSnapshot('fretboard-high-frets');
    });

    it('renders with flats instead of sharps snapshot', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['F', 'G', 'A', 'Bb', 'C', 'D', 'E']}
          rootNote="F"
          displayFormat="notes"
          useFlats={true}
        />
      );
      expect(container).toMatchSnapshot('fretboard-flats-display');
    });

    it('renders Drop D tuning snapshot', () => {
      const dropDTuning = ['E4', 'A3', 'D3', 'G3', 'B3', 'D3'];
      const { container } = render(
        <Fretboard
          tuning={dropDTuning}
          maxFret={24}
          highlightNotes={['D', 'E', 'F#', 'G', 'A', 'B', 'C#']}
          rootNote="D"
          displayFormat="notes"
        />
      );
      expect(container).toMatchSnapshot('fretboard-drop-d-tuning');
    });

    it('renders with small mobile string spacing (stringRowPx=32)', () => {
      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
          rootNote="C"
          displayFormat="notes"
          stringRowPx={32}
        />
      );
      expect(container).toMatchSnapshot('fretboard-small-mobile-32px');
    });

    it('renders with CAGED shapes at small mobile spacing (stringRowPx=32)', () => {
      const shapePolygons = [
        {
          vertices: [
            { string: 0, fret: 0 },
            { string: 1, fret: 3 },
            { string: 2, fret: 2 },
            { string: 3, fret: 0 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
          ],
          shape: 'E' as const,
          color: '#6366f1',
          truncated: false,
          intendedMin: 0,
          intendedMax: 3,
          cagedLabel: 'E Shape',
          modalLabel: 'Ionian',
        },
      ];

      const { container } = render(
        <Fretboard
          tuning={STANDARD_TUNING}
          maxFret={24}
          highlightNotes={['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#']}
          rootNote="E"
          displayFormat="notes"
          shapePolygons={shapePolygons}
          shapeLabels="caged"
          stringRowPx={32}
        />
      );
      expect(container).toMatchSnapshot('fretboard-caged-small-mobile-32px');
    });
  });

  describe('CircleOfFifths snapshots', () => {
    it('renders C Major snapshot', () => {
      const { container } = render(
        <CircleOfFifths
          rootNote="C"
          setRootNote={() => {}}
          scaleName="Major"
          useFlats={false}
        />
      );
      expect(container).toMatchSnapshot('circle-c-major');
    });

    it('renders G Major snapshot', () => {
      const { container } = render(
        <CircleOfFifths
          rootNote="G"
          setRootNote={() => {}}
          scaleName="Major"
          useFlats={false}
        />
      );
      expect(container).toMatchSnapshot('circle-g-major');
    });

    it('renders A Natural Minor snapshot', () => {
      const { container } = render(
        <CircleOfFifths
          rootNote="A"
          setRootNote={() => {}}
          scaleName="Natural Minor"
          useFlats={false}
        />
      );
      expect(container).toMatchSnapshot('circle-a-natural-minor');
    });

    it('renders with flats snapshot', () => {
      const { container } = render(
        <CircleOfFifths
          rootNote="F"
          setRootNote={() => {}}
          scaleName="Major"
          useFlats={true}
        />
      );
      expect(container).toMatchSnapshot('circle-flats');
    });

    it('renders Dorian mode snapshot', () => {
      const { container } = render(
        <CircleOfFifths
          rootNote="D"
          setRootNote={() => {}}
          scaleName="Dorian"
          useFlats={false}
        />
      );
      expect(container).toMatchSnapshot('circle-dorian');
    });

    it('renders Lydian mode snapshot', () => {
      const { container } = render(
        <CircleOfFifths
          rootNote="F"
          setRootNote={() => {}}
          scaleName="Lydian"
          useFlats={false}
        />
      );
      expect(container).toMatchSnapshot('circle-lydian');
    });

    it('renders all chromatic notes snapshot (including sharps)', () => {
      const notes = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

      notes.forEach((note) => {
        const { container } = render(
          <CircleOfFifths
            rootNote={note}
            setRootNote={() => {}}
            scaleName="Major"
            useFlats={false}
          />
        );
        expect(container).toMatchSnapshot(`circle-${note}-major`);
      });
    });
  });

  describe('App layout snapshots', () => {
    it('renders desktop-expanded layout snapshot (1920×1200)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-desktop-expanded-default');
    });

    it('renders mobile layout snapshot', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-mobile-default');
    });

    it('renders with custom configuration snapshot', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      localStorage.setItem('rootNote', 'G');
      localStorage.setItem('scaleName', 'Natural Minor');
      localStorage.setItem('chordType', 'Minor 7th');
      localStorage.setItem('displayFormat', 'degrees');
      localStorage.setItem('useFlats', 'true');

      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-custom-config');
    });

    it('renders with chord overlay snapshot', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      localStorage.clear();
      localStorage.setItem('chordType', 'Major 7th');
      localStorage.setItem('hideNonChordNotes', 'true');

      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-with-chord-overlay');
    });

    it('falls back to tablet-portrait at short desktop heights (1920×600)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-wide-short-tablet-portrait-fallback');
    });

    it('renders iPhone SE portrait layout (375×667)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-iphone-se-portrait');
    });

    it('renders iPad portrait layout (768×1024)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-ipad-portrait');
    });

    it('renders iPad Pro portrait layout (1024×1366)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1366,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-ipad-pro-portrait');
    });

    it('renders iPhone 12 Pro portrait layout (390×844)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 844,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-iphone-12-pro-portrait');
    });

    it('renders iPad landscape layout (1024×768) as tablet-portrait fallback', () => {
      // Post-Phase-06: 1024×768 doesn't have enough height for
      // desktop-expanded (available 288 < required 576), so it falls
      // back to the tablet-portrait tabbed layout.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 768,
      });

      localStorage.clear();
      const { container } = render(<App />);
      expect(container).toMatchSnapshot('app-ipad-landscape');
    });
  });
});

describe('Fretboard with ResizeObserver (auto-fit zoom)', () => {
  const originalRO = globalThis.ResizeObserver;

  afterEach(() => {
    globalThis.ResizeObserver = originalRO;
  });

  it('uses containerWidth/totalColumns when ResizeObserver fires', () => {
    let roCallback: ResizeObserverCallback | null = null;
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) { roCallback = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });

    const { container } = render(
      <Fretboard
        tuning={STANDARD_TUNING}
        maxFret={24}
        highlightNotes={['C', 'D', 'E', 'F', 'G', 'A', 'B']}
        rootNote="C"
        displayFormat="notes"
      />
    );

    // Simulate ResizeObserver firing with a 1200px container
    expect(roCallback).not.toBeNull();
    act(() => {
      roCallback!(
        [{ contentRect: { width: 1200, height: 300 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(container).toMatchSnapshot('fretboard-autofit-zoom-1200px');
  });
});
