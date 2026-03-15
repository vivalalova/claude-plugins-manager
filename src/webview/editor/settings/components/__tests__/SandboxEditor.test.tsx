/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { SandboxEditor } from '../SandboxEditor';
import type { ClaudeSettings } from '../../../../../shared/types';

vi.mock('../../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SANDBOX_PLACEHOLDER = 'e.g. { "enabled": true, "filesystem": { "allowWrite": ["/tmp"] } }';

const renderEditor = (
  sandbox: ClaudeSettings['sandbox'] = undefined,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <SandboxEditor sandbox={sandbox} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

/** Switch to JSON mode */
async function switchToJsonMode(): Promise<void> {
  await waitFor(() => expect(screen.getByText('Sandbox')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
  await waitFor(() => expect(screen.getByPlaceholderText(SANDBOX_PLACEHOLDER)).toBeTruthy());
}

// ---------------------------------------------------------------------------
// 結構化模式 - 渲染
// ---------------------------------------------------------------------------

describe('SandboxEditor — 結構化模式渲染', () => {
  it('sandbox=undefined → 所有 checkbox 未勾選、tag list 為空', async () => {
    renderEditor(undefined);
    await waitFor(() => {
      const enabledCb = screen.getByRole('checkbox', { name: 'Enable Sandbox' }) as HTMLInputElement;
      expect(enabledCb.checked).toBe(false);
    });
  });

  it('sandbox={} → 正確渲染空狀態不拋錯', async () => {
    renderEditor({});
    await waitFor(() => {
      expect(screen.getByText('Enable Sandbox')).toBeTruthy();
      const enabledCb = screen.getByRole('checkbox', { name: 'Enable Sandbox' }) as HTMLInputElement;
      expect(enabledCb.checked).toBe(false);
    });
  });

  it('sandbox.enabled=true → Enable Sandbox checkbox 已勾選', async () => {
    renderEditor({ enabled: true });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Enable Sandbox' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('sandbox.filesystem.allowWrite=["/tmp"] → 顯示 tag', async () => {
    renderEditor({ filesystem: { allowWrite: ['/tmp'] } });
    await waitFor(() => {
      expect(screen.getByText('/tmp')).toBeTruthy();
    });
  });

  it('sandbox 有多個 filesystem paths → 各自顯示 tag', async () => {
    renderEditor({
      filesystem: {
        allowWrite: ['/tmp', '/var'],
        denyRead: ['/etc/passwd'],
      },
    });
    await waitFor(() => {
      expect(screen.getByText('/tmp')).toBeTruthy();
      expect(screen.getByText('/var')).toBeTruthy();
      expect(screen.getByText('/etc/passwd')).toBeTruthy();
    });
  });

  it('sandbox=undefined → Clear 按鈕不顯示', async () => {
    renderEditor(undefined);
    await waitFor(() => screen.getByText('Enable Sandbox'));
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('sandbox 有值 → Clear 按鈕顯示', async () => {
    renderEditor({ enabled: true });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 結構化模式 - checkbox toggle
// ---------------------------------------------------------------------------

describe('SandboxEditor — 結構化模式 checkbox', () => {
  it('toggle enabled → onSave("sandbox", { enabled: true })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', { enabled: true });
    });
  });

  it('sandbox.enabled=true, toggle off → onDelete("sandbox")（cleanSandbox 返回 undefined）', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({ enabled: true }, vi.fn(), onDelete);
    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });

  it('toggle autoAllowBash → onSave 含 autoAllowBashIfSandboxed: true', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await waitFor(() => screen.getByRole('checkbox', { name: /Auto-allow Bash/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Auto-allow Bash/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', { autoAllowBashIfSandboxed: true });
    });
  });
});

// ---------------------------------------------------------------------------
// 結構化模式 - tag list（allowWrite）
// ---------------------------------------------------------------------------

describe('SandboxEditor — 結構化模式 allowWrite tag list', () => {
  it('新增 path → onSave 收到含新 path 的結構', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);

    await waitFor(() => screen.getByText('Allow Write Paths'));

    const allowWriteInput = screen.getByPlaceholderText('e.g. /tmp');
    fireEvent.change(allowWriteInput, { target: { value: '/home/user' } });
    fireEvent.keyDown(allowWriteInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', {
        filesystem: { allowWrite: ['/home/user'] },
      });
    });
  });

  it('已有 path，刪除 → onSave 收到移除後的陣列', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ filesystem: { allowWrite: ['/tmp', '/var'] } }, onSave);

    await waitFor(() => screen.getByText('/var'));

    // Click the × button for /tmp tag
    const tmpTag = screen.getByText('/tmp').closest('.perm-rule-tag') as HTMLElement;
    fireEvent.click(within(tmpTag).getByRole('button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', {
        filesystem: { allowWrite: ['/var'] },
      });
    });
  });

  it('新增重複 path → 顯示 duplicate error，不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ filesystem: { allowWrite: ['/tmp'] } }, onSave);

    await waitFor(() => screen.getByText('/tmp'));

    const allowWriteInput = screen.getByPlaceholderText('e.g. /tmp');
    fireEvent.change(allowWriteInput, { target: { value: '/tmp' } });
    fireEvent.keyDown(allowWriteInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('刪除所有 path，已無其他欄位 → onDelete("sandbox")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({ filesystem: { allowWrite: ['/tmp'] } }, vi.fn(), onDelete);

    await waitFor(() => screen.getByText('/tmp'));

    const tmpTag = screen.getByText('/tmp').closest('.perm-rule-tag') as HTMLElement;
    fireEvent.click(within(tmpTag).getByRole('button'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });
});

// ---------------------------------------------------------------------------
// 結構化模式 - Clear
// ---------------------------------------------------------------------------

describe('SandboxEditor — 結構化模式 Clear', () => {
  it('sandbox 有值, 按 Clear → onDelete("sandbox")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({ enabled: true }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });
});

// ---------------------------------------------------------------------------
// JSON 模式 - 渲染
// ---------------------------------------------------------------------------

describe('SandboxEditor — JSON 模式渲染', () => {
  it('sandbox=undefined → JSON textarea 為空', async () => {
    renderEditor(undefined);
    await switchToJsonMode();
    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER) as HTMLTextAreaElement;
    expect(ta.value).toBe('');
  });

  it('sandbox={} → JSON textarea 顯示格式化 JSON', async () => {
    renderEditor({});
    await switchToJsonMode();
    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER) as HTMLTextAreaElement;
    expect(ta.value).toBe(JSON.stringify({}, null, 2));
  });

  it('sandbox 有值 → JSON textarea 顯示格式化 JSON', async () => {
    const sb = { enabled: true, filesystem: { allowWrite: ['/tmp'] } };
    renderEditor(sb);
    await switchToJsonMode();
    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER) as HTMLTextAreaElement;
    expect(ta.value).toBe(JSON.stringify(sb, null, 2));
  });

  it('sandbox=undefined → JSON mode Clear 按鈕不顯示', async () => {
    renderEditor(undefined);
    await switchToJsonMode();
    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    const field = ta.closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('sandbox 有值 → JSON mode Clear 按鈕顯示', async () => {
    renderEditor({ enabled: true });
    await switchToJsonMode();
    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    const field = ta.closest('.settings-field') as HTMLElement;
    expect(within(field).getByRole('button', { name: 'Clear' })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// JSON 模式 - 驗證
// ---------------------------------------------------------------------------

describe('SandboxEditor — JSON 模式驗證', () => {
  it('輸入非法 JSON, 按 Save → 顯示 error，不呼叫 onSave/onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave, onDelete);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    fireEvent.change(ta, { target: { value: '{invalid json}' } });
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(field).getByRole('alert')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('輸入 JSON array, 按 Save → 顯示 invalidObject error', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    fireEvent.change(ta, { target: { value: '[1,2,3]' } });
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const alert = within(field).getByRole('alert');
      expect(alert.textContent).toContain('JSON object');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('輸入 JSON null, 按 Save → 顯示 invalidObject error', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    fireEvent.change(ta, { target: { value: 'null' } });
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(field).getByRole('alert')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('error 顯示後修改 textarea → error 清除', async () => {
    renderEditor(undefined);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.change(ta, { target: { value: '{bad' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(within(field).queryByRole('alert')).toBeTruthy());

    fireEvent.change(ta, { target: { value: '{}' } });
    await waitFor(() => expect(within(field).queryByRole('alert')).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// JSON 模式 - Save / Delete
// ---------------------------------------------------------------------------

describe('SandboxEditor — JSON 模式 Save', () => {
  it('textarea 為空, 按 Save → onDelete("sandbox")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave, onDelete);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('textarea 只有空白, 按 Save → onDelete("sandbox")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({ enabled: true }, onSave, onDelete);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    fireEvent.change(ta, { target: { value: '   ' } });
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('有效 JSON object, 按 Save → onSave("sandbox", parsedObject)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    fireEvent.change(ta, { target: { value: '{"enabled":true,"filesystem":{"allowWrite":["/tmp"]}}' } });
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', {
        enabled: true,
        filesystem: { allowWrite: ['/tmp'] },
      });
    });
  });

  it('JSON mode Clear → onDelete("sandbox")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({ enabled: true }, vi.fn(), onDelete);
    await switchToJsonMode();

    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    const field = ta.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });
});

// ---------------------------------------------------------------------------
// 模式切換
// ---------------------------------------------------------------------------

describe('SandboxEditor — 模式切換', () => {
  it('Structured → JSON: JSON textarea 反映 sandbox 當前值', async () => {
    const sb = { enabled: true, filesystem: { allowWrite: ['/tmp'] } };
    renderEditor(sb);
    await waitFor(() => screen.getByText('Enable Sandbox'));

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    await waitFor(() => {
      const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER) as HTMLTextAreaElement;
      expect(ta.value).toBe(JSON.stringify(sb, null, 2));
    });
  });

  it('Structured → JSON → Structured: 回到結構化模式顯示 sandbox prop 值', async () => {
    renderEditor({ enabled: true });
    await waitFor(() => screen.getByText('Enable Sandbox'));

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    await waitFor(() => screen.getByPlaceholderText(SANDBOX_PLACEHOLDER));

    fireEvent.click(screen.getByRole('button', { name: 'Structured' }));
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Enable Sandbox' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('重複點擊同一模式 → 不切換（無副作用）', async () => {
    renderEditor({ enabled: true });
    await waitFor(() => screen.getByText('Enable Sandbox'));

    // Click Structured again (already in structured mode)
    fireEvent.click(screen.getByRole('button', { name: 'Structured' }));
    await waitFor(() => {
      // Still in structured mode
      expect(screen.queryByPlaceholderText(SANDBOX_PLACEHOLDER)).toBeNull();
      expect(screen.getByRole('checkbox', { name: 'Enable Sandbox' })).toBeTruthy();
    });
  });

  it('JSON mode 輸入後切換回 Structured → JSON 未保存的修改不影響結構化顯示', async () => {
    renderEditor({ enabled: true });
    await waitFor(() => screen.getByText('Enable Sandbox'));

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    await waitFor(() => screen.getByPlaceholderText(SANDBOX_PLACEHOLDER));

    // Modify JSON without saving
    const ta = screen.getByPlaceholderText(SANDBOX_PLACEHOLDER);
    fireEvent.change(ta, { target: { value: '{"enabled":false}' } });

    // Switch back to structured — sandbox prop (enabled:true) is source of truth
    fireEvent.click(screen.getByRole('button', { name: 'Structured' }));
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Enable Sandbox' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });
});
