// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTabPanel } from './MobileTabPanel';

const defaultProps = {
  mobileTab: 'key' as const,
  setMobileTab: vi.fn(),
  keyTabContent: <div>Key Content</div>,
  scaleChordTabContent: <div>Scale Content</div>,
  settingsTabContent: <div>Settings Content</div>,
};

describe('MobileTabPanel', () => {
  it('renders ToggleBar with 3 tabs', () => {
    render(<MobileTabPanel {...defaultProps} />);
    expect(screen.getByText('Key')).toBeTruthy();
    expect(screen.getByText('Scale')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows keyTabContent when mobileTab is key', () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="key" />);
    expect(screen.getByText('Key Content')).toBeTruthy();
    expect(screen.queryByText('Scale Content')).toBeNull();
    expect(screen.queryByText('Settings Content')).toBeNull();
  });

  it('shows scaleChordTabContent when mobileTab is scale', () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="scale" />);
    expect(screen.getByText('Scale Content')).toBeTruthy();
    expect(screen.queryByText('Key Content')).toBeNull();
    expect(screen.queryByText('Settings Content')).toBeNull();
  });

  it('shows settingsTabContent when mobileTab is settings', () => {
    render(<MobileTabPanel {...defaultProps} mobileTab="settings" />);
    expect(screen.getByText('Settings Content')).toBeTruthy();
    expect(screen.queryByText('Key Content')).toBeNull();
    expect(screen.queryByText('Scale Content')).toBeNull();
  });

  it('tab switching — clicking Scale calls setMobileTab with scale', () => {
    const setMobileTab = vi.fn();
    render(<MobileTabPanel {...defaultProps} setMobileTab={setMobileTab} />);
    fireEvent.click(screen.getByText('Scale'));
    expect(setMobileTab).toHaveBeenCalledWith('scale');
  });

  it('tab switching — clicking key calls setMobileTab with key', () => {
    const setMobileTab = vi.fn();
    render(
      <MobileTabPanel {...defaultProps} mobileTab="settings" setMobileTab={setMobileTab} />
    );
    fireEvent.click(screen.getByText('Key'));
    expect(setMobileTab).toHaveBeenCalledWith('key');
  });

  it('tab switching — clicking settings calls setMobileTab with settings', () => {
    const setMobileTab = vi.fn();
    render(
      <MobileTabPanel {...defaultProps} mobileTab="key" setMobileTab={setMobileTab} />
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(setMobileTab).toHaveBeenCalledWith('settings');
  });
});
