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
  { value: 'blues', label: 'blues' },
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
      { groupLabel: 'major', options: [{ value: 'a', label: 'Alpha' }] },
      { groupLabel: 'minor', options: [{ value: 'b', label: 'Beta' }] },
    ];
    render(
      <LabeledSelect label="Preset" value="a" groups={groups} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: /Preset/i }));
    expect(screen.getByText('major')).toBeInTheDocument();
    expect(screen.getByText('minor')).toBeInTheDocument();
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

  it('fit prop (deprecated alias) emits data-width="auto" on the root', () => {
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
    expect(root).toHaveAttribute('data-width', 'auto');
    expect(root).not.toHaveAttribute('data-fit');
  });

  it('omits data-width when no width prop (fill default)', () => {
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
    expect(root).not.toHaveAttribute('data-width');
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

  it("when `fit` is set, the trigger has align-self: flex-start so it does not stretch in flex-column parents", () => {
    render(
      <LabeledSelect
        label="Voicing"
        hideLabel
        fit
        value="close"
        options={[
          { value: "off", label: "Off" },
          { value: "full", label: "Full" },
          { value: "close", label: "Close" },
        ]}
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeTruthy();
    expect(getComputedStyle(trigger).alignSelf).toBe('flex-start');
  });
});

describe("LabeledSelect width prop (Plan H-T1)", () => {
  const baseProps = {
    label: "Voicing",
    hideLabel: true,
    value: "close",
    options: [
      { value: "off", label: "Off" },
      { value: "full", label: "Full" },
      { value: "close", label: "Close" },
    ],
    onChange: () => {},
  };

  it("default width='fill' renders no data-width attribute (uses 100% trigger)", () => {
    const { container } = render(<LabeledSelect {...baseProps} />);
    const root = container.querySelector("[class*='labeled-select']");
    expect(root?.getAttribute("data-width")).toBeNull();
  });

  it("width='fixed' with widthValue emits data-width='fixed' and sets CSS var --labeled-select-width", () => {
    const { container } = render(
      <LabeledSelect {...baseProps} width="fixed" widthValue="6rem" />,
    );
    const root = container.querySelector("[data-width='fixed']");
    expect(root).toBeTruthy();
    expect((root as HTMLElement).style.getPropertyValue("--labeled-select-width")).toBe("6rem");
  });

  it("width='auto' emits data-width='auto' for content sizing", () => {
    const { container } = render(<LabeledSelect {...baseProps} width="auto" />);
    expect(container.querySelector("[data-width='auto']")).toBeTruthy();
  });

  it("`fit` prop continues to work as an alias for width='auto'", () => {
    const { container } = render(<LabeledSelect {...baseProps} fit />);
    expect(container.querySelector("[data-width='auto']")).toBeTruthy();
  });
});

describe("LabeledSelect overflow behavior (Plan H-T2)", () => {
  it("trigger has overflow:hidden + white-space:nowrap so long values truncate", () => {
    const { container } = render(
      <LabeledSelect
        label="Scale"
        hideLabel
        width="fixed"
        widthValue="4rem"
        value="acoustic"
        options={[
          { value: "acoustic", label: "Acoustic / Mixolydian b6 (very long)" },
        ]}
        onChange={() => {}}
      />,
    );
    const trigger = container.querySelector("[role='combobox']");
    expect(trigger).toBeTruthy();
    const styles = getComputedStyle(trigger as Element);
    expect(styles.overflow).toBe("hidden");
    expect(styles.whiteSpace).toBe("nowrap");
  });
});
