/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmptyState,
  PluginIcon,
  MarketplaceIcon,
  ServerIcon,
  NoResultsIcon,
} from '../EmptyState';

describe('EmptyState component', () => {
  it('renders icon, title, description, and action button', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={<span data-testid="icon">ICON</span>}
        title="No items"
        description="Try adding one."
        action={{ label: 'Add', onClick }}
      />,
    );

    expect(screen.getByTestId('icon')).toBeTruthy();
    expect(screen.getByText('No items')).toBeTruthy();
    expect(screen.getByText('Try adding one.')).toBeTruthy();

    const btn = screen.getByRole('button', { name: 'Add' });
    expect(btn).toBeTruthy();

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders without description and action (minimal)', () => {
    const { container } = render(
      <EmptyState icon={<span>IC</span>} title="Empty" />,
    );

    expect(screen.getByText('Empty')).toBeTruthy();
    expect(container.querySelector('.empty-state-description')).toBeNull();
    expect(container.querySelector('.empty-state-action')).toBeNull();
  });

  it('icon container has aria-hidden', () => {
    const { container } = render(
      <EmptyState icon={<span>IC</span>} title="Empty" />,
    );
    const iconWrapper = container.querySelector('.empty-state-icon');
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SVG icons render without error', () => {
  it.each([
    ['PluginIcon', PluginIcon],
    ['MarketplaceIcon', MarketplaceIcon],
    ['ServerIcon', ServerIcon],
    ['NoResultsIcon', NoResultsIcon],
  ])('%s renders an SVG', (_name, Icon) => {
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
