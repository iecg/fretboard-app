import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabeledSelect, type LabeledSelectOption } from '../components/LabeledSelect';
import { axe } from '../test-utils/a11y';

const scaleOptions: LabeledSelectOption[] = [
  { value: 'major-modes', label: 'Major Modes' },
  { value: 'minor-modes', label: 'Minor Modes' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'blues', label: 'Blues' },
];

describe('LabeledSelect', () => {
  it('renders with label text and select has matching id', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    const labelEl = screen.getByText('Scale Family');
    expect(labelEl.tagName).toBe('LABEL');
    const selectEl = screen.getByRole('combobox');
    expect(labelEl.getAttribute('for')).toBe(selectEl.id);
  });

  it('renders all options', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('option', { name: 'Major Modes' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Minor Modes' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Pentatonic' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Blues' })).toBeTruthy();
  });

  it('changing selection fires onChange with new value', async () => {
    const onChange = vi.fn();
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={onChange}
      />
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'pentatonic');
    expect(onChange).toHaveBeenCalledWith('pentatonic');
  });

  it('disabled prop disables the select', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
        disabled
      />
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('aria-describedby pass-through works', () => {
    render(
      <>
        <LabeledSelect
          label="Scale Family"
          value="major-modes"
          options={scaleOptions}
          onChange={vi.fn()}
          aria-describedby="help-text"
        />
        <span id="help-text">Choose a scale family</span>
      </>
    );
    const select = screen.getByRole('combobox');
    expect(select.getAttribute('aria-describedby')).toBe('help-text');
  });

  it('uses custom id when provided', () => {
    render(
      <LabeledSelect
        label="Scale Family"
        id="my-select"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('combobox').id).toBe('my-select');
    expect(screen.getByText('Scale Family').getAttribute('for')).toBe('my-select');
  });

  it('has no accessibility violations (default render)', async () => {
    const { container } = render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations (disabled state)', async () => {
    const { container } = render(
      <LabeledSelect
        label="Scale Family"
        value="major-modes"
        options={scaleOptions}
        onChange={vi.fn()}
        disabled
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
