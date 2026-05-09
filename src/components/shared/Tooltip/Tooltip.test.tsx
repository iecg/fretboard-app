// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAtoms } from '../../../test-utils/renderWithAtoms';
import { axe } from '../../../test-utils/a11y';
import { Tooltip } from './Tooltip';

describe('Tooltip/Tooltip', () => {
  it('renders trigger child without tooltip visible by default', () => {
    const { container } = renderWithAtoms(
      <Tooltip content="tip text">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'trigger' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    // a11y check on the baseline (no tooltip open)
    return axe(container).then((results) => {
      expect(results).toHaveNoViolations();
    });
  });

  it('shows tooltip on hover', async () => {
    renderWithAtoms(
      <Tooltip content="tip text">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    await userEvent.hover(screen.getByRole('button', { name: 'trigger' }));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('hides tooltip on pointer leave', async () => {
    renderWithAtoms(
      <Tooltip content="tip text">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'trigger' });
    await userEvent.hover(btn);
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());

    await userEvent.unhover(btn);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip on keyboard focus', async () => {
    renderWithAtoms(
      <Tooltip content="tip text">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    await userEvent.tab();
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('hides tooltip on Escape', async () => {
    renderWithAtoms(
      <Tooltip content="tip text">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    await userEvent.hover(screen.getByRole('button', { name: 'trigger' }));
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('renders content inside tooltip', async () => {
    renderWithAtoms(
      <Tooltip content="helpful description">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    await userEvent.hover(screen.getByRole('button', { name: 'trigger' }));
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    expect(screen.getByRole('tooltip')).toHaveTextContent('helpful description');
  });
});
