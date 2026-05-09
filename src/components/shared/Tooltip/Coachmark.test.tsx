// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '../../../test-utils/a11y';
import { renderWithAtoms } from '../../../test-utils/renderWithAtoms';
import { Coachmark } from './Coachmark';

function renderCoachmark({
  dismissed,
  onDismiss = vi.fn<() => void>(),
  content = 'Open settings here',
}: {
  dismissed: boolean;
  onDismiss?: () => void;
  content?: string;
}) {
  return renderWithAtoms(
    <Coachmark
      dismissed={dismissed}
      onDismiss={onDismiss}
      content={content}
    >
      <button type="button">Settings</button>
    </Coachmark>,
  );
}

describe('Coachmark', () => {
  it('does not render coachmark when dismissed=true', () => {
    renderCoachmark({ dismissed: true });
    expect(screen.queryByTestId('settings-coach-mark')).not.toBeInTheDocument();
  });

  it('renders coachmark when dismissed=false', () => {
    renderCoachmark({ dismissed: false });
    expect(screen.getByTestId('settings-coach-mark')).toBeInTheDocument();
  });

  it('content appears in coachmark body', () => {
    renderCoachmark({ dismissed: false, content: 'Open settings here' });
    expect(screen.getByText('Open settings here')).toBeInTheDocument();
  });

  it('dismiss button calls onDismiss', () => {
    const onDismiss = vi.fn();
    renderCoachmark({ dismissed: false, onDismiss });
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss settings tip' });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Escape fires onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderCoachmark({ dismissed: false, onDismiss });
    // Focus the floating element to ensure keydown is captured in the floating context
    const coachmark = screen.getByTestId('settings-coach-mark');
    coachmark.focus();
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not have ARIA violations', async () => {
    const { container } = renderCoachmark({ dismissed: false });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('transitions to hidden when dismissed prop changes', () => {
    const onDismiss = vi.fn();
    const { rerender } = renderCoachmark({ dismissed: false, onDismiss });
    expect(screen.getByTestId('settings-coach-mark')).toBeInTheDocument();
    rerender(
      <Coachmark dismissed={true} onDismiss={onDismiss} content="Open settings here">
        <button type="button">Settings</button>
      </Coachmark>,
    );
    expect(screen.queryByTestId('settings-coach-mark')).not.toBeInTheDocument();
  });
});
