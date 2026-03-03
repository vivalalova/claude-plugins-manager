/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

vi.mock('../marketplace/MarketplacePage', () => ({
  MarketplacePage: () => <div>marketplace-page</div>,
}));

vi.mock('../plugin/PluginPage', () => ({
  PluginPage: () => <div>plugin-page</div>,
}));

vi.mock('../mcp/McpPage', () => ({
  McpPage: () => <div>mcp-page</div>,
}));

import { vi } from 'vitest';
import { EditorApp } from '../EditorApp';

describe('EditorApp', () => {
  afterEach(() => {
    cleanup();
  });

  it('初始 mode 為 plugin 時顯示 PluginPage', () => {
    render(<EditorApp mode="plugin" />);

    expect(screen.getByText('plugin-page')).toBeTruthy();
    expect(screen.queryByText('marketplace-page')).toBeNull();
  });

  it('收到 navigate message 後切換到指定頁面', () => {
    render(<EditorApp mode="marketplace" />);
    expect(screen.getByText('marketplace-page')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'navigate', category: 'mcp' },
      }));
    });

    expect(screen.getByText('mcp-page')).toBeTruthy();
    expect(screen.queryByText('marketplace-page')).toBeNull();
  });

  it('非 navigate message 不改變目前頁面', () => {
    render(<EditorApp mode="plugin" />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'plugin.refresh' },
      }));
    });

    expect(screen.getByText('plugin-page')).toBeTruthy();
    expect(screen.queryByText('mcp-page')).toBeNull();
  });

  it('未知 mode 顯示錯誤訊息', () => {
    render(<EditorApp mode="unknown" />);

    expect(screen.getByText('Unknown mode: unknown')).toBeTruthy();
  });
});
