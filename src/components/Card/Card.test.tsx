import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { axe } from '../../test-utils/a11y';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Card/Card', () => {
  it('renders with title — h2 exists, section has aria-labelledby pointing to h2', () => {
    render(<Card title="Test Title"><p>Content</p></Card>);
    const heading = screen.getByRole('heading', { level: 2, name: 'Test Title' });
    expect(heading).toBeTruthy();
    const section = heading.closest('section');
    expect(section).toBeTruthy();
    expect(section!.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('renders Card.Header and Card.Body composition path', () => {
    render(
      <section aria-label="Composed card">
        <Card.Header title="Composed Header" />
        <Card.Body><p>Body content</p></Card.Body>
      </section>
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Composed Header' })).toBeTruthy();
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('renders with action slot', () => {
    render(
      <Card title="Card with Action" action={<button>Edit</button>}>
        <p>Content</p>
      </Card>
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('renders with icon slot', () => {
    render(
      <Card title="Card with Icon" icon={<span data-testid="icon">★</span>}>
        <p>Content</p>
      </Card>
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('warns in dev when no accessible name is provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Card><p>Anonymous content</p></Card>);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Missing accessible name'));
  });

  it('does not warn when aria-label is provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Card aria-label="My card"><p>Content</p></Card>);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('renders as div when as="div" is specified', () => {
    const { container } = render(<Card as="div" aria-label="Div card"><p>Content</p></Card>);
    expect(container.querySelector('div.card')).toBeTruthy();
    expect(container.querySelector('section.card')).toBeNull();
  });

  it('has no accessibility violations (default render)', async () => {
    const { container } = render(<Card title="Accessible Card"><p>Card body content</p></Card>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations (with action and icon)', async () => {
    const { container } = render(
      <Card title="Card with Action" icon={<span aria-hidden="true">★</span>} action={<button>Edit</button>}>
        <p>Content</p>
      </Card>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
