/**
 * @vitest-environment jsdom
 *
 * Settings 同步（2026-10）新增 key：各 section 渲染出控制項、生效 scope 以外隱藏、
 * permissions 巢狀欄位寫入 permissions.<key>。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { PermissionsSection } from '../PermissionsSection';
import { AdvancedSection } from '../AdvancedSection';
import { GeneralSection } from '../GeneralSection';
import { DisplaySection } from '../DisplaySection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

type Scope = 'user' | 'project' | 'local';
type SectionComponent = typeof PermissionsSection;

let onSave: Mock;
let onDelete: Mock;
let onSaveNested: Mock;
let onDeleteNested: Mock;
beforeEach(() => {
  onSave = vi.fn().mockResolvedValue(undefined);
  onDelete = vi.fn().mockResolvedValue(undefined);
  onSaveNested = vi.fn().mockResolvedValue(undefined);
  onDeleteNested = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const render = (Section: SectionComponent, scope: Scope, settings: Record<string, unknown> = {}) =>
  renderWithI18n(
    <ToastProvider>
      <Section
        scope={scope}
        settings={settings as any}
        onSave={onSave}
        onDelete={onDelete}
        onSaveNested={onSaveNested}
        onDeleteNested={onDeleteNested}
      />
    </ToastProvider>,
  );

describe('PermissionsSection — blockReadsOutsideWorkingDirectories（Any file，巢狀於 permissions）', () => {
  it.each<Scope>(['user', 'project', 'local'])('scope=%s → 顯示', async (scope) => {
    render(PermissionsSection, scope);
    await waitFor(() => expect(screen.getByText('Block Reads Outside Working Directories')).toBeTruthy());
  });

  it('勾選 → 寫入 permissions.blockReadsOutsideWorkingDirectories，不寫頂層', async () => {
    render(PermissionsSection, 'project');
    const box = await screen.findByRole('checkbox', { name: 'Block Reads Outside Working Directories' });
    fireEvent.click(box);
    await waitFor(() => expect(onSaveNested).toHaveBeenCalledWith('permissions', 'blockReadsOutsideWorkingDirectories', true));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('已設 true 時取消勾選 → 只刪 permissions 內該格', async () => {
    render(PermissionsSection, 'user', { permissions: { blockReadsOutsideWorkingDirectories: true } });
    const box = await screen.findByRole('checkbox', { name: 'Block Reads Outside Working Directories' });
    fireEvent.click(box);
    await waitFor(() => {
      const nestedCalls = [...onSaveNested.mock.calls, ...onDeleteNested.mock.calls];
      expect(nestedCalls.some((call) => call[0] === 'permissions' && call[1] === 'blockReadsOutsideWorkingDirectories')).toBe(true);
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('PermissionsSection — skipAutoPermissionPrompt（User or managed）', () => {
  it('scope=user → 顯示', async () => {
    render(PermissionsSection, 'user');
    await waitFor(() => expect(screen.getByText('Skip Auto Mode Notice')).toBeTruthy());
  });

  it.each<Scope>(['project', 'local'])('scope=%s → 隱藏', async (scope) => {
    render(PermissionsSection, scope);
    await waitFor(() => screen.getByText('Block Reads Outside Working Directories'));
    expect(screen.queryByText('Skip Auto Mode Notice')).toBeNull();
  });
});

describe('AdvancedSection — 新增 key 的 scope 可見性', () => {
  const userOnly = ['Bash Edit Diff', 'Prepend Plugin Mods', 'Append Plugin Mods'];

  it('scope=user → 全部顯示', async () => {
    render(AdvancedSection, 'user');
    await waitFor(() => {
      for (const label of [...userOnly, 'Sync claude.ai Plugins', 'Bash Output Max Chars']) {
        expect(screen.getByText(label)).toBeTruthy();
      }
    });
  });

  it('scope=local → user-only 隱藏，syncClaudeAiPlugins 顯示', async () => {
    render(AdvancedSection, 'local');
    await waitFor(() => expect(screen.getByText('Sync claude.ai Plugins')).toBeTruthy());
    for (const label of userOnly) expect(screen.queryByText(label)).toBeNull();
  });

  it('scope=project → user-only 與 syncClaudeAiPlugins 皆隱藏，bashOutputMaxChars 顯示', async () => {
    render(AdvancedSection, 'project');
    await waitFor(() => expect(screen.getByText('Bash Output Max Chars')).toBeTruthy());
    for (const label of [...userOnly, 'Sync claude.ai Plugins']) expect(screen.queryByText(label)).toBeNull();
  });
});

describe('GeneralSection / DisplaySection — 新增 key 渲染', () => {
  it('GeneralSection 顯示 5 個新控制項', async () => {
    render(GeneralSection, 'user');
    await waitFor(() => {
      for (const label of [
        'Enforce Available Models for Default',
        'Max Effort Level',
        'Ultracode',
        'Chrome Integration by Default',
        'Idle Compaction',
      ]) {
        expect(screen.getByText(label)).toBeTruthy();
      }
    });
  });

  it('DisplaySection 顯示 6 個新控制項', async () => {
    render(DisplaySection, 'user');
    await waitFor(() => {
      for (const label of [
        'Max Prose Width',
        'PR Status Footer',
        'Skip /copy Picker',
        'Copy on Select',
        'Open Agent View by Default',
        '← Opens Agents',
      ]) {
        expect(screen.getByText(label)).toBeTruthy();
      }
    });
  });

  it('idleCompaction 取消勾選（預設 true）→ 寫入 false', async () => {
    render(GeneralSection, 'user');
    const box = await screen.findByRole('checkbox', { name: 'Idle Compaction' });
    fireEvent.click(box);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('idleCompaction', false));
  });
});
