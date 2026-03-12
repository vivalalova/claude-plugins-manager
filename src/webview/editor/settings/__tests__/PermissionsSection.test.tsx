/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { PermissionsSection } from '../PermissionsSection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderSection = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <PermissionsSection scope={scope} settings={settings as any} onSave={onSave} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('PermissionsSection — 渲染', () => {
  it('顯示 Permissions section title', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Permissions' })).toBeTruthy());
  });

  it('TagInput 類型欄位顯示 key hint 但不顯示陣列預設值', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('(additionalDirectories)')).toBeTruthy();
      expect(screen.getByText('(enabledMcpjsonServers)')).toBeTruthy();
      expect(screen.getByText('(disabledMcpjsonServers)')).toBeTruthy();
    });
  });

  it('顯示 Additional Directories label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Additional Directories')).toBeTruthy());
  });

  it('顯示 Enabled MCP JSON Servers label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Enabled MCP JSON Servers')).toBeTruthy());
  });

  it('顯示 Disabled MCP JSON Servers label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Disabled MCP JSON Servers')).toBeTruthy());
  });

  it('additionalDirectories 空 → 顯示 empty placeholder', async () => {
    renderSection({});
    await waitFor(() =>
      expect(screen.getByText('No additional directories configured')).toBeTruthy(),
    );
  });

  it('additionalDirectories 有值 → 顯示 tag', async () => {
    renderSection({ permissions: { additionalDirectories: ['~/docs'] } });
    await waitFor(() => expect(screen.getByText('~/docs')).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// 驗收條件
// ---------------------------------------------------------------------------

describe('PermissionsSection — additionalDirectories 互動', () => {
  it('新增目錄 → onSave("permissions", { ...existingPerms, additionalDirectories: [..., newDir] })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { additionalDirectories: ['~/docs'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/projects'));
    const addDirInput = screen.getByPlaceholderText('e.g. ~/projects');
    fireEvent.change(addDirInput, { target: { value: '~/projects' } });
    fireEvent.click(within(addDirInput.closest('.settings-field') as HTMLElement).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {
        additionalDirectories: ['~/docs', '~/projects'],
      });
    });
  });

  it('保留現有 permissions 欄位（merge）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { allow: ['Bash'], additionalDirectories: [] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/projects'));
    const addDirInput2 = screen.getByPlaceholderText('e.g. ~/projects');
    fireEvent.change(addDirInput2, { target: { value: '~/data' } });
    fireEvent.click(within(addDirInput2.closest('.settings-field') as HTMLElement).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {
        allow: ['Bash'],
        additionalDirectories: ['~/data'],
      });
    });
  });

  it('刪除目錄 → onSave("permissions", { ...existingPerms, additionalDirectories: [remaining] })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { additionalDirectories: ['~/docs', '~/projects'] } }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove ~/docs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove ~/docs' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {
        additionalDirectories: ['~/projects'],
      });
    });
  });

  it('重複目錄 → 顯示錯誤，不呼叫 onSave', async () => {

    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { additionalDirectories: ['~/docs'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/projects'));
    const addDirInput3 = screen.getByPlaceholderText('e.g. ~/projects');
    fireEvent.change(addDirInput3, { target: { value: '~/docs' } });
    fireEvent.click(within(addDirInput3.closest('.settings-field') as HTMLElement).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Directory already added')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// enabledMcpjsonServers 互動
// ---------------------------------------------------------------------------

describe('PermissionsSection — enabledMcpjsonServers 互動', () => {
  it('enabledMcpjsonServers=[] 新增 "memory" → onSave("enabledMcpjsonServers", ["memory"])', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. memory'));
    fireEvent.change(screen.getByPlaceholderText('e.g. memory'), { target: { value: 'memory' } });
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. memory'), { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('enabledMcpjsonServers', ['memory']);
    });
  });

  it("enabledMcpjsonServers=['memory'] 刪除 'memory' → onSave('enabledMcpjsonServers', [])", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ enabledMcpjsonServers: ['memory'] }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove memory' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove memory' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('enabledMcpjsonServers', []);
    });
  });

  it('重複項目 → 顯示錯誤，不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ enabledMcpjsonServers: ['memory'] }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. memory'));
    fireEvent.change(screen.getByPlaceholderText('e.g. memory'), { target: { value: 'memory' } });
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. memory'), { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Server already in list')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// disabledMcpjsonServers 互動
// ---------------------------------------------------------------------------

describe('PermissionsSection — disabledMcpjsonServers 互動', () => {
  it("disabledMcpjsonServers=['fs'] 刪除 'fs' → onSave('disabledMcpjsonServers', [])", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ disabledMcpjsonServers: ['fs'] }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove fs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove fs' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('disabledMcpjsonServers', []);
    });
  });

  it('disabledMcpjsonServers=[] 新增 "filesystem" → onSave("disabledMcpjsonServers", ["filesystem"])', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. filesystem'));
    fireEvent.change(screen.getByPlaceholderText('e.g. filesystem'), { target: { value: 'filesystem' } });
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. filesystem'), { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('disabledMcpjsonServers', ['filesystem']);
    });
  });

  it('重複項目 → 顯示錯誤，不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ disabledMcpjsonServers: ['fs'] }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. filesystem'));
    fireEvent.change(screen.getByPlaceholderText('e.g. filesystem'), { target: { value: 'fs' } });
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. filesystem'), { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Server already in list')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
