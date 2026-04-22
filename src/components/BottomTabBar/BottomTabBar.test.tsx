import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomTabBar, type BottomTabItem } from './BottomTabBar';
import { axe } from '../../test-utils/a11y';

const mockItems: BottomTabItem[] = [
  { id: 'fretboard', label: 'Fretboard/Fretboard', icon: <span>🎸</span> },
  { id: 'chords', label: 'Chords', icon: <span>♫</span> },
  { id: 'library', label: 'Library', icon: <span>📁</span> },
  { id: 'profile', label: 'Profile', icon: <span>👤</span> },
];

describe('BottomTabBar/BottomTabBar', () => {
  it('renders with 4 items — nav, role=tablist, 4 role=tab buttons', () => {
    render(<BottomTabBar items={mockItems} activeId="fretboard" onSelect={vi.fn()} />);
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
  });

  it('clicking a tab calls onSelect with item.id', async () => {
    const onSelect = vi.fn();
    render(<BottomTabBar items={mockItems} activeId="fretboard" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Chords' }));
    expect(onSelect).toHaveBeenCalledWith('chords');
  });

  it('aria-selected reflects activeId', () => {
    render(<BottomTabBar items={mockItems} activeId="library" onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    const libraryTab = tabs.find(t => t.getAttribute('aria-label') === 'Library');
    expect(libraryTab?.getAttribute('aria-selected')).toBe('true');
    tabs
      .filter(t => t.getAttribute('aria-label') !== 'Library')
      .forEach(t => expect(t.getAttribute('aria-selected')).toBe('false'));
  });

  it('right arrow navigation moves focus to next tab and calls onSelect', async () => {
    const onSelect = vi.fn();
    render(<BottomTabBar items={mockItems} activeId="fretboard" onSelect={onSelect} />);
    const firstTab = screen.getByRole('tab', { name: 'Fretboard/Fretboard' });
    firstTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenCalledWith('chords');
  });

  it('left arrow navigation wraps around from first to last', async () => {
    const onSelect = vi.fn();
    render(<BottomTabBar items={mockItems} activeId="fretboard" onSelect={onSelect} />);
    const firstTab = screen.getByRole('tab', { name: 'Fretboard/Fretboard' });
    firstTab.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  it('Home key navigates to first tab', async () => {
    const onSelect = vi.fn();
    render(<BottomTabBar items={mockItems} activeId="library" onSelect={onSelect} />);
    const libraryTab = screen.getByRole('tab', { name: 'Library' });
    libraryTab.focus();
    await userEvent.keyboard('{Home}');
    expect(onSelect).toHaveBeenCalledWith('fretboard');
  });

  it('End key navigates to last tab', async () => {
    const onSelect = vi.fn();
    render(<BottomTabBar items={mockItems} activeId="fretboard" onSelect={onSelect} />);
    const firstTab = screen.getByRole('tab', { name: 'Fretboard/Fretboard' });
    firstTab.focus();
    await userEvent.keyboard('{End}');
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  it('disabled item does not call onSelect when clicked', async () => {
    const onSelect = vi.fn();
    const itemsWithDisabled: BottomTabItem[] = [
      { id: 'fretboard', label: 'Fretboard/Fretboard', icon: <span>🎸</span> },
      { id: 'chords', label: 'Chords', icon: <span>♫</span>, disabled: true },
    ];
    render(<BottomTabBar items={itemsWithDisabled} activeId="fretboard" onSelect={onSelect} />);
    const disabledTab = screen.getByRole('tab', { name: 'Chords' });
    expect(disabledTab).toBeDisabled();
    await userEvent.click(disabledTab);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('uses custom aria-label when provided', () => {
    render(
      <BottomTabBar
        items={mockItems}
        activeId="fretboard"
        onSelect={vi.fn()}
        aria-label="App navigation"
      />
    );
    expect(screen.getByRole('navigation', { name: 'App navigation' })).toBeTruthy();
  });

  it('has no accessibility violations (default render)', async () => {
    const { container } = render(
      <BottomTabBar items={mockItems} activeId="fretboard" onSelect={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations (with badge)', async () => {
    const itemsWithBadge: BottomTabItem[] = [
      { id: 'fretboard', label: 'Fretboard/Fretboard', icon: <span>🎸</span> },
      { id: 'chords', label: 'Chords', icon: <span>♫</span>, badge: 3 },
    ];
    const { container } = render(
      <BottomTabBar items={itemsWithBadge} activeId="fretboard" onSelect={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
