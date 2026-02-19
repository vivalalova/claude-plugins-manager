/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

    render(
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

    render(
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

    render(
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

    render(
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
    const { container } = render(
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
    render(
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
    render(
      <PluginCard
        plugin={plugin}
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('user', true);
  });

  it('已安裝 plugin → 同時顯示 Update 和 GitHub 按鈕', () => {
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

    render(
      <PluginCard
        plugin={plugin}
        marketplaceUrl="https://github.com/example/repo.git"
        onToggle={onToggle}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText('Update')).toBeTruthy();
    expect(screen.getByText('GitHub')).toBeTruthy();
  });
});
