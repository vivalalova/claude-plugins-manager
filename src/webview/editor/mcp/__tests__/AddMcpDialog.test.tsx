/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

/* ── Mock sendRequest（攔截 webview → extension 通訊） ── */
const mockSendRequest = vi.fn();
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: vi.fn(() => () => {}),
}));

import { AddMcpDialog } from '../AddMcpDialog';
import type { EditServerInfo } from '../AddMcpDialog';

describe('AddMcpDialog', () => {
  const onAdded = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  describe('新增模式（無 editServer）', () => {
    it('標題顯示 "Add MCP Server"，按鈕顯示 "Add Server"', () => {
      render(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      expect(screen.getByText('Add MCP Server')).toBeTruthy();
      expect(screen.getByText('Add Server')).toBeTruthy();
    });

    it('顯示 Form / JSON tabs', () => {
      render(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      expect(screen.getByText('Form')).toBeTruthy();
      expect(screen.getByText('JSON')).toBeTruthy();
    });

    it('submit 時只呼叫 mcp.add，不呼叫 mcp.remove', async () => {
      render(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByPlaceholderText('my-server'), {
        target: { value: 'test-server' },
      });
      fireEvent.change(screen.getByPlaceholderText('npx my-mcp-server or https://...'), {
        target: { value: 'npx test-mcp' },
      });
      fireEvent.click(screen.getByText('Add Server'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledTimes(1);
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'mcp.add' }),
        );
      });
    });
  });

  describe('編輯模式（有 editServer）', () => {
    const editServer: EditServerInfo = {
      name: 'my-mcp',
      commandOrUrl: 'npx -y @upstash/context7-mcp',
      scope: 'user',
    };

    it('標題顯示 "Edit MCP Server"，按鈕顯示 "Update Server"', () => {
      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      expect(screen.getByText('Edit MCP Server')).toBeTruthy();
      expect(screen.getByText('Update Server')).toBeTruthy();
    });

    it('隱藏 Form / JSON tabs', () => {
      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      expect(screen.queryByText('Form')).toBeNull();
      expect(screen.queryByText('JSON')).toBeNull();
    });

    it('預填 name 和 commandOrUrl', () => {
      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      const nameInput = screen.getByPlaceholderText('my-server') as HTMLInputElement;
      const cmdInput = screen.getByPlaceholderText('npx my-mcp-server or https://...') as HTMLInputElement;

      expect(nameInput.value).toBe('my-mcp');
      expect(cmdInput.value).toBe('npx -y @upstash/context7-mcp');
    });

    it('預填 scope', () => {
      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      const scopeSelect = screen.getByDisplayValue('user (global)') as HTMLSelectElement;
      expect(scopeSelect.value).toBe('user');
    });

    it('submit 時先 mcp.remove 再 mcp.add', async () => {
      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      fireEvent.click(screen.getByText('Update Server'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledTimes(2);

        // 第一次：remove 舊 server
        expect(mockSendRequest).toHaveBeenNthCalledWith(1, {
          type: 'mcp.remove',
          name: 'my-mcp',
          scope: 'user',
        });

        // 第二次：add 新 server
        expect(mockSendRequest).toHaveBeenNthCalledWith(2,
          expect.objectContaining({ type: 'mcp.add' }),
        );
      });
    });

    it('remove 失敗時顯示錯誤，不繼續 add', async () => {
      mockSendRequest.mockRejectedValueOnce(new Error('remove failed'));

      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      fireEvent.click(screen.getByText('Update Server'));

      await waitFor(() => {
        expect(screen.getByText('remove failed')).toBeTruthy();
        expect(mockSendRequest).toHaveBeenCalledTimes(1);
        expect(onAdded).not.toHaveBeenCalled();
      });
    });

    it('scope undefined 時 remove 不帶 scope', async () => {
      const noScopeServer: EditServerInfo = {
        name: 'orphan',
        commandOrUrl: 'node server.js',
      };

      render(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={noScopeServer} />,
      );

      fireEvent.click(screen.getByText('Update Server'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenNthCalledWith(1, {
          type: 'mcp.remove',
          name: 'orphan',
          scope: undefined,
        });
      });
    });
  });
});
