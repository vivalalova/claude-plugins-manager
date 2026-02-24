/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/* ── Mock sendRequest ── */
const mockSendRequest = vi.fn();
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
}));

import { PluginCard, buildPluginGithubUrl } from '../PluginCard';
import type { MergedPlugin, PluginScope } from '../../../../shared/types';

function createPlugin(overrides: Partial<MergedPlugin> = {}): MergedPlugin {
  return {
    id: 'test-plugin@test-mp',
    name: 'test-plugin',
    marketplaceName: 'test-mp',
    description: 'A test plugin',
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
    ...overrides,
  };
}

describe('buildPluginGithubUrl', () => {
  it.each([
    {
      label: 'https URL + sourceDir → 完整 GitHub path',
      url: 'https://github.com/anthropics/claude-plugins-official.git',
      sourceDir: './plugins/agent-sdk-dev',
      expected: 'https://github.com/anthropics/claude-plugins-official/tree/main/plugins/agent-sdk-dev',
    },
    {
      label: 'https URL 無 .git + sourceDir',
      url: 'https://github.com/anthropics/skills',
      sourceDir: './my-skill',
      expected: 'https://github.com/anthropics/skills/tree/main/my-skill',
    },
    {
      label: 'GitHub shorthand owner/repo + sourceDir',
      url: 'vivalalova/agent-ide',
      sourceDir: './tools/lsp',
      expected: 'https://github.com/vivalalova/agent-ide/tree/main/tools/lsp',
    },
    {
      label: 'sourceDir 為 "." → 只回傳 repo URL',
      url: 'https://github.com/example/repo.git',
      sourceDir: '.',
      expected: 'https://github.com/example/repo',
    },
    {
      label: 'sourceDir 為 "./" → 只回傳 repo URL',
      url: 'https://github.com/example/repo.git',
      sourceDir: './',
      expected: 'https://github.com/example/repo',
    },
    {
      label: 'sourceDir undefined → 只回傳 repo URL',
      url: 'https://github.com/example/repo.git',
      sourceDir: undefined,
      expected: 'https://github.com/example/repo',
    },
  ])('$label', ({ url, sourceDir, expected }) => {
    expect(buildPluginGithubUrl(url, sourceDir)).toBe(expected);
  });

  it.each([
    { label: 'marketplaceUrl undefined', url: undefined, sourceDir: './foo' },
    { label: '本機路徑', url: '/Users/lova/.claude/plugins-local', sourceDir: './bar' },
    { label: '純名稱（無斜線）', url: 'some-marketplace', sourceDir: './baz' },
  ])('$label → null', ({ url, sourceDir }) => {
    expect(buildPluginGithubUrl(url, sourceDir)).toBeNull();
  });
});

