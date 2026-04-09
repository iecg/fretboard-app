// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { DesktopControlsPanel } from './DesktopControlsPanel';

vi.mock('./FingeringPatternControls', () => ({
  FingeringPatternControls: () => <div data-testid="fingering-pattern-controls" />,
}));

vi.mock('./ScaleChordControls', () => ({
  ScaleChordControls: () => <div data-testid="scale-chord-controls" />,
}));

vi.mock('../CircleOfFifths', () => ({
  CircleOfFifths: () => <div data-testid="circle-of-fifths" />,
}));

function renderWithStore(props: { isTabletPortrait: boolean; isMobile: boolean }) {
  const store = createStore();
  return render(
    <Provider store={store}>
      <DesktopControlsPanel {...props} />
    </Provider>,
  );
}

describe('DesktopControlsPanel', () => {
  it('renders all three columns when isTabletPortrait=false and isMobile=false', () => {
    renderWithStore({ isTabletPortrait: false, isMobile: false });
    expect(screen.getByTestId('fingering-pattern-controls')).toBeTruthy();
    expect(screen.getByText('Key')).toBeTruthy();
    expect(screen.getByTestId('circle-of-fifths')).toBeTruthy();
    expect(screen.getByText('Scale & Chord')).toBeTruthy();
    expect(screen.getByTestId('scale-chord-controls')).toBeTruthy();
  });

  it('hides Key column when isTabletPortrait=true', () => {
    renderWithStore({ isTabletPortrait: true, isMobile: false });
    expect(screen.queryByText('Key')).toBeNull();
    expect(screen.queryByTestId('circle-of-fifths')).toBeNull();
  });

  it('hides accidental toggle when isMobile=true', () => {
    renderWithStore({ isTabletPortrait: false, isMobile: true });
    expect(screen.queryByTitle(/Showing/)).toBeNull();
  });

  it('renders accidental toggle when isTabletPortrait=false and isMobile=false', () => {
    renderWithStore({ isTabletPortrait: false, isMobile: false });
    const toggle = screen.getByTitle(/Showing sharps/);
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toBe('♯');
  });
});
