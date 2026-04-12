// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabletPortraitPanel } from './TabletPortraitPanel';

vi.mock('../CircleOfFifths', () => ({
  CircleOfFifths: ({ rootNote }: { rootNote: string }) => (
    <div data-testid="circle-of-fifths" data-root-note={rootNote} />
  ),
}));

const defaultProps = {
  tabletTab: 'settings' as const,
  setTabletTab: vi.fn(),
  settingsTabContent: <div>Settings Content</div>,
  scaleChordTabContent: <div>Scales Content</div>,
  rootNote: 'C',
  setRootNote: vi.fn(),
  scaleName: 'major',
  useFlats: false,
};

describe('TabletPortraitPanel', () => {
  it('renders both columns', () => {
    const { container } = render(<TabletPortraitPanel {...defaultProps} />);
    expect(container.querySelector('.tablet-portrait-settings-col')).toBeTruthy();
    expect(container.querySelector('.tablet-portrait-cof-col')).toBeTruthy();
  });

  it('shows settingsTabContent when tabletTab is settings', () => {
    render(<TabletPortraitPanel {...defaultProps} tabletTab="settings" />);
    expect(screen.getByText('Settings Content')).toBeTruthy();
    expect(screen.queryByText('Scales Content')).toBeNull();
  });

  it('shows scaleChordTabContent when tabletTab is scales', () => {
    render(<TabletPortraitPanel {...defaultProps} tabletTab="scales" />);
    expect(screen.getByText('Scales Content')).toBeTruthy();
    expect(screen.queryByText('Settings Content')).toBeNull();
  });

  it('tab switching calls setTabletTab', () => {
    const setTabletTab = vi.fn();
    render(<TabletPortraitPanel {...defaultProps} setTabletTab={setTabletTab} />);
    fireEvent.click(screen.getByText('Scales'));
    expect(setTabletTab).toHaveBeenCalledWith('scales');
  });

  it('tab switching — clicking Settings calls setTabletTab with settings', () => {
    const setTabletTab = vi.fn();
    render(
      <TabletPortraitPanel {...defaultProps} tabletTab="scales" setTabletTab={setTabletTab} />
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(setTabletTab).toHaveBeenCalledWith('settings');
  });

  it('CoF receives rootNote prop', () => {
    render(<TabletPortraitPanel {...defaultProps} rootNote="G" />);
    const cof = screen.getByTestId('circle-of-fifths');
    expect(cof.getAttribute('data-root-note')).toBe('G');
  });

  // Accidental toggle was removed from TabletPortraitPanel in plan 01-03;
  // the Accidentals control now lives in SettingsOverlay.
});
