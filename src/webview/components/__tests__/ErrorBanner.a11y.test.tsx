/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderWithI18n } from '../../__test-utils__/renderWithProviders';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBanner } from '../ErrorBanner';

describe('ErrorBanner accessibility', () => {
  afterEach(cleanup);

  it('role="alert" 讓 screen reader 自動朗讀', () => {
    renderWithI18n(<ErrorBanner message="Something went wrong" onDismiss={vi.fn()} />);

    const banner = screen.getByRole('alert');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Something went wrong');
  });

  it('dismiss 按鈕有 aria-label="Dismiss"', () => {
    renderWithI18n(<ErrorBanner message="error" onDismiss={vi.fn()} />);

    const btn = screen.getByRole('button', { name: 'Dismiss' });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Dismiss');
  });

  it('無 onDismiss 時不渲染 dismiss 按鈕', () => {
    renderWithI18n(<ErrorBanner message="error" />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});
