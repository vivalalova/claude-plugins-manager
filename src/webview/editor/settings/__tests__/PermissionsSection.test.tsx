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
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <PermissionsSection scope={scope} settings={settings as any} onSave={onSave} onDelete={onDelete} />
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
  it('TagInput 類型欄位顯示 key hint 但不顯示陣列預設值', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('(enableAllProjectMcpServers: false)')).toBeTruthy();
      expect(screen.getByText('(disableAutoMode)')).toBeTruthy();
      expect(screen.getByText('(skipDangerousModePermissionPrompt: false)')).toBeTruthy();
      expect(screen.getByText('(useAutoModeDuringPlan: true)')).toBeTruthy();
      expect(screen.getByText('(additionalDirectories)')).toBeTruthy();
      expect(screen.getByText('(enabledMcpjsonServers)')).toBeTruthy();
      expect(screen.getByText('(disabledMcpjsonServers)')).toBeTruthy();
    });
  });

  it('顯示 Enable All Project MCP Servers toggle', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Enable All Project MCP Servers')).toBeTruthy());
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

  it('顯示 Disable Auto Mode、Skip Dangerous Mode Permission Prompt、Use Auto Mode During Plan', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText('Disable Auto Mode')).toBeTruthy();
      expect(screen.getByText('Skip Dangerous Mode Permission Prompt')).toBeTruthy();
      expect(screen.getByText('Use Auto Mode During Plan')).toBeTruthy();
    });
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

describe('PermissionsSection — new settings 互動', () => {
  it('disableAutoMode 未設定, 選擇 disable → onSave("permissions", { disableAutoMode: "disable" })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Auto Mode' }), { target: { value: 'disable' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', { disableAutoMode: 'disable' });
    });
  });

  it('permissions.disableAutoMode="disable", 選擇空值 → onSave("permissions", {})', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableAutoMode: 'disable' } }, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Auto Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {});
    });
  });

  it('skipDangerousModePermissionPrompt 未設定, toggle on → onSave("skipDangerousModePermissionPrompt", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Skip Dangerous Mode Permission Prompt' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip Dangerous Mode Permission Prompt' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('skipDangerousModePermissionPrompt', true);
    });
  });

  it('useAutoModeDuringPlan 未設定 → checkbox checked（反映預設值 true）', async () => {
    renderSection({});

    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: 'Use Auto Mode During Plan' }) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  it('useAutoModeDuringPlan 未設定, toggle off → onSave("useAutoModeDuringPlan", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Use Auto Mode During Plan' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use Auto Mode During Plan' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('useAutoModeDuringPlan', false);
    });
  });

  it('useAutoModeDuringPlan=false, toggle on → onDelete("useAutoModeDuringPlan")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ useAutoModeDuringPlan: false }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Use Auto Mode During Plan' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use Auto Mode During Plan' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('useAutoModeDuringPlan');
    });
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

// ---------------------------------------------------------------------------
// rule form 互動
// ---------------------------------------------------------------------------

describe('PermissionsSection — rule form 互動', () => {
  it('toolNameArg 規則缺少 pattern 時不得送出', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({}, onSave);

    await waitFor(() => {
      expect(container.querySelector('.perm-add-form')).toBeTruthy();
    });

    const form = container.querySelector('.perm-add-form') as HTMLElement;
    const formatSelect = within(form).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: 'toolNameArg' } });

    const toolNameInput = within(form).getByPlaceholderText('e.g. WebFetch');
    const addButton = within(form).getByRole('button', { name: 'Add Rule' }) as HTMLButtonElement;
    fireEvent.change(toolNameInput, { target: { value: 'Bash' } });

    expect(addButton.disabled).toBe(true);

    fireEvent.keyDown(toolNameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('toolNameArg 格式新增規則 → onSave 寫入 toolName(pattern)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({}, onSave);

    await waitFor(() => {
      expect(container.querySelector('.perm-add-form')).toBeTruthy();
    });

    const form = container.querySelector('.perm-add-form') as HTMLElement;
    const formatSelect = within(form).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: 'toolNameArg' } });

    const toolNameInput = within(form).getByPlaceholderText('e.g. WebFetch');
    const patternInput = within(form).getByPlaceholderText('e.g. git:*');
    fireEvent.change(toolNameInput, { target: { value: 'Bash' } });
    fireEvent.change(patternInput, { target: { value: 'npm test' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add Rule' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', { allow: ['Bash(npm test)'] });
    });
  });

  it('新增規則時會去除各欄位前後空白並用正規化值判斷重複', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ permissions: { allow: ['Bash(npm test)'] } }, onSave);

    await waitFor(() => {
      expect(container.querySelector('.perm-add-form')).toBeTruthy();
    });

    const form = container.querySelector('.perm-add-form') as HTMLElement;
    const formatSelect = within(form).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: 'toolNameArg' } });

    const toolNameInput = within(form).getByPlaceholderText('e.g. WebFetch');
    const patternInput = within(form).getByPlaceholderText('e.g. git:*');
    fireEvent.change(toolNameInput, { target: { value: '  Bash  ' } });
    fireEvent.change(patternInput, { target: { value: '  npm test  ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add Rule' }));

    await waitFor(() => {
      expect(within(form).getByText('Rule already exists')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('切換 rule format → 清空前一格式未送出的輸入', async () => {
    const { container } = renderSection({});

    await waitFor(() => {
      expect(container.querySelector('.perm-add-form')).toBeTruthy();
    });

    const form = container.querySelector('.perm-add-form') as HTMLElement;
    const formatSelect = within(form).getByRole('combobox') as HTMLSelectElement;
    const toolNameInput = within(form).getByPlaceholderText('e.g. WebFetch') as HTMLInputElement;

    fireEvent.change(toolNameInput, { target: { value: 'Bash' } });
    expect(toolNameInput.value).toBe('Bash');

    fireEvent.change(formatSelect, { target: { value: 'mcp' } });

    const mcpInput = within(form).getByPlaceholderText('e.g. mcp__context7__resolve-library-id');
    expect((mcpInput as HTMLInputElement).value).toBe('');
    expect(within(form).queryByPlaceholderText('e.g. WebFetch')).toBeNull();
  });

  it('mcp 格式新增重複規則 → 顯示錯誤且不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ permissions: { allow: ['mcp__memory__read_graph'] } }, onSave);

    await waitFor(() => {
      expect(container.querySelector('.perm-add-form')).toBeTruthy();
    });

    const form = container.querySelector('.perm-add-form') as HTMLElement;
    const formatSelect = within(form).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: 'mcp' } });

    const mcpInput = within(form).getByPlaceholderText('e.g. mcp__context7__resolve-library-id');
    fireEvent.change(mcpInput, { target: { value: 'mcp__memory__read_graph' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add Rule' }));

    await waitFor(() => {
      expect(within(form).getByText('Rule already exists')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// enableAllProjectMcpServers 互動
// ---------------------------------------------------------------------------

describe('PermissionsSection — enableAllProjectMcpServers 互動', () => {
  it('enableAllProjectMcpServers 未設定 → checkbox unchecked', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('enableAllProjectMcpServers: true → checkbox checked', async () => {
    renderSection({ enableAllProjectMcpServers: true });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('toggle off→on → onSave("enableAllProjectMcpServers", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('enableAllProjectMcpServers', true);
    });
  });

  it('toggle on→off → 值等於 default，呼叫 onDelete("enableAllProjectMcpServers")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ enableAllProjectMcpServers: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('enableAllProjectMcpServers');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