describe('PluginCard', () => {
  const onToggle = vi.fn();
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('有 marketplaceUrl + sourceDir → 顯示 GitHub 按鈕', () => {
    const plugin = createPlugin({ sourceDir: './plugins/my-plugin' });

    renderWithI18n(
      <PluginCard
        plugin={plugin}
        marketplaceUrl="https://github.com/example/repo.git"
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText('GitHub')).toBeTruthy();
  });

  it('GitHub 按鈕點擊 → sendRequest openExternal 帶正確 URL', () => {
    const plugin = createPlugin({ sourceDir: './plugins/my-plugin' });

    renderWithI18n(
      <PluginCard
        plugin={plugin}
        marketplaceUrl="https://github.com/example/repo.git"
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText('GitHub'));

    expect(mockSendRequest).toHaveBeenCalledWith({
      type: 'openExternal',
      url: 'https://github.com/example/repo/tree/main/plugins/my-plugin',
    });
  });

  it('無 marketplaceUrl → 不顯示 GitHub 按鈕', () => {
    const plugin = createPlugin();

    renderWithI18n(
      <PluginCard
        plugin={plugin}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.queryByText('GitHub')).toBeNull();
  });

  it('本機路徑 marketplaceUrl → 不顯示 GitHub 按鈕', () => {
    const plugin = createPlugin({ sourceDir: './foo' });

    renderWithI18n(
      <PluginCard
        plugin={plugin}
        marketplaceUrl="/Users/lova/.claude/plugins-local"
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.queryByText('GitHub')).toBeNull();
  });

  it('loadingScopes 包含 user → User checkbox 替換為 spinner', () => {
    const plugin = createPlugin();
    const { container } = renderWithI18n(
      <PluginCard
        plugin={plugin}
        loadingScopes={new Set<PluginScope>(['user'])}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    // User scope 應有 spinner，無 checkbox
    const userLabel = container.querySelector('.scope-chip-toggle');
    expect(userLabel?.querySelector('.scope-spinner')).toBeTruthy();
    expect(userLabel?.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('loadingScopes 有值時 → 所有 scope checkbox disabled', () => {
    const plugin = createPlugin({
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    });
    renderWithI18n(
      <PluginCard
        plugin={plugin}
        workspaceName="my-project"
        loadingScopes={new Set<PluginScope>(['project'])}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    // User 和 Local checkboxes 應 disabled（project 是 spinner）
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      expect((cb as HTMLInputElement).disabled).toBe(true);
    }
  });

  it('loadingScopes 為空/undefined → checkbox 正常互動', () => {
    const plugin = createPlugin();
    renderWithI18n(
      <PluginCard
        plugin={plugin}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('test-plugin@test-mp', 'user', true);
  });

  it('已安裝但無 update → 不顯示 Update 按鈕，顯示 GitHub', () => {
    const plugin = createPlugin({
      sourceDir: './plugins/my-plugin',
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path/to/plugin',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    });

    renderWithI18n(
      <PluginCard
        plugin={plugin}
        marketplaceUrl="https://github.com/example/repo.git"
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.queryByText('Update')).toBeNull();
    expect(screen.queryByText('Update available')).toBeNull();
    expect(screen.getByText('GitHub')).toBeTruthy();
  });

  it('availableLastUpdated > installed lastUpdated → 顯示 Update available badge', () => {
    const plugin = createPlugin({
      availableLastUpdated: '2026-02-20T00:00:00Z',
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    });

    renderWithI18n(
      <PluginCard plugin={plugin} onToggle={onToggle} onUpdate={onUpdate} />,
    );

    expect(screen.getByText('Update available')).toBeTruthy();
  });

  it('無 availableLastUpdated → 不顯示 badge', () => {
    const plugin = createPlugin({
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    });

    renderWithI18n(
      <PluginCard plugin={plugin} onToggle={onToggle} onUpdate={onUpdate} />,
    );

    expect(screen.queryByText('Update available')).toBeNull();
  });

  it('available <= installed → 不顯示 badge', () => {
    const plugin = createPlugin({
      availableLastUpdated: '2026-01-01T00:00:00Z',
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-02-20T00:00:00Z',
      },
    });

    renderWithI18n(
      <PluginCard plugin={plugin} onToggle={onToggle} onUpdate={onUpdate} />,
    );

    expect(screen.queryByText('Update available')).toBeNull();
  });

  it('badge click → 觸發 onUpdate', () => {
    const plugin = createPlugin({
      availableLastUpdated: '2026-02-20T00:00:00Z',
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    });

    renderWithI18n(
      <PluginCard plugin={plugin} onToggle={onToggle} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByText('Update available'));
    expect(onUpdate).toHaveBeenCalledWith('test-plugin@test-mp', ['user']);
  });

  it('badge loading 時顯示 spinner 取代文字', () => {
    const plugin = createPlugin({
      availableLastUpdated: '2026-02-20T00:00:00Z',
      userInstall: {
        id: 'test-plugin@test-mp',
        version: '1.0.0',
        scope: 'user' as PluginScope,
        enabled: true,
        installPath: '/path',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    });

    const { container } = renderWithI18n(
      <PluginCard
        plugin={plugin}
        loadingScopes={new Set<PluginScope>(['user'])}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    // badge 存在但顯示 spinner 而非文字
    expect(screen.queryByText('Update available')).toBeNull();
    expect(container.querySelector('.badge-update .scope-spinner')).toBeTruthy();
  });

  it('lastUpdated 從 plugin.lastUpdated 讀取（預計算，無 installs 也能顯示）', () => {
    // plugin.lastUpdated 預計算後，無 install 記錄也應顯示
    const plugin = createPlugin({
      lastUpdated: '2026-02-20T00:00:00Z',
      userInstall: null,
      projectInstalls: [],
      localInstall: null,
    });

    renderWithI18n(<PluginCard plugin={plugin} onToggle={onToggle} onUpdate={onUpdate} />);

    // 應顯示預計算的 lastUpdated（非 inline 計算）
    expect(screen.getByText(/Updated:/)).toBeTruthy();
  });

  describe('Resource conflict badge', () => {
    it('有 conflicts → 顯示衝突數量 badge', () => {
      const plugin = createPlugin({
        contents: {
          commands: [],
          skills: [],
          agents: [],
          mcpServers: ['shared-srv'],
          hooks: false,
        },
      });

      renderWithI18n(
        <PluginCard
          plugin={plugin}
          conflicts={[{ type: 'mcp', name: 'shared-srv', pluginIds: ['test-plugin@test-mp', 'other@mp'] }]}
          onToggle={onToggle}
          onUpdate={onUpdate}
        />,
      );

      expect(screen.getByText(/1 conflict/)).toBeTruthy();
    });

    it('無 conflicts → 不顯示 badge', () => {
      const plugin = createPlugin();

      renderWithI18n(
        <PluginCard
          plugin={plugin}
          conflicts={[]}
          onToggle={onToggle}
          onUpdate={onUpdate}
        />,
      );

      expect(screen.queryByText(/conflict/)).toBeNull();
    });

    it('conflicts undefined → 不顯示 badge', () => {
      const plugin = createPlugin();

      renderWithI18n(
        <PluginCard
          plugin={plugin}
          onToggle={onToggle}
          onUpdate={onUpdate}
        />,
      );

      expect(screen.queryByText(/conflict/)).toBeNull();
    });

    it('有 conflicts 時展開可見衝突詳情', () => {
      const plugin = createPlugin({
        contents: {
          commands: [],
          skills: [],
          agents: [],
          mcpServers: ['shared-srv'],
          hooks: false,
        },
      });

      const { container } = renderWithI18n(
        <PluginCard
          plugin={plugin}
          conflicts={[{ type: 'mcp', name: 'shared-srv', pluginIds: ['test-plugin@test-mp', 'other@mp'] }]}
          onToggle={onToggle}
          onUpdate={onUpdate}
        />,
      );

      // 預設收合 → 展開
      fireEvent.click(container.querySelector('.card')!);

      expect(screen.getByText('Conflicts')).toBeTruthy();
      expect(screen.getByText(/MCP Server: shared-srv/)).toBeTruthy();
      expect(screen.getByText(/also in other/)).toBeTruthy();
    });

    it('多個 conflicts → 顯示正確數量', () => {
      const plugin = createPlugin({
        contents: {
          commands: [{ name: 'deploy', description: '' }],
          skills: [],
          agents: [],
          mcpServers: ['srv'],
          hooks: false,
        },
      });

      renderWithI18n(
        <PluginCard
          plugin={plugin}
          conflicts={[
            { type: 'mcp', name: 'srv', pluginIds: ['test-plugin@test-mp', 'a@mp'] },
            { type: 'command', name: 'deploy', pluginIds: ['test-plugin@test-mp', 'b@mp'] },
          ]}
          onToggle={onToggle}
          onUpdate={onUpdate}
        />,
      );

      expect(screen.getByText(/2 conflict/)).toBeTruthy();
    });
  });
});
