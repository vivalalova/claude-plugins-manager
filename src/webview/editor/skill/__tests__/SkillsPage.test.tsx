/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
}));

import { SkillsPage } from '../SkillsPage';
import { ToastProvider } from '../../../components/Toast';
import type { AgentSkill, RegistrySkill, SkillSearchResult } from '../../../../shared/types';

const renderPage = () => renderWithI18n(<ToastProvider><SkillsPage /></ToastProvider>);

function makeSkill(name: string, scope: AgentSkill['scope'] = 'global', desc?: string): AgentSkill {
  return {
    name,
    path: `/mock/.claude/skills/${name}`,
    scope,
    agents: ['Claude Code'],
    description: desc,
  };
}

describe('SkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loading 狀態 → skeleton 顯示', () => {
    mockSendRequest.mockImplementation(() => new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('空狀態 → empty state 顯示', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') return [];
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No skills installed')).toBeTruthy();
    });
  });

  it('有 skills → SkillCard 正確渲染（name、scope badge、agents）', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') {
        return [
          makeSkill('test-skill', 'global', 'A test skill'),
          makeSkill('project-skill', 'project', 'Project skill'),
        ];
      }
      if (req.type === 'workspace.getFolders') return [{ name: 'ws' }];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('test-skill')).toBeTruthy();
      expect(screen.getByText('project-skill')).toBeTruthy();
    });

    // description 顯示
    expect(screen.getByText('A test skill')).toBeTruthy();
    expect(screen.getByText('Project skill')).toBeTruthy();

    // scope badges
    expect(screen.getByText('global')).toBeTruthy();
    expect(screen.getByText('project')).toBeTruthy();

    // agents tags
    const agentTags = screen.getAllByText('Claude Code');
    expect(agentTags.length).toBe(2);

    // sections
    expect(screen.getByText(/Global Skills/)).toBeTruthy();
    expect(screen.getByText(/Project Skills/)).toBeTruthy();
  });

  it('search 過濾 → 依 name 過濾', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') {
        return [
          makeSkill('find-skills', 'global'),
          makeSkill('browser-tool', 'global'),
        ];
      }
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('find-skills')).toBeTruthy();
      expect(screen.getByText('browser-tool')).toBeTruthy();
    });

    // 搜尋 "find"
    const searchInput = screen.getByPlaceholderText('Search skills...');
    fireEvent.change(searchInput, { target: { value: 'find' } });

    expect(screen.getByText('find-skills')).toBeTruthy();
    expect(screen.queryByText('browser-tool')).toBeNull();
  });

  it('Add Skill dialog → 正確送出 skill.add message', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') return [];
      if (req.type === 'workspace.getFolders') return [{ name: 'ws' }];
      if (req.type === 'skill.add') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No skills installed')).toBeTruthy();
    });

    // 點擊 Add Skill 按鈕（page header 的）
    const addButtons = screen.getAllByText('Add Skill');
    fireEvent.click(addButtons[0]);

    // dialog 出現
    await waitFor(() => {
      expect(screen.getByText('Source')).toBeTruthy();
    });

    // 輸入 source
    const sourceInput = screen.getByPlaceholderText('owner/repo or GitHub URL');
    fireEvent.change(sourceInput, { target: { value: 'vercel-labs/skills' } });

    // 提交
    const confirmBtn = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'skill.add', source: 'vercel-labs/skills', scope: 'global' }),
        90_000,
      );
    });
  });

  it('Remove 按鈕 → confirm dialog → skill.remove message', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'skill.remove') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('my-skill')).toBeTruthy();
    });

    // 點擊 Remove
    fireEvent.click(screen.getByText('Remove'));

    // confirm dialog 出現
    await waitFor(() => {
      expect(screen.getByText(/Remove "my-skill"/)).toBeTruthy();
    });

    // 確認
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'skill.remove', name: 'my-skill', scope: 'global' }),
      );
    });
  });

  it('skill.refresh push → 觸發 re-fetch', async () => {
    let pushHandler: ((msg: { type: string }) => void) | null = null;
    mockOnPushMessage.mockImplementation((handler: (msg: { type: string }) => void) => {
      pushHandler = handler;
      return () => {};
    });

    let callCount = 0;
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') {
        callCount++;
        return callCount === 1 ? [] : [makeSkill('new-skill', 'global')];
      }
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No skills installed')).toBeTruthy();
    });

    // 觸發 push
    pushHandler?.({ type: 'skill.refresh' });

    await waitFor(() => {
      expect(screen.getByText('new-skill')).toBeTruthy();
    });
  });

  it('fetch 失敗 → 顯示 error banner', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') throw new Error('Network error');
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Online search
  // -------------------------------------------------------------------------

  describe('Online 搜尋模式', () => {
    const mockSearchResults: SkillSearchResult[] = [
      { fullId: 'owner/repo@test-skill', name: 'test-skill', repo: 'owner/repo', installs: '7.7K', url: 'https://skills.sh/owner/repo/test-skill' },
      { fullId: 'vercel/skills@find', name: 'find', repo: 'vercel/skills', installs: '618.0K', url: 'https://skills.sh/vercel/skills/find' },
    ];

    function setupOnlineMocks(): void {
      mockSendRequest.mockImplementation(async (req: { type: string; query?: string }) => {
        if (req.type === 'skill.list') return [];
        if (req.type === 'workspace.getFolders') return [{ name: 'ws' }];
        if (req.type === 'skill.find') return mockSearchResults;
        if (req.type === 'skill.add') return undefined;
        if (req.type === 'openExternal') return undefined;
        return undefined;
      });
    }

    it('搜尋模式切換 → Online chip 可點擊', async () => {
      setupOnlineMocks();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Installed')).toBeTruthy();
        expect(screen.getByText('Online')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Online'));

      // Online 模式下不顯示 scope filter 和 Add 按鈕
      expect(screen.queryByText('Add Skill')).toBeNull();
    });

    it('Online 模式 + 輸入 < 2 字元 → 顯示提示', async () => {
      setupOnlineMocks();
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Online'));

      // 輸入 1 字
      const input = screen.getByPlaceholderText('Search skills online...');
      fireEvent.change(input, { target: { value: 'a' } });

      expect(screen.getByText('Enter at least 2 characters')).toBeTruthy();
    });

    it('Online 模式 + 搜尋結果渲染正確', async () => {
      setupOnlineMocks();
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Online'));

      const input = screen.getByPlaceholderText('Search skills online...');
      fireEvent.change(input, { target: { value: 'test' } });

      // 等待 debounce(500ms) + API resolve
      await waitFor(() => {
        expect(screen.getByText('test-skill')).toBeTruthy();
        expect(screen.getByText('find')).toBeTruthy();
      }, { timeout: 3000 });

      expect(screen.getByText('owner/repo')).toBeTruthy();
      expect(screen.getByText('vercel/skills')).toBeTruthy();
      expect(screen.getByText('7.7K installs')).toBeTruthy();
    });

    it('Install 按鈕 → scope picker → skill.add', async () => {
      setupOnlineMocks();
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Online'));

      const input = screen.getByPlaceholderText('Search skills online...');
      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => expect(screen.getByText('test-skill')).toBeTruthy(), { timeout: 3000 });

      // 點 Install → scope picker
      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      await waitFor(() => expect(screen.getByText('Global')).toBeTruthy());
      fireEvent.click(screen.getByText('Global'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'skill.add', source: 'owner/repo@test-skill', scope: 'global' }),
          90_000,
        );
      });
    });

    it('Online 空結果 → empty state', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.find') return [];
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Online'));

      const input = screen.getByPlaceholderText('Search skills online...');
      fireEvent.change(input, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText(/No skills found for/)).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('模式切換清除搜尋', async () => {
      setupOnlineMocks();
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());

      const input = screen.getByPlaceholderText('Search skills...');
      fireEvent.change(input, { target: { value: 'some text' } });

      fireEvent.click(screen.getByText('Online'));

      const onlineInput = screen.getByPlaceholderText('Search skills online...');
      expect((onlineInput as HTMLInputElement).value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Registry
  // -------------------------------------------------------------------------

  describe('Registry 排行榜', () => {
    const mockRegistryResults: RegistrySkill[] = [
      { rank: 1, name: 'find-skills', repo: 'vercel-labs/skills', installs: '618.0K', url: 'https://skills.sh/vercel-labs/skills/find-skills' },
      { rank: 2, name: 'test-skill', repo: 'owner/repo', installs: '7.7K', url: 'https://skills.sh/owner/repo/test-skill' },
    ];

    function setupRegistryMocks(installed: AgentSkill[] = []): void {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return installed;
        if (req.type === 'workspace.getFolders') return [{ name: 'ws' }];
        if (req.type === 'skill.registry') return mockRegistryResults;
        if (req.type === 'skill.add') return undefined;
        if (req.type === 'openExternal') return undefined;
        return undefined;
      });
    }

    it('Registry tab → 顯示 sort tabs + 載入排行榜', async () => {
      setupRegistryMocks();
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Registry'));

      await waitFor(() => {
        expect(screen.getByText('find-skills')).toBeTruthy();
        expect(screen.getByText('test-skill')).toBeTruthy();
      }, { timeout: 3000 });

      // Sort tabs 顯示
      expect(screen.getByText('All Time')).toBeTruthy();
      expect(screen.getByText('Trending')).toBeTruthy();
      expect(screen.getByText('Hot')).toBeTruthy();

      // Rank + installs
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
      expect(screen.getByText('618.0K installs')).toBeTruthy();
    });

    it('Sort tab 切換 → 重新 fetch', async () => {
      setupRegistryMocks();
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Registry'));

      await waitFor(() => expect(screen.getByText('find-skills')).toBeTruthy(), { timeout: 3000 });

      // 切到 Trending
      fireEvent.click(screen.getByText('Trending'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'skill.registry', sort: 'trending' }),
        );
      });
    });

    it('已安裝 skill → 顯示 Installed badge', async () => {
      setupRegistryMocks([makeSkill('find-skills', 'global')]);
      renderPage();

      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Registry'));

      await waitFor(() => expect(screen.getByText('find-skills')).toBeTruthy(), { timeout: 3000 });

      // find-skills 已安裝 → 顯示 "Installed" badge（注意有多個 "Installed" 文字）
      const installedBadges = screen.getAllByText('Installed');
      // 至少 2 個：tab chip + badge
      expect(installedBadges.length).toBeGreaterThanOrEqual(2);
    });

    it('Registry error → 顯示 error banner', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.registry') throw new Error('skills.sh unavailable');
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('Installed')).toBeTruthy());
      fireEvent.click(screen.getByText('Registry'));

      await waitFor(() => {
        expect(screen.getByText('skills.sh unavailable')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  // -------------------------------------------------------------------------
  // Check Updates + Update All
  // -------------------------------------------------------------------------

  describe('Check Updates + Update All', () => {
    it('Check Updates → up to date → toast', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.check') return 'No skills tracked in lock file.';
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      fireEvent.click(screen.getByText('Check Updates'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'skill.check' }),
        );
      });
    });

    it('Check Updates → has updates → Update All 按鈕出現', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.check') return 'Updates available for 2 skills';
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      fireEvent.click(screen.getByText('Check Updates'));

      await waitFor(() => {
        expect(screen.getByText('Update All')).toBeTruthy();
      });
    });

    it('Update All → 呼叫 skill.update → 完成後刷新', async () => {
      let checkCalled = false;
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.check') { checkCalled = true; return 'Updates available'; }
        if (req.type === 'skill.update') return undefined;
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      // 先 check
      fireEvent.click(screen.getByText('Check Updates'));
      await waitFor(() => expect(checkCalled).toBe(true));
      await waitFor(() => expect(screen.getByText('Update All')).toBeTruthy());

      // 再 update
      fireEvent.click(screen.getByText('Update All'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'skill.update' }),
          90_000,
        );
      });
    });

    it('Check Updates 失敗 → error toast', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.check') throw new Error('CLI not found');
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      fireEvent.click(screen.getByText('Check Updates'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'skill.check' }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Skill Detail Panel
  // -------------------------------------------------------------------------

  describe('Skill Detail Panel', () => {
    it('View 按鈕 → detail panel 顯示 frontmatter + body', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global', 'A great skill')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.getDetail') return {
          frontmatter: { name: 'my-skill', description: 'A great skill', model: 'sonnet' },
          body: '# My Skill\n\nThis is the body.',
        };
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      // 點擊 View
      fireEvent.click(screen.getByText('View'));

      await waitFor(() => {
        expect(screen.getByText('Configuration')).toBeTruthy();
        expect(screen.getByText('Content')).toBeTruthy();
      });

      // frontmatter 欄位
      expect(screen.getByText('sonnet')).toBeTruthy();

      // body 內容
      expect(screen.getByText(/# My Skill/)).toBeTruthy();
    });

    it('Open in Editor → 呼叫 skill.openFile', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.getDetail') return { frontmatter: {}, body: 'test' };
        if (req.type === 'skill.openFile') return undefined;
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      fireEvent.click(screen.getByText('View'));
      await waitFor(() => expect(screen.getByText('Open in Editor')).toBeTruthy());

      fireEvent.click(screen.getByText('Open in Editor'));

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'skill.openFile', path: '/mock/.claude/skills/my-skill/SKILL.md' }),
        );
      });
    });

    it('Close 按鈕 → detail panel 關閉', async () => {
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
        if (req.type === 'workspace.getFolders') return [];
        if (req.type === 'skill.getDetail') return { frontmatter: {}, body: 'test' };
        return undefined;
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('my-skill')).toBeTruthy());

      fireEvent.click(screen.getByText('View'));
      await waitFor(() => expect(screen.getByText('Close')).toBeTruthy());

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByText('Configuration')).toBeNull();
      });
    });
  });
});
