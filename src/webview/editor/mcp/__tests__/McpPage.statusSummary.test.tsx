/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
}));

import { McpPage } from '../McpPage';
import type { McpServer } from '../../../../shared/types';

function makeServer(name: string, status: McpServer['status']): McpServer {
  return {
    name,
    fullName: name,
    command: `npx ${name}`,
    status,
    scope: 'user',
  };
}

describe('McpPage — Status Summary + Error Indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('顯示 status summary bar：Connected / Failed / Pending 計數', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          makeServer('srv1', 'connected'),
          makeServer('srv2', 'connected'),
          makeServer('srv3', 'failed'),
          makeServer('srv4', 'pending'),
        ];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('Connected: 2')).toBeTruthy();
      expect(screen.getByText('Failed: 1')).toBeTruthy();
      expect(screen.getByText('Pending: 1')).toBeTruthy();
    });
  });

  it('全部 connected → 不顯示 Failed / Pending', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          makeServer('srv1', 'connected'),
          makeServer('srv2', 'connected'),
        ];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('Connected: 2')).toBeTruthy();
    });
    expect(screen.queryByText(/Failed/)).toBeNull();
    expect(screen.queryByText(/Pending/)).toBeNull();
  });

  it('failed server card 顯示紅色錯誤訊息 + Retry 按鈕', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('bad-srv', 'failed')];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });
  });

  it('connected server card 不顯示 Retry 按鈕', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('good-srv', 'connected')];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('good-srv')).toBeTruthy();
    });
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('點擊 Retry → 呼叫 mcp.refreshStatus', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('bad-srv', 'failed')];
      }
      if (req.type === 'mcp.refreshStatus') {
        return [makeServer('bad-srv', 'connected')];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });

    const refreshCalls = mockSendRequest.mock.calls
      .map((args: unknown[]) => (args[0] as { type: string }).type)
      .filter((t: string) => t === 'mcp.refreshStatus');
    expect(refreshCalls).toHaveLength(1);
  });

  it('mcp.pollUnavailable push → 顯示 warning banner', async () => {
    let pushCallback: ((msg: Record<string, unknown>) => void) | undefined;
    mockOnPushMessage.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
      pushCallback = cb;
      return () => {};
    });

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('srv1', 'connected')];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('srv1')).toBeTruthy();
    });

    // 模擬 pollUnavailable push
    await act(async () => {
      pushCallback!({ type: 'mcp.pollUnavailable' });
    });

    await waitFor(() => {
      expect(screen.getByText('Status polling unavailable')).toBeTruthy();
      expect(screen.getByText('Retry Polling')).toBeTruthy();
    });
  });

  it('點擊 Retry Polling → 呼叫 mcp.restartPolling + 隱藏 warning', async () => {
    let pushCallback: ((msg: Record<string, unknown>) => void) | undefined;
    mockOnPushMessage.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
      pushCallback = cb;
      return () => {};
    });

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('srv1', 'connected')];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('srv1')).toBeTruthy();
    });

    // 觸發 pollUnavailable
    await act(async () => {
      pushCallback!({ type: 'mcp.pollUnavailable' });
    });

    await waitFor(() => {
      expect(screen.getByText('Retry Polling')).toBeTruthy();
    });

    // 點擊 Retry Polling
    await act(async () => {
      fireEvent.click(screen.getByText('Retry Polling'));
    });

    const restartCalls = mockSendRequest.mock.calls
      .map((args: unknown[]) => (args[0] as { type: string }).type)
      .filter((t: string) => t === 'mcp.restartPolling');
    expect(restartCalls).toHaveLength(1);

    // warning 應消失
    expect(screen.queryByText('Status polling unavailable')).toBeNull();
  });

  it('mcp.statusUpdate push → 清除 pollUnavailable', async () => {
    let pushCallback: ((msg: Record<string, unknown>) => void) | undefined;
    mockOnPushMessage.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
      pushCallback = cb;
      return () => {};
    });

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('srv1', 'pending')];
      }
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('srv1')).toBeTruthy();
    });

    // 觸發 pollUnavailable
    await act(async () => {
      pushCallback!({ type: 'mcp.pollUnavailable' });
    });
    expect(screen.getByText('Status polling unavailable')).toBeTruthy();

    // statusUpdate 回來 → warning 消失
    await act(async () => {
      pushCallback!({
        type: 'mcp.statusUpdate',
        servers: [makeServer('srv1', 'connected')],
      });
    });

    expect(screen.queryByText('Status polling unavailable')).toBeNull();
  });

  it('空 server 列表 → 不顯示 status summary', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [];
      return undefined;
    });

    render(<McpPage />);
    await waitFor(() => {
      expect(screen.getByText('No MCP servers configured')).toBeTruthy();
    });
    expect(screen.queryByText(/Connected/)).toBeNull();
    expect(screen.queryByText(/Failed/)).toBeNull();
  });
});
