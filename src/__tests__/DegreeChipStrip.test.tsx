import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DegreeChipStrip, type DegreeChip } from '../components/DegreeChipStrip';
import { axe } from '../test-utils/a11y';

const aMinorChips: DegreeChip[] = [
  { note: 'A', internalNote: 'A', interval: '1', inScale: true, isTonic: true },
  { note: 'B', internalNote: 'B', interval: '2', inScale: true },
  { note: 'C', internalNote: 'C', interval: 'b3', inScale: true },
  { note: 'D', internalNote: 'D', interval: '4', inScale: true },
  { note: 'E', internalNote: 'E', interval: '5', inScale: true },
  { note: 'F', internalNote: 'F', interval: 'b6', inScale: true },
  { note: 'G', internalNote: 'G', interval: 'b7', inScale: true },
];

describe('DegreeChipStrip', () => {
  it('renders with 7 chips — role=group with aria-label exists', () => {
    render(
      <DegreeChipStrip
        scaleName="A Natural Minor (Aeolian)"
        chips={aMinorChips}
      />
    );
    const group = screen.getByRole('group');
    expect(group).toBeTruthy();
    expect(group.getAttribute('aria-label')).toBe('Scale degrees for A Natural Minor (Aeolian)');
  });

  it('renders role=list with 7 listitems', () => {
    render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
      />
    );
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(7);
  });

  it('tonic chip has data-is-tonic attribute', () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
      />
    );
    const tonicChip = container.querySelector('[data-is-tonic="true"]');
    expect(tonicChip).toBeTruthy();
  });

  it('in-scale chips have data-in-scale attribute', () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
      />
    );
    const inScaleChips = container.querySelectorAll('[data-in-scale="true"]');
    expect(inScaleChips.length).toBe(7);
  });

  it('out-of-scale chips do not have data-in-scale attribute', () => {
    const mixedChips: DegreeChip[] = [
      { note: 'C', internalNote: 'C', interval: '1', inScale: true, isTonic: true },
      { note: 'D', internalNote: 'D', interval: '2', inScale: false },
      { note: 'E', internalNote: 'E', interval: '3', inScale: true },
    ];
    const { container } = render(
      <DegreeChipStrip scaleName="C Major" chips={mixedChips} />
    );
    const inScaleChips = container.querySelectorAll('[data-in-scale="true"]');
    const allChips = container.querySelectorAll('.degree-chip');
    expect(inScaleChips.length).toBe(2);
    expect(allChips.length).toBe(3);
  });

  it('in-chord chips have data-in-chord attribute', () => {
    const chipsWithChord: DegreeChip[] = [
      { note: 'A', internalNote: 'A', interval: '1', inScale: true, isTonic: true, inChord: true },
      { note: 'C', internalNote: 'C', interval: 'b3', inScale: true, inChord: true },
      { note: 'E', internalNote: 'E', interval: '5', inScale: true, inChord: true },
    ];
    const { container } = render(
      <DegreeChipStrip scaleName="Am chord" chips={chipsWithChord} />
    );
    const chordChips = container.querySelectorAll('[data-in-chord="true"]');
    expect(chordChips.length).toBe(3);
  });

  it('uses custom aria-label when provided', () => {
    render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
        aria-label="Custom label"
      />
    );
    expect(screen.getByRole('group', { name: 'Custom label' })).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor (Aeolian) (6th Mode)"
        chips={aMinorChips}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations with mixed chip states', async () => {
    const mixedChips: DegreeChip[] = [
      { note: 'A', internalNote: 'A', interval: '1', inScale: true, isTonic: true, inChord: true },
      { note: 'B', internalNote: 'B', interval: '2', inScale: true },
      { note: 'C', internalNote: 'C', interval: 'b3', inScale: false },
    ];
    const { container } = render(
      <DegreeChipStrip scaleName="Mixed Scale" chips={mixedChips} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
