/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('connected 顯示文字 "Connected"', () => {
    render(<StatusBadge status="connected" />);
    expect(screen.getByText('Connected')).toBeTruthy();
  });

  it('needs-auth 顯示文字 "Needs Auth"', () => {
    render(<StatusBadge status="needs-auth" />);
    expect(screen.getByText('Needs Auth')).toBeTruthy();
  });

  it('needs-auth 有 tooltip 說明認證方式', () => {
    const { container } = render(<StatusBadge status="needs-auth" />);
    const badge = container.querySelector('.badge');
    expect(badge?.getAttribute('title')).toMatch(/auth/i);
  });

  it('connected 沒有 tooltip', () => {
    const { container } = render(<StatusBadge status="connected" />);
    const badge = container.querySelector('.badge');
    expect(badge?.getAttribute('title')).toBeFalsy();
  });

  it('failed 沒有 tooltip', () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.querySelector('.badge');
    expect(badge?.getAttribute('title')).toBeFalsy();
  });
});
