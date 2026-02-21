/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage, mockViewState } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
  mockViewState: {} as Record<string, unknown>,
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  getViewState: (key: string, fallback: unknown) => key in mockViewState ? mockViewState[key] : fallback,
  setViewState: (key: string, value: unknown) => { mockViewState[key] = value; },
}));

import { PluginPage } from '../PluginPage';
import { ToastProvider } from '../../../components/Toast';
import type {
  InstalledPlugin,
  AvailablePlugin,
  PluginListResponse,
} from '../../../../shared/types';

const renderPage = () => render(<ToastProvider><PluginPage /></ToastProvider>);

function makeInstalled(name: string, mp: string, enabled: boolean): InstalledPlugin {
  return {
    id: `${name}@${mp}`,
    version: '1.0.0',
    scope: 'user',
    enabled,
    installPath: `/plugins/${name}`,
    installedAt: '2026-01-01',
    lastUpdated: '2026-01-01',
  };
}

function makeAvailable(name: string, mp: string, desc = ''): AvailablePlugin {
  return { pluginId: `${name}@${mp}`, name, description: desc, marketplaceName: mp };
}

function makeResponse(
  installed: InstalledPlugin[],
  available: AvailablePlugin[],
  marketplaceSources: Record<string, string> = {},
): PluginListResponse {
  return { installed, available, marketplaceSources };
}

