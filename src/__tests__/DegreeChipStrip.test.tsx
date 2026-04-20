import { describe, it, expect, vi } from 'vitest';
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

  it('scale strip does not render data-in-chord or data-is-chord-root attributes', () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
      />
    );
    expect(container.querySelector('[data-in-chord]')).toBeNull();
    expect(container.querySelector('[data-is-chord-root]')).toBeNull();
  });

  it('scale strip does not render data-chord-active attribute even when chord is active externally', () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
      />
    );
    const section = container.querySelector('.degree-chip-strip');
    expect(section?.getAttribute('data-chord-active')).toBeNull();
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
      { note: 'A', internalNote: 'A', interval: '1', inScale: true, isTonic: true },
      { note: 'B', internalNote: 'B', interval: '2', inScale: true },
      { note: 'C', internalNote: 'C', interval: 'b3', inScale: false },
    ];
    const { container } = render(
      <DegreeChipStrip scaleName="Mixed Scale" chips={mixedChips} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hideHeader suppresses the header element', () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
        hideHeader
      />
    );
    expect(container.querySelector('.degree-chip-strip-header')).toBeNull();
  });

  it('without hideHeader the header element renders', () => {
    const { container } = render(
      <DegreeChipStrip
        scaleName="A Natural Minor"
        chips={aMinorChips}
      />
    );
    expect(container.querySelector('.degree-chip-strip-header')).toBeTruthy();
  });

  describe('visible prop (eye toggle)', () => {
    it("default visible=true renders chip list", () => {
      const { container } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} />
      );
      expect(container.querySelector('.degree-chip-strip-list')).toBeTruthy();
    });

    it("visible=false hides chip list", () => {
      const { container } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} visible={false} />
      );
      expect(container.querySelector('.degree-chip-strip-list')).toBeNull();
    });

    it("visible=false sets data-scale-visible=false on section", () => {
      const { container } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} visible={false} />
      );
      expect(container.querySelector('.degree-chip-strip')?.getAttribute('data-scale-visible')).toBe('false');
    });

    it("visible=true sets data-scale-visible=true on section", () => {
      const { container } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} visible={true} />
      );
      expect(container.querySelector('.degree-chip-strip')?.getAttribute('data-scale-visible')).toBe('true');
    });

    it("chip buttons are enabled when onChipToggle provided and visible", () => {
      const toggle = vi.fn();
      const { getAllByRole } = render(
        <DegreeChipStrip
          scaleName="A Natural Minor"
          chips={aMinorChips}
          onChipToggle={toggle}
          visible={true}
        />
      );
      const buttons = getAllByRole('button');
      expect(buttons.every((b) => !b.hasAttribute('disabled'))).toBe(true);
    });

    it("chip buttons are disabled when no onChipToggle provided", () => {
      const { getAllByRole } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} visible={true} />
      );
      const buttons = getAllByRole('button');
      expect(buttons.every((b) => b.hasAttribute('disabled'))).toBe(true);
    });

    it("headerAction renders inside the strip", () => {
      const { getByTestId } = render(
        <DegreeChipStrip
          scaleName="A Natural Minor"
          chips={aMinorChips}
          headerAction={<span data-testid="action-slot">ctrl</span>}
        />
      );
      expect(getByTestId('action-slot')).toBeTruthy();
    });

    it("visible=false still renders headerAction", () => {
      const { getByTestId } = render(
        <DegreeChipStrip
          scaleName="A Natural Minor"
          chips={aMinorChips}
          visible={false}
          headerAction={<span data-testid="action-slot">ctrl</span>}
        />
      );
      expect(getByTestId('action-slot')).toBeTruthy();
    });

    it("hidden chips show data-hidden when visible", () => {
      const { container } = render(
        <DegreeChipStrip
          scaleName="A Natural Minor"
          chips={aMinorChips}
          visible={true}
          hiddenNotes={new Set(['B'])}
          onChipToggle={() => {}}
        />
      );
      expect(container.querySelectorAll('[data-hidden="true"]').length).toBe(1);
    });

    it("no data-hidden chips rendered when no hiddenNotes passed", () => {
      const { container } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} visible={true} />
      );
      expect(container.querySelectorAll('[data-hidden="true"]').length).toBe(0);
    });
  });

  describe('colorNotes prop (scale-owned color-note rendering)', () => {
    it("color note chips get data-is-color-note attribute", () => {
      const { container } = render(
        <DegreeChipStrip
          scaleName="C Minor Blues"
          chips={aMinorChips}
          colorNotes={new Set(['E'])}
          visible={true}
        />
      );
      expect(container.querySelectorAll('[data-is-color-note="true"]').length).toBe(1);
    });

    it("color notes appear without chord overlay (pure scale feature)", () => {
      const { container } = render(
        <DegreeChipStrip
          scaleName="C Minor Blues"
          chips={aMinorChips}
          colorNotes={new Set(['E', 'G'])}
          visible={true}
        />
      );
      expect(container.querySelectorAll('[data-is-color-note="true"]').length).toBe(2);
    });

    it("no data-is-color-note attributes when colorNotes not provided", () => {
      const { container } = render(
        <DegreeChipStrip scaleName="A Natural Minor" chips={aMinorChips} visible={true} />
      );
      expect(container.querySelectorAll('[data-is-color-note="true"]').length).toBe(0);
    });

    it("chord overlay independence: DegreeChipStrip does not accept chord props", () => {
      const { container } = render(
        <DegreeChipStrip
          scaleName="A Natural Minor"
          chips={aMinorChips}
          colorNotes={new Set(['E'])}
        />
      );
      // The strip should have no chord-specific data attributes
      expect(container.querySelector('[data-in-chord]')).toBeNull();
      expect(container.querySelector('[data-is-chord-root]')).toBeNull();
      expect(container.querySelector('[data-chord-active]')).toBeNull();
    });

    it("color note chip has data-is-color-note for squircle CSS targeting", () => {
      // CSS applies border-radius: 28% (squircle geometry) to [data-is-color-note='true'].
      // This test verifies the data attribute hook is present so CSS can target it.
      const { container } = render(
        <DegreeChipStrip
          scaleName="C Minor Blues"
          chips={aMinorChips}
          colorNotes={new Set(['E'])}
          visible={true}
        />
      );
      const colorNoteItem = container.querySelector('[data-is-color-note="true"]');
      expect(colorNoteItem).toBeTruthy();
      // Tonic chip must NOT also have data-is-color-note (distinct roles)
      const tonicItem = container.querySelector('[data-is-tonic="true"]');
      expect(tonicItem?.getAttribute('data-is-color-note')).toBeNull();
    });

    it("color note chips are distinct from tonic and regular in-scale chips", () => {
      const { container } = render(
        <DegreeChipStrip
          scaleName="C Minor Blues"
          chips={aMinorChips}
          colorNotes={new Set(['E'])}
          visible={true}
        />
      );
      const colorItems = container.querySelectorAll('[data-is-color-note="true"]');
      const tonicItems = container.querySelectorAll('[data-is-tonic="true"]');
      const inScaleItems = container.querySelectorAll('[data-in-scale="true"]');
      // Color chips exist separately from tonic chips
      expect(colorItems.length).toBe(1);
      expect(tonicItems.length).toBe(1);
      // In-scale count includes the color note (it is also in scale)
      expect(inScaleItems.length).toBeGreaterThanOrEqual(colorItems.length);
    });
  });
});
