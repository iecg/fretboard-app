import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../components/AppHeader';
import { axe } from '../test-utils/a11y';

describe('AppHeader', () => {
  it('renders with brandTitle — header with role=banner exists', () => {
    const { container } = render(<AppHeader brandTitle="FretFlow" />);
    const header = screen.getByRole('banner');
    expect(header).toBeTruthy();
    // Title renders split across two spans ("Fret" cyan + "Flow" orange),
    // so we check the combined textContent of the wrapper element.
    const title = container.querySelector('.app-header-brand-title');
    expect(title?.textContent).toBe('FretFlow');
  });

  it('renders brandSubtitle when provided', () => {
    render(<AppHeader brandTitle="FretFlow" brandSubtitle="Interactive Fretboard" />);
    expect(screen.getByText('Interactive Fretboard')).toBeTruthy();
  });

  it('renders actions slot', () => {
    render(
      <AppHeader
        brandTitle="FretFlow"
        actions={
          <>
            <button aria-label="Help">?</button>
            <button aria-label="Settings">⚙</button>
          </>
        }
      />
    );
    expect(screen.getByRole('button', { name: 'Help' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('renders brandIcon slot', () => {
    render(
      <AppHeader
        brandTitle="FretFlow"
        brandIcon={<span data-testid="guitar-icon">🎸</span>}
      />
    );
    expect(screen.getByTestId('guitar-icon')).toBeTruthy();
  });

  it('action buttons are keyboard-focusable', () => {
    render(
      <AppHeader
        brandTitle="FretFlow"
        actions={<button aria-label="Settings">⚙</button>}
      />
    );
    const btn = screen.getByRole('button', { name: 'Settings' });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('has no accessibility violations (default render)', async () => {
    const { container } = render(<AppHeader brandTitle="FretFlow" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations (with actions)', async () => {
    const { container } = render(
      <AppHeader
        brandTitle="FretFlow"
        brandSubtitle="Interactive Fretboard & Music Theory"
        actions={
          <>
            <button aria-label="Help">?</button>
            <button aria-label="Settings">⚙</button>
          </>
        }
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
