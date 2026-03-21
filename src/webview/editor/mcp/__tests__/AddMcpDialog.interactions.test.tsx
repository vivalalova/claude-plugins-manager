/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

/* ── Mock sendRequest（攔截 webview → extension 通訊） ── */
const mockSendRequest = vi.fn();
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: vi.fn(() => () => {}),
}));

import { AddMcpDialog } from '../AddMcpDialog';
import type { EditServerInfo } from '../AddMcpDialog';

describe('AddMcpDialog 互動行為', () => {
  const onAdded = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Transport → Headers 可見性', () => {
    it('預設 stdio 時不顯示 Headers 欄位', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      expect(screen.queryByLabelText('Headers')).toBeNull();
    });

    it('切換到 http 顯示 Headers 欄位', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByDisplayValue('stdio'), { target: { value: 'http' } });

      expect(screen.getByLabelText('Headers')).toBeTruthy();
    });

    it('切換到 sse 顯示 Headers 欄位', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByDisplayValue('stdio'), { target: { value: 'sse' } });

      expect(screen.getByLabelText('Headers')).toBeTruthy();
    });

    it('切回 stdio 隱藏 Headers 欄位', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByDisplayValue('stdio'), { target: { value: 'http' } });
      expect(screen.getByLabelText('Headers')).toBeTruthy();

      fireEvent.change(screen.getByDisplayValue('http'), { target: { value: 'stdio' } });
      expect(screen.queryByLabelText('Headers')).toBeNull();
    });
  });

  describe('Tab 切換', () => {
    it('點擊 JSON tab 切換到 JSON 模式', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('JSON'));

      expect(screen.getByLabelText('Config')).toBeTruthy();
      expect(screen.queryByPlaceholderText('my-server')).toBeNull();
    });

    it('點擊 Form tab 切回 Form 模式', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('JSON'));
      fireEvent.click(screen.getByText('Form'));

      expect(screen.getByPlaceholderText('my-server')).toBeTruthy();
      expect(screen.queryByLabelText('Config')).toBeNull();
    });

    it('切換 tab 時清除錯誤訊息', async () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      // 切到 JSON 模式，提交無效 JSON 觸發錯誤
      fireEvent.click(screen.getByText('JSON'));
      const jsonTextarea = screen.getByLabelText('Config');
      fireEvent.change(jsonTextarea, { target: { value: 'not-valid-json' } });
      fireEvent.click(screen.getByText('Add Server'));

      await waitFor(() => {
        // 錯誤訊息出現在 error-banner 的 span 內
        expect(document.querySelector('.error-banner')).toBeTruthy();
      });

      // 切回 Form 應清除錯誤
      fireEvent.click(screen.getByText('Form'));

      await waitFor(() => {
        expect(document.querySelector('.error-banner')).toBeNull();
      });
    });
  });

  describe('表單驗證', () => {
    it('name 為空時 submit 按鈕 disabled', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByPlaceholderText('npx my-mcp-server or https://...'), {
        target: { value: 'npx test-mcp' },
      });

      const button = screen.getByText('Add Server') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('command 為空時 submit 按鈕 disabled', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByPlaceholderText('my-server'), {
        target: { value: 'my-server' },
      });

      const button = screen.getByText('Add Server') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('兩者都填寫後 submit 按鈕 enabled', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByPlaceholderText('my-server'), {
        target: { value: 'my-server' },
      });
      fireEvent.change(screen.getByPlaceholderText('npx my-mcp-server or https://...'), {
        target: { value: 'npx test-mcp' },
      });

      const button = screen.getByText('Add Server') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  describe('JSON 驗證', () => {
    it('JSON 為空時 submit 按鈕 disabled', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('JSON'));

      const button = screen.getByText('Add Server') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('填入內容後 submit 按鈕 enabled', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('JSON'));
      fireEvent.change(screen.getByLabelText('Config'), {
        target: { value: '{ "mcpServers": {} }' },
      });

      const button = screen.getByText('Add Server') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it('填入無效 JSON → submit → 顯示錯誤', async () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('JSON'));
      fireEvent.change(screen.getByLabelText('Config'), {
        target: { value: 'this is not json' },
      });
      fireEvent.click(screen.getByText('Add Server'));

      await waitFor(() => {
        expect(mockSendRequest).not.toHaveBeenCalled();
        // 有錯誤訊息顯示在 DOM 中
        const dialog = screen.getByRole('dialog');
        expect(dialog.textContent).toMatch(/invalid|error|json|parse/i);
      });
    });
  });

  describe('Cancel 與 Overlay', () => {
    it('點擊 Cancel 呼叫 onCancel', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('點擊 overlay 背景呼叫 onCancel', () => {
      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

       
      const overlay = document.querySelector('.confirm-overlay')!;
      fireEvent.click(overlay);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('編輯模式 rollback', () => {
    it('add 失敗時 rollback：remove 成功 → add 失敗 → 用原始參數重新 add', async () => {
      const editServer: EditServerInfo = {
        name: 'original-server',
        commandOrUrl: 'npx original-mcp',
        transport: 'stdio',
        scope: 'user',
        env: { TOKEN: 'abc' },
      };

      // call 1 (remove) resolves, call 2 (new add) rejects, call 3 (rollback add) resolves
      mockSendRequest
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('add failed'))
        .mockResolvedValueOnce(undefined);

      renderWithI18n(
        <AddMcpDialog onAdded={onAdded} onCancel={onCancel} editServer={editServer} />,
      );

      fireEvent.click(screen.getByText('Update Server'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledTimes(3);
      });

      // 第三次呼叫必須是用原始 editServer 參數 rollback
      expect(mockSendRequest).toHaveBeenNthCalledWith(3, {
        type: 'mcp.add',
        params: {
          name: 'original-server',
          commandOrUrl: 'npx original-mcp',
          args: undefined,
          transport: 'stdio',
          scope: 'user',
          env: { TOKEN: 'abc' },
          headers: undefined,
        },
      });
    });
  });

  describe('Adding 狀態', () => {
    it('submit 後按鈕顯示 "Adding..."', async () => {
      // 讓 sendRequest 永遠 pending，以便在非同步期間檢查 UI 狀態
      let resolveRequest!: () => void;
      mockSendRequest.mockReturnValue(
        new Promise<void>((resolve) => { resolveRequest = resolve; }),
      );

      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByPlaceholderText('my-server'), {
        target: { value: 'my-server' },
      });
      fireEvent.change(screen.getByPlaceholderText('npx my-mcp-server or https://...'), {
        target: { value: 'npx test-mcp' },
      });
      fireEvent.click(screen.getByText('Add Server'));

      await waitFor(() => {
        expect(screen.getByText('Adding...')).toBeTruthy();
      });

      resolveRequest();
    });

    it('submit 後按鈕 disabled', async () => {
      let resolveRequest!: () => void;
      mockSendRequest.mockReturnValue(
        new Promise<void>((resolve) => { resolveRequest = resolve; }),
      );

      renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

      fireEvent.change(screen.getByPlaceholderText('my-server'), {
        target: { value: 'my-server' },
      });
      fireEvent.change(screen.getByPlaceholderText('npx my-mcp-server or https://...'), {
        target: { value: 'npx test-mcp' },
      });
      fireEvent.click(screen.getByText('Add Server'));

      await waitFor(() => {
        const button = screen.getByText('Adding...') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
      });

      resolveRequest();
    });
  });
});
