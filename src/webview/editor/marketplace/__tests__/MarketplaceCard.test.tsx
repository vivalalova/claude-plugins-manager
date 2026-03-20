/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { MarketplaceCard } from '../MarketplaceCard';
import type { Marketplace } from '../../../../shared/types';

function makeMarketplace(overrides: Partial<Marketplace> = {}): Marketplace {
  return {
    name: 'alpha',
    source: 'github',
    repo: 'owner/alpha',
    installLocation: '/tmp/alpha',
    autoUpdate: true,
    ...overrides,
  };
}

describe('MarketplaceCard', () => {
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  const onToggleAutoUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('優先顯示 url，並渲染相對更新時間', () => {
    renderWithI18n(
      <MarketplaceCard
        marketplace={makeMarketplace({
          url: 'https://github.com/example/alpha.git',
          path: '/Users/lova/alpha',
          lastUpdated: '2026-01-01T00:00:00Z',
        })}
        updating={false}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onToggleAutoUpdate={onToggleAutoUpdate}
      />,
    );

    expect(screen.getByText('https://github.com/example/alpha.git')).toBeTruthy();
    expect(screen.getByText('Updated: 4d ago')).toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('auto update、update、remove 操作都會回呼上層', () => {
    renderWithI18n(
      <MarketplaceCard
        marketplace={makeMarketplace({ autoUpdate: false })}
        updating={false}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onToggleAutoUpdate={onToggleAutoUpdate}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onToggleAutoUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('updating 狀態停用 update 按鈕並顯示 Updating...', () => {
    renderWithI18n(
      <MarketplaceCard
        marketplace={makeMarketplace()}
        updating
        onUpdate={onUpdate}
        onRemove={onRemove}
        onToggleAutoUpdate={onToggleAutoUpdate}
      />,
    );

    expect((screen.getByRole('button', { name: 'Updating...' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
