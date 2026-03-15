/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
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

const renderPage = () => renderWithI18n(<ToastProvider><McpPage /></ToastProvider>);

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

  it('混合列表分成兩個 section：一般 MCP 在前，plugin 自帶 MCP 在後', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          makeServer('filesystem'),
          {
            name: 'context7',
            fullName: 'plugin:context7:context7',
            command: 'npx -y @upstash/context7-mcp',
            status: 'connected',
            scope: 'user',
            plugin: { id: 'context7@official', enabled: true },
          } satisfies McpServer,
          makeServer('github'),
          {
            name: 'search',
            fullName: 'plugin:search:search',
            command: 'npx -y search-mcp',
            status: 'pending',
            scope: 'project',
            plugin: { id: 'search@official', enabled: false },
          } satisfies McpServer,
        ];
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('filesystem')).toBeTruthy();
      expect(screen.getByText('context7')).toBeTruthy();
    });

    const directSection = screen.getByRole('region', { name: 'MCP Servers' });
    const pluginSection = screen.getByRole('region', { name: 'Plugin-provided MCP Servers' });

    expect(within(directSection).getByText('filesystem')).toBeTruthy();
    expect(within(directSection).getByText('github')).toBeTruthy();
    expect(within(directSection).queryByText('context7')).toBeNull();
    expect(within(directSection).queryByText('search')).toBeNull();

    expect(within(pluginSection).getByText('context7')).toBeTruthy();
    // search plugin disabled → 不顯示
    expect(within(pluginSection).queryByText('search')).toBeNull();
    expect(within(pluginSection).queryByText('filesystem')).toBeNull();
    expect(within(pluginSection).queryByText('github')).toBeNull();

    const sectionTitles = [...document.querySelectorAll('.mcp-section-title')]
      .map((el) => el.textContent);
    expect(sectionTitles).toEqual(['MCP Servers', 'Plugin-provided MCP Servers']);
  });

  it('只有一般 MCP 時不顯示 plugin section', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [makeServer('filesystem'), makeServer('github')];
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('filesystem')).toBeTruthy();
    });

    expect(screen.getByRole('region', { name: 'MCP Servers' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Plugin-provided MCP Servers' })).toBeNull();
  });

  it('只有 plugin 自帶 MCP 時不顯示空的一般 section', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          {
            name: 'context7',
            fullName: 'plugin:context7:context7',
            command: 'npx -y @upstash/context7-mcp',
            status: 'connected',
            scope: 'user',
            plugin: { id: 'context7@official', enabled: true },
          } satisfies McpServer,
        ];
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('context7')).toBeTruthy();
    });

    expect(screen.queryByRole('region', { name: 'MCP Servers' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Plugin-provided MCP Servers' })).toBeTruthy();
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

  it('同名不同 scope 的 server：移除要帶出被點選卡片的 scope', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          { ...makeServer('shared-name'), scope: 'user' },
          { ...makeServer('shared-name'), scope: 'project' },
        ];
      }
      if (req.type === 'mcp.remove') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('shared-name')).toHaveLength(2);
    });

    const projectCard = screen.getByText('project').closest('.card');
    expect(projectCard).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(projectCard as HTMLElement).getByText('Remove'));
    });

    await act(async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    });

    const removeCall = mockSendRequest.mock.calls
      .map((args: unknown[]) => args[0] as { type: string; name?: string; scope?: string })
      .find((req) => req.type === 'mcp.remove');

    expect(removeCall).toEqual({
      type: 'mcp.remove',
      name: 'shared-name',
      scope: 'project',
    });
  });

  it('plugin 自帶 server 顯示來源與 enabled 狀態，且此頁不顯示編輯/移除', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          makeServer('local-tool'),
          {
            name: 'context7',
            fullName: 'plugin:context7:context7',
            command: 'npx -y @upstash/context7-mcp',
            status: 'connected',
            scope: 'user',
            plugin: { id: 'context7@official', enabled: true },
          } satisfies McpServer,
          {
            name: 'search',
            fullName: 'plugin:search:search',
            command: 'npx -y search-mcp',
            status: 'pending',
            scope: 'project',
            plugin: { id: 'search@official', enabled: false },
          } satisfies McpServer,
        ];
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('context7')).toBeTruthy();
    });
    // search plugin disabled → 不顯示
    expect(screen.queryByText('search')).toBeNull();

    expect(screen.getByText('Provided by plugin context7@official')).toBeTruthy();
    expect(screen.queryByText('Provided by plugin search@official')).toBeNull();
    expect(screen.getByText('Enabled in Plugins')).toBeTruthy();
    expect(screen.queryByText('Disabled in Plugins')).toBeNull();
    expect(screen.getAllByText('Manage from Plugins page')).toHaveLength(1);
    expect(screen.getAllByText('Edit')).toHaveLength(1);
    expect(screen.getAllByText('Remove')).toHaveLength(1);
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

  it('mcp.statusUpdate push 後仍維持一般 MCP / plugin MCP 分組', async () => {
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

    await act(async () => {
      pushCallback!({
        type: 'mcp.statusUpdate',
        servers: [
          makeServer('filesystem'),
          {
            name: 'context7',
            fullName: 'plugin:context7:context7',
            command: 'npx -y @upstash/context7-mcp',
            status: 'connected',
            scope: 'user',
            plugin: { id: 'context7@official', enabled: true },
          } satisfies McpServer,
        ],
      });
    });

    const directSection = await screen.findByRole('region', { name: 'MCP Servers' });
    const pluginSection = await screen.findByRole('region', { name: 'Plugin-provided MCP Servers' });

    expect(within(directSection).getByText('filesystem')).toBeTruthy();
    expect(within(pluginSection).getByText('context7')).toBeTruthy();
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

  it('Remove 確認後，card 的 Remove 按鈕顯示 "Removing..." + disabled 直到完成', async () => {
    let resolveRemove!: () => void;
    let listCallCount = 0;

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        listCallCount++;
        return listCallCount <= 1 ? [makeServer('slow-srv')] : [];
      }
      if (req.type === 'mcp.remove') {
        return new Promise<void>((resolve) => { resolveRemove = resolve; });
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('slow-srv')).toBeTruthy();
    });

    // 點 Remove → ConfirmDialog
    await act(async () => {
      fireEvent.click(screen.getByText('Remove'));
    });

    // 確認 → 開始 remove
    await act(async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    });

    // remove 進行中：按鈕顯示 Removing... + disabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Removing...' });
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    // resolve remove request
    await act(async () => {
      resolveRemove();
    });

    // 完成後刷新列表
    await waitFor(() => {
      expect(screen.getByText('No MCP servers configured')).toBeTruthy();
    });
  });

  it('Remove 失敗時，按鈕恢復為 "Remove" 且 ErrorBanner 出現', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [makeServer('fail-srv')];
      if (req.type === 'mcp.remove') throw new Error('Remove failed');
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('fail-srv')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Remove'));
    });

    await act(async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    });

    // 失敗後按鈕恢復正常
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Remove' });
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    // ErrorBanner 出現
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Remove failed')).toBeTruthy();
  });

  it('同名不同 scope：Remove 只對被點選的 card 顯示 Removing', async () => {
    let resolveRemove!: () => void;

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          { ...makeServer('shared-name'), scope: 'user' },
          { ...makeServer('shared-name'), scope: 'project' },
        ];
      }
      if (req.type === 'mcp.remove') {
        return new Promise<void>((resolve) => { resolveRemove = resolve; });
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('shared-name')).toHaveLength(2);
    });

    // 點 project scope card 的 Remove
    const projectCard = screen.getByText('project').closest('.card') as HTMLElement;
    await act(async () => {
      fireEvent.click(within(projectCard).getByText('Remove'));
    });

    await act(async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    });

    // project card 顯示 Removing...
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Removing...' })).toBeTruthy();
    });

    // user card 仍顯示 Remove（非 Removing）
    const userCard = screen.getAllByText('user')[0].closest('.card') as HTMLElement;
    const userRemoveBtn = within(userCard).getByRole('button', { name: 'Remove' });
    expect(userRemoveBtn).toBeTruthy();
    expect((userRemoveBtn as HTMLButtonElement).disabled).toBe(false);

    // cleanup
    await act(async () => {
      resolveRemove();
    });
  });

  it('Test Connection 點擊 → 該 card 顯示 "Checking all servers..." + disabled 直到完成', async () => {
    let resolveRefresh!: (data: McpServer[]) => void;

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [makeServer('fail-srv', 'failed')];
      if (req.type === 'mcp.refreshStatus') {
        return new Promise<McpServer[]>((resolve) => { resolveRefresh = resolve; });
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('fail-srv')).toBeTruthy();
    });

    // 點擊 Test Connection
    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'));
    });

    // Checking all servers... + disabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Checking all servers...' });
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    // resolve → server now connected
    await act(async () => {
      resolveRefresh([makeServer('fail-srv', 'connected')]);
    });

    // Testing 按鈕消失（因為 server 已 connected，不再顯示 Test Connection）
    await waitFor(() => {
      expect(screen.queryByText('Checking all servers...')).toBeNull();
      expect(screen.queryByText('Test Connection')).toBeNull();
    });
  });

  it('Test Connection 進行中 → 其他 failed server 的 Test Connection 按鈕也 disabled', async () => {
    let resolveRefresh!: (data: McpServer[]) => void;

    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') {
        return [
          makeServer('fail-a', 'failed'),
          makeServer('fail-b', 'failed'),
        ];
      }
      if (req.type === 'mcp.refreshStatus') {
        return new Promise<McpServer[]>((resolve) => { resolveRefresh = resolve; });
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('fail-a')).toBeTruthy();
      expect(screen.getByText('fail-b')).toBeTruthy();
    });

    // 兩個 Test Connection 按鈕都可點
    const buttons = screen.getAllByRole('button', { name: 'Test Connection' });
    expect(buttons).toHaveLength(2);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);

    // 點擊 fail-a 的 Test Connection
    const cardA = screen.getByText('fail-a').closest('.card') as HTMLElement;
    await act(async () => {
      fireEvent.click(within(cardA).getByText('Test Connection'));
    });

    // fail-a 顯示 "Checking all servers..."，fail-b 的 Test Connection disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Checking all servers...' })).toBeTruthy();
      const cardB = screen.getByText('fail-b').closest('.card') as HTMLElement;
      const btnB = within(cardB).getByRole('button', { name: 'Test Connection' });
      expect((btnB as HTMLButtonElement).disabled).toBe(true);
    });

    // resolve → 恢復
    await act(async () => {
      resolveRefresh([makeServer('fail-a', 'connected'), makeServer('fail-b', 'failed')]);
    });

    // fail-b 的 Test Connection 恢復可用
    await waitFor(() => {
      const cardB = screen.getByText('fail-b').closest('.card') as HTMLElement;
      const btnB = within(cardB).getByRole('button', { name: 'Test Connection' });
      expect((btnB as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('Test Connection 失敗 → card 內顯示 per-card error', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [makeServer('fail-srv', 'failed')];
      if (req.type === 'mcp.refreshStatus') {
        // 仍然 failed
        return [makeServer('fail-srv', 'failed')];
      }
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('fail-srv')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'));
    });

    // per-card error 顯示
    await waitFor(() => {
      expect(screen.getByText(/Test failed.*Connection failed/)).toBeTruthy();
    });

    // Test Connection 按鈕恢復可用
    const btn = screen.getByRole('button', { name: 'Test Connection' });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('Test Connection 異常 → card 內顯示 error message', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'mcp.list') return [makeServer('fail-srv', 'failed')];
      if (req.type === 'mcp.refreshStatus') throw new Error('CLI timeout');
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('fail-srv')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Test failed.*CLI timeout/)).toBeTruthy();
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
