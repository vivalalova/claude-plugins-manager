/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithI18n } from '../../__test-utils__/renderWithProviders';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('connected 顯示文字 "Connected"', () => {
    renderWithI18n(<StatusBadge status="connected" />);
    expect(screen.getByText('Connected')).toBeTruthy();
  });

  it('needs-auth 顯示文字 "Needs Auth"', () => {
    renderWithI18n(<StatusBadge status="needs-auth" />);
    expect(screen.getByText('Needs Auth')).toBeTruthy();
  });

  it('needs-auth 有 tooltip 說明認證方式', () => {
    const { container } = renderWithI18n(<StatusBadge status="needs-auth" />);
    const badge = container.querySelector('.badge');
    expect(badge?.getAttribute('title')).toMatch(/auth/i);
  });

  it('connected 沒有 tooltip', () => {
    const { container } = renderWithI18n(<StatusBadge status="connected" />);
    const badge = container.querySelector('.badge');
    expect(badge?.getAttribute('title')).toBeFalsy();
  });

  it('failed 沒有 tooltip', () => {
    const { container } = renderWithI18n(<StatusBadge status="failed" />);
    const badge = container.querySelector('.badge');
    expect(badge?.getAttribute('title')).toBeFalsy();
  });
});
