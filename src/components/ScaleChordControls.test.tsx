// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScaleChordControls } from './ScaleChordControls';

const SCALE_OPTIONS = ['Major', 'Minor', 'Pentatonic'];
const CHORD_OPTIONS = ['Major Triad', 'Minor Triad'];
const CHORD_FILTER_OPTIONS = ['All', 'Triad', '7th Chord'];

const defaultProps = {
  scaleName: 'Major',
  setScaleName: vi.fn(),
  chordType: null,
  setChordType: vi.fn(),
  chordRoot: 'C',
  setChordRoot: vi.fn(),
  linkChordRoot: false,
  setLinkChordRoot: vi.fn(),
  hideNonChordNotes: false,
  setHideNonChordNotes: vi.fn(),
  chordIntervalFilter: 'All',
  setChordIntervalFilter: vi.fn(),
  rootNote: 'C',
  useFlats: false,
  scaleOptions: SCALE_OPTIONS,
  chordOptions: CHORD_OPTIONS,
  chordFilterOptions: CHORD_FILTER_OPTIONS,
};

describe('ScaleChordControls', () => {
  it('renders Scale and Chord Overlay drawers', () => {
    render(<ScaleChordControls {...defaultProps} />);
    expect(screen.getByText('Scale')).toBeTruthy();
    expect(screen.getByText('Chord Overlay')).toBeTruthy();
  });

  it('shows chord-specific controls only when chordType is set', () => {
    const { rerender } = render(<ScaleChordControls {...defaultProps} chordType={null} />);
    expect(screen.queryByText('Link chord root to scale')).toBeNull();

    rerender(<ScaleChordControls {...defaultProps} chordType="Major Triad" />);
    expect(screen.getByText('Link chord root to scale')).toBeTruthy();
  });

  it('renders NoteGrid when linkChordRoot is false', () => {
    const { container } = render(
      <ScaleChordControls {...defaultProps} chordType="Major Triad" linkChordRoot={false} />,
    );
    expect(container.querySelector('.note-grid')).toBeTruthy();
  });

  it('hides NoteGrid when linkChordRoot is true', () => {
    const { container } = render(
      <ScaleChordControls {...defaultProps} chordType="Major Triad" linkChordRoot={true} />,
    );
    expect(container.querySelector('.note-grid')).toBeNull();
  });

  it('links chord root to scale root on chordType selection if linkChordRoot enabled', () => {
    const setChordRoot = vi.fn();
    const setChordType = vi.fn();
    render(
      <ScaleChordControls
        {...defaultProps}
        linkChordRoot={true}
        rootNote="D"
        setChordRoot={setChordRoot}
        setChordType={setChordType}
      />,
    );
    // Open the Chord Overlay drawer and select an option
    fireEvent.click(screen.getByRole('button', { name: /Chord Overlay/i }));
    fireEvent.click(screen.getByText('Major Triad'));
    expect(setChordType).toHaveBeenCalledWith('Major Triad');
    expect(setChordRoot).toHaveBeenCalledWith('D');
  });

  it('renders Interval Filter drawer when chordType is set', () => {
    render(<ScaleChordControls {...defaultProps} chordType="Major Triad" />);
    expect(screen.getByText('Interval Filter')).toBeTruthy();
  });
});
