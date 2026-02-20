/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act, within } from '@testing-library/react';

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
import { ToastProvider } from '../../../components/Toast';
import type { McpServer } from '../../../../shared/types';

const renderPage = () => render(<ToastProvider><McpPage /></ToastProvider>);

function makeServer(name: string, status: McpServer['status'] = 'connected'): McpServer {
  return { name, fullName: name, command: `npx ${name}`, status, scope: 'user' };
}

describe('McpPage — 核心流程', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('載入完成顯示 server 卡片列表（name, command, scope badge）', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          { ...makeServer('filesystem'), scope: 'user' },
          { ...makeServer('github'), scope: 'project' },
        ];
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('filesystem')).toBeTruthy();
      expect(screen.getByText('github')).toBeTruthy();
    });

    // command 顯示
    expect(screen.getByText('npx filesystem')).toBeTruthy();
    expect(screen.getByText('npx github')).toBeTruthy();

    // scope badge
    const userBadges = screen.getAllByText('user');
    expect(userBadges.length).toBeGreaterThan(0);
    expect(screen.getByText('project')).toBeTruthy();
  });

  it('載入中顯示 skeleton 卡片', () => {
    // mcp.list never resolves during this test
    mockSendRequest.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelectorAll('.skeleton-card').length).toBe(3);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('空列表顯示 EmptyState + "Add Server" 按鈕開啟 AddMcpDialog', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No MCP servers configured')).toBeTruthy();
    });

    // EmptyState 有 description 和 action button
    expect(screen.getByText('Add an MCP server to extend Claude\'s capabilities.')).toBeTruthy();

    // empty-state 內的 Add Server 按鈕（header 也有一個，用 within 區分）
    const emptyState = document.querySelector('.empty-state')!;
    await act(async () => {
      fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: 'Add Server' }));
    });

    // AddMcpDialog 開啟
    expect(screen.getByText('Add MCP Server')).toBeTruthy();
  });

  it('點 header "Add Server" → 顯示 AddMcpDialog', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No MCP servers configured')).toBeTruthy();
    });

    // page-actions 內的 Add Server（header 按鈕）
    const header = document.querySelector('.page-actions')!;
    await act(async () => {
      fireEvent.click(within(header as HTMLElement).getByText('Add Server'));
    });

    // AddMcpDialog 顯示
    expect(screen.getByText('Add MCP Server')).toBeTruthy();
  });

  it('點 server 的 "Remove" → 顯示 ConfirmDialog → 確認 → 送出 mcp.remove → 刷新', async () => {
    let listCallCount = 0;

    mockSendRequest.mockImplementation(async (req: { type: string; name?: string }) => {
      if (req.type === 'mcp.list') {
        listCallCount++;
        return listCallCount <= 1 ? [makeServer('my-tool')] : [];
      }
      if (req.type === 'mcp.remove') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('my-tool')).toBeTruthy();
    });

    // 點 card 上的 Remove
    await act(async () => {
      fireEvent.click(screen.getByText('Remove'));
    });

    // ConfirmDialog 出現
    expect(screen.getByText('Remove MCP Server')).toBeTruthy();
    expect(screen.getByText(/Remove "my-tool"/)).toBeTruthy();

    // 用 within(dialog) scope 定位 confirm 按鈕
    await act(async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    });

    // mcp.remove 被送出
    const removeCalls = mockSendRequest.mock.calls
      .map((args: unknown[]) => args[0] as { type: string; name?: string })
      .filter((req) => req.type === 'mcp.remove');
    expect(removeCalls).toHaveLength(1);
    expect(removeCalls[0].name).toBe('my-tool');

    // 刷新（mcp.list 第二次呼叫）後顯示空列表
    await waitFor(() => {
      expect(screen.getByText('No MCP servers configured')).toBeTruthy();
    });
  });

  it('點 "Details" → 送出 mcp.getDetail → 顯示 detail modal', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string; name?: string }) => {
      if (req.type === 'mcp.list') return [makeServer('details-srv')];
      if (req.type === 'mcp.getDetail') return JSON.stringify({ name: 'details-srv', command: 'npx details-srv', status: 'connected' }, null, 2);
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('details-srv')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Details'));
    });

    // detail modal 顯示
    await waitFor(() => {
      expect(screen.getByText('Server Detail')).toBeTruthy();
      // JsonHighlight 將 JSON token 拆成 span，用 container query 驗證
      expect(document.querySelector('.json-highlight')).toBeTruthy();
      expect(document.querySelector('.json-token--key')).toBeTruthy();
    });

    // 關閉 modal
    await act(async () => {
      fireEvent.click(screen.getByText('Close'));
    });

    expect(screen.queryByText('Server Detail')).toBeNull();
  });

  it('mcp.statusUpdate push → 更新 server 列表 DOM', async () => {
    let pushCallback: ((msg: Record<string, unknown>) => void) | undefined;
    mockOnPushMessage.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
      pushCallback = cb;
      return () => {};
    });

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [makeServer('old-srv')];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('old-srv')).toBeTruthy();
    });

    // push statusUpdate with new server list
    await act(async () => {
      pushCallback!({
        type: 'mcp.statusUpdate',
        servers: [makeServer('new-srv', 'connected'), makeServer('another-srv', 'pending')],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('new-srv')).toBeTruthy();
      expect(screen.getByText('another-srv')).toBeTruthy();
    });

    // old server 消失
    expect(screen.queryByText('old-srv')).toBeNull();
  });

  it('Reset Project Choices 按鈕送出 mcp.resetProjectChoices → 刷新', async () => {
    const firstList = [makeServer('proj-srv')];
    const secondList = [makeServer('proj-srv'), makeServer('proj-srv-2')];
    let listCallCount = 0;

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        listCallCount++;
        return listCallCount <= 1 ? firstList : secondList;
      }
      if (req.type === 'mcp.resetProjectChoices') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('proj-srv')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Reset Project Choices'));
    });

    // mcp.resetProjectChoices 被送出
    const resetCalls = mockSendRequest.mock.calls
      .map((args: unknown[]) => args[0] as { type: string })
      .filter((req) => req.type === 'mcp.resetProjectChoices');
    expect(resetCalls).toHaveLength(1);

    // 刷新後顯示新的 server 列表
    await waitFor(() => {
      expect(screen.getByText('proj-srv-2')).toBeTruthy();
    });
  });

  it('載入失敗顯示 ErrorBanner，可 dismiss', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') throw new Error('Connection refused');
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeTruthy();
    });

    // ErrorBanner 顯示（role="alert"）
    expect(screen.getByRole('alert')).toBeTruthy();

    // 點 dismiss
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'));
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
