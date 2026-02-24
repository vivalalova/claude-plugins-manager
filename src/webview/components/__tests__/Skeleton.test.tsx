/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderWithI18n } from '../../__test-utils__/renderWithProviders';
import {
  Skeleton,
  PluginCardSkeleton,
  MarketplaceCardSkeleton,
  McpCardSkeleton,
} from '../Skeleton';

describe('Skeleton 基本元件', () => {
  it('預設 variant=text 渲染 skeleton--text class', () => {
    const { container } = renderWithI18n(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skeleton');
    expect(el.className).toContain('skeleton--text');
  });

  it('variant=rect 渲染 skeleton--rect class', () => {
    const { container } = renderWithI18n(<Skeleton variant="rect" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skeleton--rect');
  });

  it('variant=circle 渲染 skeleton--circle class', () => {
    const { container } = renderWithI18n(<Skeleton variant="circle" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skeleton--circle');
  });

  it('設定 aria-hidden="true" 對 screen reader 隱藏', () => {
    const { container } = renderWithI18n(<Skeleton />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('接受自訂 width/height', () => {
    const { container } = renderWithI18n(<Skeleton width={200} height={30} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('30px');
  });

  it('接受額外 className', () => {
    const { container } = renderWithI18n(<Skeleton className="my-custom" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('my-custom');
    expect(el.className).toContain('skeleton');
  });

  it('text 預設高度 14px', () => {
    const { container } = renderWithI18n(<Skeleton variant="text" />);
    expect((container.firstChild as HTMLElement).style.height).toBe('14px');
  });

  it('circle 預設 width 等於 height', () => {
    const { container } = renderWithI18n(<Skeleton variant="circle" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('32px');
    expect(el.style.height).toBe('32px');
  });
});

describe('PluginCardSkeleton', () => {
  it('渲染 3 張 skeleton 卡片', () => {
    const { container } = renderWithI18n(<PluginCardSkeleton />);
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards.length).toBe(3);
  });

  it('每張卡片包含 skeleton 元素（pulse 動畫）', () => {
    const { container } = renderWithI18n(<PluginCardSkeleton />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(6); // 至少每張 2 個
  });

  it('卡片有 skeleton-card class（CSS 設 pointer-events: none）', () => {
    const { container } = renderWithI18n(<PluginCardSkeleton />);
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards.length).toBe(3);
    for (const card of cards) {
      expect(card.className).toContain('card');
      expect(card.className).toContain('skeleton-card');
    }
  });

  it('容器有 role="status" 和 aria-label（screen reader 載入通知）', () => {
    const { container } = renderWithI18n(<PluginCardSkeleton />);
    const list = container.querySelector('.card-list');
    expect(list?.getAttribute('role')).toBe('status');
    expect(list?.getAttribute('aria-label')).toBe('Loading plugins');
  });
});

describe('MarketplaceCardSkeleton', () => {
  it('渲染 3 張 skeleton 卡片', () => {
    const { container } = renderWithI18n(<MarketplaceCardSkeleton />);
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards.length).toBe(3);
  });

  it('容器有 role="status" 和 aria-label', () => {
    const { container } = renderWithI18n(<MarketplaceCardSkeleton />);
    const list = container.querySelector('.card-list');
    expect(list?.getAttribute('role')).toBe('status');
    expect(list?.getAttribute('aria-label')).toBe('Loading marketplaces');
  });
});

describe('McpCardSkeleton', () => {
  it('渲染 3 張 skeleton 卡片', () => {
    const { container } = renderWithI18n(<McpCardSkeleton />);
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards.length).toBe(3);
  });

  it('容器有 role="status" 和 aria-label', () => {
    const { container } = renderWithI18n(<McpCardSkeleton />);
    const list = container.querySelector('.card-list');
    expect(list?.getAttribute('role')).toBe('status');
    expect(list?.getAttribute('aria-label')).toBe('Loading servers');
  });
});