describe('PluginPage — 核心流程', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
  });

  afterEach(() => {
    cleanup();
  });

  describe('載入狀態', () => {
    it('載入中顯示 skeleton 卡片', async () => {
      // plugin.listAvailable 永不 resolve → 保持 loading 狀態
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        // 不回傳 plugin.listAvailable → loading 持續
        return new Promise(() => {});
      });

      const { container } = renderPage();

      expect(container.querySelectorAll('.skeleton-card').length).toBe(3);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('載入完成顯示 plugin 卡片，按 marketplace 分 section', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [],
            [
              makeAvailable('alpha', 'mp1', 'Alpha plugin'),
              makeAvailable('beta', 'mp1', 'Beta plugin'),
              makeAvailable('gamma', 'mp2', 'Gamma plugin'),
            ],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // mp1 與 mp2 的 section header 皆存在
      expect(screen.getByText('mp1')).toBeTruthy();
      expect(screen.getByText('mp2')).toBeTruthy();

      // plugin 名稱要在 DOM 中
      expect(screen.getByText('alpha')).toBeTruthy();
      expect(screen.getByText('beta')).toBeTruthy();
      expect(screen.getByText('gamma')).toBeTruthy();
    });

    it('載入失敗顯示 ErrorBanner', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') throw new Error('network timeout');
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('network timeout')).toBeTruthy();
      });
    });

    it('空 plugin 列表顯示 EmptyState + "Go to Marketplace" 按鈕觸發導航', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], []);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No plugins found')).toBeTruthy();
      });

      expect(screen.getByText('Add a marketplace first to discover and install plugins.')).toBeTruthy();

      // 監聽 window.postMessage
      const postMessageSpy = vi.spyOn(window, 'postMessage');
      fireEvent.click(screen.getByRole('button', { name: 'Go to Marketplace' }));
      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: 'navigate', category: 'marketplace' },
        '*',
      );
      postMessageSpy.mockRestore();
    });

    it('filter 無符合 → EmptyState + "Clear filters" 重置所有過濾', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('alpha')).toBeTruthy();
      });

      // 搜尋一個不存在的東西
      const searchInput = screen.getByRole('textbox', { name: 'Search plugins' });
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });

      await waitFor(() => {
        expect(screen.getByText('No plugins match the current filters.')).toBeTruthy();
      }, { timeout: 1000 });

      // 有 Clear filters 按鈕
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      // 清除後 alpha 回來
      expect(screen.getByText('alpha')).toBeTruthy();
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('Section 展開/收合', () => {
    it('預設 sections 收合，section-body 有 collapsed class', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // section-body 預設有 section-body--collapsed class
      const sectionBody = document.querySelector('.section-body');
      expect(sectionBody?.classList.contains('section-body--collapsed')).toBe(true);
    });

    it('點擊 section header → 展開，移除 collapsed class', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // 點擊 section toggle 按鈕展開
      fireEvent.click(screen.getByText('mp1'));

      const sectionBody = document.querySelector('.section-body');
      expect(sectionBody?.classList.contains('section-body--collapsed')).toBe(false);
    });
  });

  describe('搜尋過濾', () => {
    it('輸入關鍵字 → 只顯示匹配的 plugin', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [],
            [
              makeAvailable('hello-world', 'mp1', 'greeting plugin'),
              makeAvailable('farewell', 'mp1', 'goodbye plugin'),
            ],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      const searchInput = screen.getByRole('textbox', { name: 'Search plugins' });
      fireEvent.change(searchInput, { target: { value: 'hello' } });

      // debounce 300ms 後過濾生效
      await waitFor(() => {
        expect(screen.getByText('hello-world')).toBeTruthy();
        expect(screen.queryByText('farewell')).toBeNull();
      }, { timeout: 1000 });
    });

    it('搜尋有結果時 section 自動展開（無 collapsed class）', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('foo-plugin', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      const searchInput = screen.getByRole('textbox', { name: 'Search plugins' });
      fireEvent.change(searchInput, { target: { value: 'foo' } });

      await waitFor(() => {
        const sectionBody = document.querySelector('.section-body');
        expect(sectionBody?.classList.contains('section-body--collapsed')).toBe(false);
      }, { timeout: 1000 });
    });

    it('無符合結果顯示 "No plugins match the current filters."', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      const searchInput = screen.getByRole('textbox', { name: 'Search plugins' });
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });

      await waitFor(() => {
        expect(screen.getByText('No plugins match the current filters.')).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('debounce：打字中不過濾，300ms 後才過濾', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [],
            [
              makeAvailable('hello-world', 'mp1', 'greeting plugin'),
              makeAvailable('farewell', 'mp1', 'goodbye plugin'),
            ],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // 切換到 fake timers（在 render 和初始資料載入完成後）
      vi.useFakeTimers();

      try {
        const searchInput = screen.getByRole('textbox', { name: 'Search plugins' });
        fireEvent.change(searchInput, { target: { value: 'hello' } });

        // 299ms 時結果尚未過濾，兩個 plugin 仍顯示
        act(() => {
          vi.advanceTimersByTime(299);
        });

        expect(screen.getByText('farewell')).toBeTruthy();

        // 再推進 1ms，debounce 觸發
        act(() => {
          vi.advanceTimersByTime(1);
        });

        expect(screen.queryByText('farewell')).toBeNull();
        expect(screen.getByText('hello-world')).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('clear 按鈕：search 有文字時顯示，點擊後立即清空', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [],
            [
              makeAvailable('hello-world', 'mp1', 'greeting plugin'),
              makeAvailable('farewell', 'mp1', 'goodbye plugin'),
            ],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // 初始無 clear 按鈕
      expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

      const searchInput = screen.getByRole('textbox', { name: 'Search plugins' });
      fireEvent.change(searchInput, { target: { value: 'hello' } });

      // 輸入後 clear 按鈕出現
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy();

      // 等 debounce 觸發 → 只顯示 hello-world
      await waitFor(() => {
        expect(screen.queryByText('farewell')).toBeNull();
      }, { timeout: 1000 });

      // 點擊 clear 按鈕
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

      // search input 立即清空（不用等 debounce）
      expect((searchInput as HTMLInputElement).value).toBe('');

      // clear 按鈕消失
      expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

      // flush 立即生效：兩個 plugin 都**同步**回來（不用 waitFor）
      expect(screen.getByText('hello-world')).toBeTruthy();
      expect(screen.getByText('farewell')).toBeTruthy();
    });
  });

  describe('Enabled filter', () => {
    it('勾選 Enabled filter 後只顯示已啟用的 plugin', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [
              makeInstalled('enabled-plugin', 'mp1', true),
              makeInstalled('disabled-plugin', 'mp1', false),
            ],
            [
              makeAvailable('enabled-plugin', 'mp1'),
              makeAvailable('disabled-plugin', 'mp1'),
            ],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      fireEvent.click(screen.getByText('Enabled'));

      await waitFor(() => {
        expect(screen.getByText('enabled-plugin')).toBeTruthy();
        expect(screen.queryByText('disabled-plugin')).toBeNull();
      });
    });

    it('Enabled filter 啟用時 section 自動展開', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [makeInstalled('my-plugin', 'mp1', true)],
            [makeAvailable('my-plugin', 'mp1')],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // section 預設收合
      expect(document.querySelector('.section-body--collapsed')).toBeTruthy();

      fireEvent.click(screen.getByText('Enabled'));

      await waitFor(() => {
        // filter 啟用後 section 自動展開
        expect(document.querySelector('.section-body--collapsed')).toBeNull();
      });
    });
  });

  describe('Toggle install：單次 sendRequest', () => {
    it('已安裝但 disabled 的 plugin → 勾選只發 plugin.enable（不重新 install）', async () => {
      const allRequests: { type: string }[] = [];

      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        allRequests.push(req);
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [makeInstalled('alpha', 'mp1', false)], // installed but disabled
            [makeAvailable('alpha', 'mp1')],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      allRequests.length = 0;

      // installed-but-disabled → checkbox unchecked
      const userCheckbox = screen.getByRole('checkbox', { name: 'User' });
      expect((userCheckbox as HTMLInputElement).checked).toBe(false);
      fireEvent.click(userCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/Enabled alpha@mp1/)).toBeTruthy();
      });

      const types = allRequests.map((r) => r.type);
      expect(types).toContain('plugin.enable');
      expect(types).not.toContain('plugin.install');
      expect(types).not.toContain('plugin.update');
    });

    it('勾選未安裝的 plugin → 只發一次 plugin.install（不發 update + enable）', async () => {
      const allRequests: { type: string }[] = [];

      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        allRequests.push(req);
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // Reset：追蹤 toggle 後的請求
      allRequests.length = 0;

      // 勾選 User scope toggle
      const userCheckbox = screen.getByRole('checkbox', { name: 'User' });
      fireEvent.click(userCheckbox);

      // 等待操作完成（toast 出現）
      await waitFor(() => {
        expect(screen.getByText(/Enabled alpha@mp1/)).toBeTruthy();
      });

      const types = allRequests.map((r) => r.type);
      expect(types.filter((t) => t === 'plugin.install')).toHaveLength(1);
      expect(types).not.toContain('plugin.update');
      expect(types).not.toContain('plugin.enable');
    });
  });

  describe('Sort toggle', () => {
    it('預設排序為 Name，Name chip 有 active class', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      const nameBtn = screen.getByRole('button', { name: 'Name' });
      const lastUpdatedBtn = screen.getByRole('button', { name: 'Last Updated' });
      expect(nameBtn.classList.contains('filter-chip--active')).toBe(true);
      expect(lastUpdatedBtn.classList.contains('filter-chip--active')).toBe(false);
    });

    it('切換 Last Updated → 按日期降序排列，新的在前', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [],
            [
              { ...makeAvailable('alpha', 'mp1'), lastUpdated: '2026-01-01T00:00:00Z' },
              { ...makeAvailable('beta', 'mp1'), lastUpdated: '2026-02-20T00:00:00Z' },
            ],
          );
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // 展開 section 看順序
      fireEvent.click(screen.getByText('mp1'));

      // 預設 Name 排序：alpha 先 beta 後
      const cards = () => document.querySelectorAll('.card-name');
      expect(cards()[0]?.textContent).toBe('alpha');
      expect(cards()[1]?.textContent).toBe('beta');

      // 切換到 Last Updated
      fireEvent.click(screen.getByRole('button', { name: 'Last Updated' }));

      // beta (2026-02-20) 在 alpha (2026-01-01) 前面
      expect(cards()[0]?.textContent).toBe('beta');
      expect(cards()[1]?.textContent).toBe('alpha');
    });

    it('sort 持久化到 viewState', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Last Updated' }));

      expect(mockViewState['plugin.sort']).toBe('lastUpdated');
    });
  });

  describe('Retry UI', () => {
    it('Update All 部分失敗 → ErrorBanner 有 Retry 按鈕 → 點擊重試', async () => {
      let updateCallCount = 0;

      mockSendRequest.mockImplementation(async (req: { type: string; plugin?: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [makeInstalled('alpha', 'mp1', true)],
            [makeAvailable('alpha', 'mp1')],
          );
        }
        if (req.type === 'plugin.update') {
          updateCallCount++;
          if (updateCallCount === 1) throw new Error('update timeout');
          return undefined;
        }
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // 展開 section
      fireEvent.click(screen.getByText('mp1'));

      // Update All → 失敗
      await act(async () => {
        fireEvent.click(screen.getByText('Update All'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Update All:.*1 failed/)).toBeTruthy();
      });

      // Retry 按鈕存在
      const retryBtn = screen.getByRole('button', { name: 'Retry' });
      expect(retryBtn).toBeTruthy();

      // 點 Retry → 重試成功 → error 消失
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Update All:.*failed/)).toBeNull();
      });

      expect(updateCallCount).toBe(2);
    });

    it('install 失敗 → ErrorBanner 有 Retry → 重試', async () => {
      let installCallCount = 0;

      mockSendRequest.mockImplementation(async (req: { type: string; plugin?: string; scope?: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        if (req.type === 'plugin.install') {
          installCallCount++;
          if (installCallCount === 1) throw new Error('install failed');
          return undefined;
        }
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      // 展開 section
      fireEvent.click(screen.getByText('mp1'));

      // 勾選 User scope → install → 失敗
      const userCheckbox = screen.getByRole('checkbox', { name: 'User' });
      await act(async () => {
        fireEvent.click(userCheckbox);
      });

      await waitFor(() => {
        expect(screen.getByText('install failed')).toBeTruthy();
      });

      // Retry 按鈕存在
      const retryBtn = screen.getByRole('button', { name: 'Retry' });
      expect(retryBtn).toBeTruthy();

      // 點 Retry → 重試
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText('install failed')).toBeNull();
      });

      expect(installCallCount).toBe(2);
    });
  });

  describe('Export / Import', () => {
    it('Export 按鈕有安裝 plugin 時啟用，送出 plugin.export', async () => {
      const calls: { type: string }[] = [];
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        calls.push(req);
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [makeInstalled('alpha', 'mp1', true)],
            [makeAvailable('alpha', 'mp1')],
          );
        }
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      const exportBtn = screen.getByRole('button', { name: 'Export' });
      expect((exportBtn as HTMLButtonElement).disabled).toBe(false);

      await act(async () => {
        fireEvent.click(exportBtn);
      });

      expect(calls.some((c) => c.type === 'plugin.export')).toBe(true);
    });

    it('Export 按鈕沒有安裝 plugin 時 disabled', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      const exportBtn = screen.getByRole('button', { name: 'Export' });
      expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('Import 按鈕送出 plugin.import → 成功後顯示 toast', async () => {
      const calls: { type: string }[] = [];
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        calls.push(req);
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        if (req.type === 'plugin.import') {
          return ['Installed: alpha@mp1 (user)'];
        }
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Import' }));
      });

      expect(calls.some((c) => c.type === 'plugin.import')).toBe(true);

      // Toast 顯示
      await waitFor(() => {
        expect(screen.getByText(/Imported 1 plugin/)).toBeTruthy();
      });
    });

    it('Import 部分失敗 → 成功 toast + 失敗 ErrorBanner', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('alpha', 'mp1')]);
        }
        if (req.type === 'plugin.import') {
          return [
            'Installed: alpha@mp1 (user)',
            'Failed: bad@mp1 (user) — plugin not found',
          ];
        }
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Import' }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Imported 1 plugin/)).toBeTruthy();
      });
      await waitFor(() => {
        expect(screen.getByText(/Import: 1 failed/)).toBeTruthy();
      });
    });

    it('Export 失敗 → ErrorBanner 顯示', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse(
            [makeInstalled('alpha', 'mp1', true)],
            [makeAvailable('alpha', 'mp1')],
          );
        }
        if (req.type === 'plugin.export') throw new Error('No enabled plugins to export.');
        return undefined;
      });

      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('Loading plugins...')).toBeNull();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Export' }));
      });

      await waitFor(() => {
        expect(screen.getByText('No enabled plugins to export.')).toBeTruthy();
      });
    });
  });

  describe('plugin.refresh 推送', () => {
    it('收到 plugin.refresh 推送 → 靜默刷新，不顯示 Loading spinner', async () => {
      let pushCallback: ((msg: { type: string }) => void) | null = null;

      mockOnPushMessage.mockImplementation((cb: (msg: { type: string }) => void) => {
        pushCallback = cb;
        return () => {};
      });

      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [makeAvailable('initial-plugin', 'mp1')]);
        }
        return undefined;
      });

      renderPage();

      await waitFor(() => {
        expect(document.querySelectorAll('.skeleton-card').length).toBe(0);
      });

      // 更新 mock 回傳新資料
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'plugin.listAvailable') {
          return makeResponse([], [
            makeAvailable('initial-plugin', 'mp1'),
            makeAvailable('new-plugin', 'mp1'),
          ]);
        }
        return undefined;
      });

      // 觸發 push
      await act(async () => {
        pushCallback?.({ type: 'plugin.refresh' });
      });

      // 刷新後 skeleton 不出現（靜默刷新）
      expect(document.querySelectorAll('.skeleton-card').length).toBe(0);

      // 新 plugin 出現在畫面上
      await waitFor(() => {
        expect(screen.getByText('new-plugin')).toBeTruthy();
      });
    });
  });
});
