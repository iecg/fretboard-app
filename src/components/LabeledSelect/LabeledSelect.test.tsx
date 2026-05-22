import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LabeledSelect,
  type LabeledSelectGroup,
  type LabeledSelectOption,
} from './LabeledSelect';
import { axe } from '../../test-utils/a11y';

const scaleOptions: LabeledSelectOption[] = [
  { value: 'major-modes', label: 'Major Modes' },
  { value: 'minor-modes', label: 'Minor Modes' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'blues', label: 'Blues' },
];

describe('LabeledSelect/LabeledSelect', () => {
  it('renders with label text', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Scale Family').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a combobox labelled by the field, showing the current value', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: /Scale Family/i });
    expect(trigger).toBeTruthy();
    expect(within(trigger).getByText('Major Modes')).toBeInTheDocument();
  });

  it('renders all options once the listbox is open', async () => {
    const user = userEvent.setup();
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /Scale Family/i }));
    for (const opt of scaleOptions) {
      expect(screen.getByRole('option', { name: opt.label })).toBeInTheDocument();
    }
  });

  it('selecting an option fires onChange with the value key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /Scale Family/i }));
    await user.click(screen.getByRole('option', { name: 'Pentatonic' }));
    expect(onChange).toHaveBeenCalledWith('pentatonic');
  });

  it('renders grouped options with group headings', async () => {
    const user = userEvent.setup();
    const groups: LabeledSelectGroup[] = [
      { groupLabel: 'Major', options: [{ value: 'a', label: 'Alpha' }] },
      { groupLabel: 'Minor', options: [{ value: 'b', label: 'Beta' }] },
    ];
    render(
      <LabeledSelect label="Preset" value="a" groups={groups} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: /Preset/i }));
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('has no accessibility violations (default render)', async () => {
    const { container } = render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('emits data-fit on the root when fit prop is true', () => {
    const { container } = render(
      <LabeledSelect
        label="Test"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
        fit
      />,
    );
    const root = container.querySelector('.labeled-select');
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('data-fit');
  });

  it('omits data-fit when fit is false', () => {
    const { container } = render(
      <LabeledSelect
        label="Test"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />,
    );
    const root = container.querySelector('.labeled-select');
    expect(root).not.toBeNull();
    expect(root).not.toHaveAttribute('data-fit');
  });

  it('has no accessibility violations (disabled state)', async () => {
    const { container } = render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
