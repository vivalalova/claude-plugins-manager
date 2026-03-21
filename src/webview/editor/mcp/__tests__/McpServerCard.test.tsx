/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { McpServerCard } from '../McpServerCard';
import type { McpServer } from '../../../../shared/types';

vi.mock('../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

function makeServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    name: 'test-server',
    fullName: 'test-server',
    command: 'npx test-server',
    status: 'connected',
    scope: 'user',
    ...overrides,
  };
}

describe('McpServerCard', () => {
  let noop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    noop = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  describe('failed 狀態', () => {
    it('card 有 card--failed class', () => {
      const { container } = renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(container.querySelector('.card--failed')).toBeTruthy();
    });

    it('顯示 "Connection failed" 訊息', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByText('Connection failed')).toBeTruthy();
    });

    it('顯示 Test Connection 按鈕', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByRole('button', { name: 'Test Connection' })).toBeTruthy();
    });

    it('點擊 Test Connection 呼叫 onTestConnection', () => {
      const onTestConnection = vi.fn();
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={onTestConnection}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
      expect(onTestConnection).toHaveBeenCalledOnce();
    });

    it('testing=true 時按鈕 disabled 且文字變 "Checking all servers..."', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
          testing
        />,
      );
      const btn = screen.getByRole('button', { name: 'Checking all servers...' });
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('anyTesting=true 時按鈕 disabled', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
          anyTesting
        />,
      );
      const btn = screen.getByRole('button', { name: 'Test Connection' });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('retrying=true 時按鈕 disabled', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'failed' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
          retrying
        />,
      );
      const btn = screen.getByRole('button', { name: 'Test Connection' });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('connected 狀態', () => {
    it('card 無 card--failed 和 card--needs-auth class', () => {
      const { container } = renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'connected' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(container.querySelector('.card--failed')).toBeNull();
      expect(container.querySelector('.card--needs-auth')).toBeNull();
    });

    it('不顯示 "Connection failed" 和 "Authentication required"', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'connected' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.queryByText('Connection failed')).toBeNull();
      expect(screen.queryByText(/authentication required/i)).toBeNull();
    });

    it('不顯示 Test Connection 和 Check Status 按鈕', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ status: 'connected' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Test Connection' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Check Status' })).toBeNull();
    });
  });

  describe('按鈕互動', () => {
    it('點擊 Details 呼叫 onViewDetail', () => {
      const onViewDetail = vi.fn();
      renderWithI18n(
        <McpServerCard
          server={makeServer()}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={onViewDetail}
          onTestConnection={noop}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));
      expect(onViewDetail).toHaveBeenCalledOnce();
    });

    it('有 scope 且非 plugin-provided → 顯示 Edit 和 Remove 按鈕', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ scope: 'user', fullName: 'test-server' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
    });

    it('點擊 Edit 呼叫 onEdit', () => {
      const onEdit = vi.fn();
      renderWithI18n(
        <McpServerCard
          server={makeServer({ scope: 'user', fullName: 'test-server' })}
          onEdit={onEdit}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it('點擊 Remove 呼叫 onRemove', () => {
      const onRemove = vi.fn();
      renderWithI18n(
        <McpServerCard
          server={makeServer({ scope: 'user', fullName: 'test-server' })}
          onEdit={noop}
          onRemove={onRemove}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(onRemove).toHaveBeenCalledOnce();
    });

    it('removing=true 時 Remove 按鈕 disabled 且文字變 "Removing..."', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ scope: 'user', fullName: 'test-server' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
          removing
        />,
      );
      const btn = screen.getByRole('button', { name: 'Removing...' });
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('Plugin-provided server', () => {
    it('fullName 以 "plugin:" 開頭 → 不顯示 Edit 和 Remove 按鈕', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ fullName: 'plugin:my-plugin/test-server', scope: 'user' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    });

    it('顯示 plugin metadata（plugin id）', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({
            fullName: 'plugin:my-plugin/test-server',
            scope: 'user',
            plugin: { id: 'my-plugin', enabled: true },
          })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByText('Provided by plugin my-plugin')).toBeTruthy();
    });

    it('plugin.enabled=true 顯示 "Enabled in Plugins"', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({
            fullName: 'plugin:my-plugin/test-server',
            scope: 'user',
            plugin: { id: 'my-plugin', enabled: true },
          })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByText('Enabled in Plugins')).toBeTruthy();
    });

    it('plugin.enabled=false 顯示 "Disabled in Plugins"', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({
            fullName: 'plugin:my-plugin/test-server',
            scope: 'user',
            plugin: { id: 'my-plugin', enabled: false },
          })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByText('Disabled in Plugins')).toBeTruthy();
    });
  });

  describe('無 scope server', () => {
    it('scope undefined → 不顯示 Edit 和 Remove 按鈕', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ scope: undefined })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    });

    it('scope undefined → 不顯示 ScopeBadge', () => {
      const { container } = renderWithI18n(
        <McpServerCard
          server={makeServer({ scope: undefined })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      // ScopeBadge renders a .scope-badge element
      expect(container.querySelector('.scope-badge')).toBeNull();
    });
  });

  describe('testError 顯示', () => {
    it('testError 有值時顯示錯誤訊息', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer()}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
          testError="connection timeout"
        />,
      );
      expect(screen.getByText(/connection timeout/)).toBeTruthy();
    });

    it('testError 為 null 時不顯示錯誤', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer()}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
          testError={null}
        />,
      );
      expect(screen.queryByText(/Test failed/)).toBeNull();
    });
  });

  describe('fullName 與 name 不同', () => {
    it('fullName !== name 時顯示 fullName', () => {
      renderWithI18n(
        <McpServerCard
          server={makeServer({ name: 'my-server', fullName: 'workspace/my-server' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      expect(screen.getByText('workspace/my-server')).toBeTruthy();
    });

    it('fullName === name 時不額外顯示 fullName', () => {
      const { container } = renderWithI18n(
        <McpServerCard
          server={makeServer({ name: 'my-server', fullName: 'my-server' })}
          onEdit={noop}
          onRemove={noop}
          onViewDetail={noop}
          onTestConnection={noop}
        />,
      );
      // card-name shows name once; the extra fullName div should not exist
      const nameEls = container.querySelectorAll('[style*="font-size: 11px"], [style*="fontSize"]');
      // The extra div with fontSize 11 should not render when fullName === name
      const allText = container.textContent ?? '';
      const occurrences = allText.split('my-server').length - 1;
      // name appears in card-name and possibly aria-label; fullName extra div should NOT add another
      // The card renders: aria-label=name, card-name=name, extra div only if fullName !== name
      // So we expect the extra small div (style fontSize 11) to be absent
      expect(nameEls.length).toBe(0);
    });
  });
});
