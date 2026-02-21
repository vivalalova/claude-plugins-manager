/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { McpServerCard } from '../McpServerCard';
import type { McpServer } from '../../../../shared/types';

function makeServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    name: 'auth-srv',
    fullName: 'auth-srv',
    command: 'npx auth-srv',
    status: 'needs-auth',
    scope: 'user',
    ...overrides,
  };
}

const noop = () => {};

describe('McpServerCard — needs-auth 狀態', () => {
  afterEach(() => { cleanup(); });

  it('needs-auth server 顯示認證引導訊息', () => {
    render(
      <McpServerCard
        server={makeServer()}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
        onAuthenticate={noop}
      />,
    );

    expect(screen.getByText(/authentication required/i)).toBeTruthy();
  });

  it('needs-auth server card 有橘色左邊框樣式', () => {
    const { container } = render(
      <McpServerCard
        server={makeServer()}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
        onAuthenticate={noop}
      />,
    );

    expect(container.querySelector('.card--needs-auth')).toBeTruthy();
  });

  it('needs-auth server 顯示 Check Status 按鈕', () => {
    render(
      <McpServerCard
        server={makeServer()}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
        onAuthenticate={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check Status' })).toBeTruthy();
  });

  it('點擊 Check Status 呼叫 onAuthenticate', () => {
    const onAuthenticate = vi.fn();
    render(
      <McpServerCard
        server={makeServer()}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
        onAuthenticate={onAuthenticate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }));
    expect(onAuthenticate).toHaveBeenCalledOnce();
  });

  it('connected server 不顯示認證引導', () => {
    render(
      <McpServerCard
        server={makeServer({ status: 'connected' })}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
      />,
    );

    expect(screen.queryByText(/authentication required/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check Status' })).toBeNull();
  });

  it('failed server 不顯示 Check Status 按鈕（顯示 Retry）', () => {
    render(
      <McpServerCard
        server={makeServer({ status: 'failed' })}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Check Status' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('card-auth-guide 有 role="status"', () => {
    render(
      <McpServerCard
        server={makeServer()}
        onEdit={noop}
        onRemove={noop}
        onViewDetail={noop}
        onRetry={noop}
        onAuthenticate={noop}
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/authentication required/i);
  });
});
