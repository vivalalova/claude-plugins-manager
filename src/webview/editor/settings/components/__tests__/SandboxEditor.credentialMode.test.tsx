/**
 * @vitest-environment jsdom
 *
 * #39 — user scope 憑證列可選 deny／mask，並提供 allowPlaintextInject、sigv4 控制項（C1～C10）。
 *
 * 假設的 i18n 文案（en，路徑前綴 settings.advanced.sandbox.credentials.*）：
 *   mode.label            = "Mode for {name}"        （每列 <select> 的 aria-label，值 deny／mask）
 *   allowPlaintextInject  = "Allow plaintext injection over HTTP"（checkbox，名稱含 plaintext）
 *   sigv4.streaming       = "Streaming requests"      （<select> 名稱含 streaming）
 *   sigv4.presigned       = "Presigned requests"      （<select> 名稱含 presigned）
 *   sigv4.sigv4a          = "SigV4A requests"         （<select> 名稱含 sigv4a）
 *   sigv4 選項 value：''＝未設定（notSet）、'deny'、'passthrough'
 * 所有查詢用 role + 名稱 regex，文案實際值不同時只需名稱仍含上述關鍵字。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
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

type Scope = 'user' | 'project' | 'local';
type Sandbox = ClaudeSettings['sandbox'];

const renderEditor = (
  sandbox: Sandbox,
  scope: Scope = 'user',
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) => {
  renderWithI18n(
    <ToastProvider>
      <SandboxEditor sandbox={sandbox} scope={scope} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );
  return { onSave, onDelete };
};

const modeSelect = (name: string): HTMLSelectElement =>
  screen.getByRole('combobox', { name: new RegExp(`mode.*${name}`, 'i') }) as HTMLSelectElement;
const queryModeSelects = (): HTMLElement[] => screen.queryAllByRole('combobox', { name: /mode/i });
const plaintext = (): HTMLInputElement => screen.getByRole('checkbox', { name: /plaintext/i }) as HTMLInputElement;
const queryPlaintext = (): HTMLElement | null => screen.queryByRole('checkbox', { name: /plaintext/i });
const sigv4Select = (kind: 'streaming' | 'presigned' | 'sigv4a'): HTMLSelectElement =>
  screen.getByRole('combobox', { name: new RegExp(kind, 'i') }) as HTMLSelectElement;
const querySigv4Selects = (): HTMLElement[] =>
  screen.queryAllByRole('combobox', { name: /streaming|presigned|sigv4a/i });

/** 最後一次 onSave 的 sandbox 值 */
const lastSaved = (onSave: ReturnType<typeof vi.fn>): NonNullable<Sandbox> =>
  onSave.mock.calls[onSave.mock.calls.length - 1][1] as NonNullable<Sandbox>;

const MASKED_ENV = { name: 'KEY_A', mode: 'mask', extract: 'E', injectHosts: ['h'] };

describe('SandboxEditor — #39 user scope 憑證 mask 模式與新控制項', () => {
  it('C1：envVars 的 KEY_A 改選 mask → 該筆 mode 變 mask，extract／injectHosts 與 files 原樣保留', async () => {
    const { onSave } = renderEditor({
      credentials: {
        envVars: [{ name: 'KEY_A', mode: 'deny', extract: 'E', injectHosts: ['h'] }],
        files: [{ path: '/run/secrets', mode: 'deny', maskDuplicates: true }],
      },
    } as Sandbox);
    await waitFor(() => modeSelect('KEY_A'));
    fireEvent.change(modeSelect('KEY_A'), { target: { value: 'mask' } });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const creds = lastSaved(onSave).credentials!;
    expect(creds.envVars).toEqual([{ name: 'KEY_A', mode: 'mask', extract: 'E', injectHosts: ['h'] }]);
    expect(creds.files).toEqual([{ path: '/run/secrets', mode: 'deny', maskDuplicates: true }]);
  });

  it('C1：files 的 /run/secrets 改選 mask → mode 變 mask，maskDuplicates 保留', async () => {
    const { onSave } = renderEditor({
      credentials: {
        files: [{ path: '/run/secrets', mode: 'deny', maskDuplicates: true }],
        envVars: [{ name: 'KEY_A', mode: 'deny', extract: 'E' }],
      },
    } as Sandbox);
    await waitFor(() => modeSelect('/run/secrets'));
    fireEvent.change(modeSelect('/run/secrets'), { target: { value: 'mask' } });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const creds = lastSaved(onSave).credentials!;
    expect(creds.files).toEqual([{ path: '/run/secrets', mode: 'mask', maskDuplicates: true }]);
    expect(creds.envVars).toEqual([{ name: 'KEY_A', mode: 'deny', extract: 'E' }]);
  });

  it('C2：user 顯示 mode 選單、allowPlaintextInject、sigv4 三個選單', async () => {
    renderEditor({ credentials: { envVars: [{ name: 'KEY_A', mode: 'deny' }] } } as Sandbox, 'user');
    await waitFor(() => expect(modeSelect('KEY_A')).toBeTruthy());
    expect(plaintext()).toBeTruthy();
    expect(sigv4Select('streaming')).toBeTruthy();
    expect(sigv4Select('presigned')).toBeTruthy();
    expect(sigv4Select('sigv4a')).toBeTruthy();
  });

  it.each(['project', 'local'] as const)('C2：%s 不顯示 mode 選單、allowPlaintextInject、sigv4 控制項（名稱仍以 tag 顯示）', async (scope) => {
    renderEditor({ credentials: { envVars: [{ name: 'KEY_A', mode: 'deny' }] } } as Sandbox, scope);
    await waitFor(() => expect(screen.queryByText('KEY_A')).not.toBeNull());
    expect(queryModeSelects()).toHaveLength(0);
    expect(queryPlaintext()).toBeNull();
    expect(querySigv4Selects()).toHaveLength(0);
  });

  it('C3：勾選 allowPlaintextInject → 存 true', async () => {
    const { onSave } = renderEditor({ credentials: { envVars: [{ name: 'KEY_A', mode: 'mask' }] } } as Sandbox);
    await waitFor(() => plaintext());
    fireEvent.click(plaintext());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(lastSaved(onSave).credentials!.allowPlaintextInject).toBe(true);
  });

  it('C3：已為 true 時取消勾選 → 刪 key（不是寫 false），其餘憑證保留', async () => {
    const { onSave } = renderEditor({
      credentials: { allowPlaintextInject: true, envVars: [{ name: 'KEY_A', mode: 'mask' }] },
    } as Sandbox);
    await waitFor(() => expect(plaintext().checked).toBe(true));
    fireEvent.click(plaintext());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const creds = lastSaved(onSave).credentials!;
    expect('allowPlaintextInject' in creds).toBe(false);
    expect(creds.envVars).toEqual([{ name: 'KEY_A', mode: 'mask' }]);
  });

  it('C4：sigv4 streaming 選 passthrough → sigv4:{streaming:"passthrough"}；再選「未設定」→ sigv4 整個消失', async () => {
    const first = renderEditor({ credentials: { envVars: [{ name: 'KEY_A', mode: 'mask' }] } } as Sandbox);
    await waitFor(() => sigv4Select('streaming'));
    fireEvent.change(sigv4Select('streaming'), { target: { value: 'passthrough' } });
    await waitFor(() => expect(first.onSave).toHaveBeenCalledTimes(1));
    expect(lastSaved(first.onSave).credentials!.sigv4).toEqual({ streaming: 'passthrough' });
    cleanup();

    const second = renderEditor({
      credentials: { sigv4: { streaming: 'passthrough' }, envVars: [{ name: 'KEY_A', mode: 'mask' }] },
    } as Sandbox);
    await waitFor(() => expect(sigv4Select('streaming').value).toBe('passthrough'));
    fireEvent.change(sigv4Select('streaming'), { target: { value: '' } });
    await waitFor(() => expect(second.onSave).toHaveBeenCalledTimes(1));
    const creds = lastSaved(second.onSave).credentials!;
    expect('sigv4' in creds).toBe(false);
    expect(creds.envVars).toEqual([{ name: 'KEY_A', mode: 'mask' }]);
  });

  it('C5：sigv4 是 sandbox 唯一內容，選「未設定」→ onDelete("sandbox") 1 次、onSave 0 次', async () => {
    const { onSave, onDelete } = renderEditor({ credentials: { sigv4: { streaming: 'deny' } } } as Sandbox);
    await waitFor(() => expect(sigv4Select('streaming').value).toBe('deny'));
    fireEvent.change(sigv4Select('streaming'), { target: { value: '' } });
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith('sandbox');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('C6：user 有 mask 憑證，切換 enabled → 憑證與另兩個欄位原樣保留', async () => {
    const { onSave } = renderEditor({
      enabled: false,
      credentials: {
        envVars: [MASKED_ENV],
        files: [{ path: '/run/secrets', mode: 'mask', maskDuplicates: true }],
        allowPlaintextInject: true,
        sigv4: { streaming: 'deny' },
      },
    } as Sandbox);
    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = lastSaved(onSave);
    expect(saved.enabled).toBe(true);
    expect(saved.credentials).toEqual({
      envVars: [MASKED_ENV],
      files: [{ path: '/run/secrets', mode: 'mask', maskDuplicates: true }],
      allowPlaintextInject: true,
      sigv4: { streaming: 'deny' },
    });
  });

  describe('C7：三個新控制項兩兩交錯，另外兩個欄位不變', () => {
    const initial = () => ({
      credentials: {
        envVars: [MASKED_ENV],
        allowPlaintextInject: true,
        sigv4: { streaming: 'deny' },
      },
    }) as Sandbox;

    it('C7a：改 KEY_A 的 mode → allowPlaintextInject、sigv4 不變', async () => {
      const { onSave } = renderEditor(initial());
      await waitFor(() => modeSelect('KEY_A'));
      fireEvent.change(modeSelect('KEY_A'), { target: { value: 'deny' } });
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const creds = lastSaved(onSave).credentials!;
      expect(creds.allowPlaintextInject).toBe(true);
      expect(creds.sigv4).toEqual({ streaming: 'deny' });
      expect(creds.envVars).toEqual([{ ...MASKED_ENV, mode: 'deny' }]);
    });

    it('C7b：改 sigv4.presigned → envVars、allowPlaintextInject、sigv4.streaming 不變', async () => {
      const { onSave } = renderEditor(initial());
      await waitFor(() => sigv4Select('presigned'));
      fireEvent.change(sigv4Select('presigned'), { target: { value: 'passthrough' } });
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const creds = lastSaved(onSave).credentials!;
      expect(creds.envVars).toEqual([MASKED_ENV]);
      expect(creds.allowPlaintextInject).toBe(true);
      expect(creds.sigv4).toEqual({ streaming: 'deny', presigned: 'passthrough' });
    });

    it('C7c：切換 allowPlaintextInject → envVars、sigv4 不變', async () => {
      const { onSave } = renderEditor(initial());
      await waitFor(() => plaintext());
      fireEvent.click(plaintext());
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const creds = lastSaved(onSave).credentials!;
      expect(creds.envVars).toEqual([MASKED_ENV]);
      expect(creds.sigv4).toEqual({ streaming: 'deny' });
      expect('allowPlaintextInject' in creds).toBe(false);
    });
  });

  it('C8：project 的隱藏欄位（allowPlaintextInject、sigv4、含進階欄位的 mask）在新增名稱與切換 enabled 兩次存檔都原樣帶回', async () => {
    const credentials = {
      allowPlaintextInject: true,
      sigv4: { sigv4a: 'passthrough' },
      envVars: [MASKED_ENV],
    };
    const { onSave } = renderEditor({ enabled: false, credentials } as Sandbox, 'project');
    await waitFor(() => screen.getByPlaceholderText(/e\.g\..+AWS/i));

    const input = screen.getByPlaceholderText(/e\.g\..+AWS/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'NEW_KEY' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const first = lastSaved(onSave).credentials!;
    expect(first.allowPlaintextInject).toBe(true);
    expect(first.sigv4).toEqual({ sigv4a: 'passthrough' });
    expect(first.envVars).toEqual([MASKED_ENV, { name: 'NEW_KEY', mode: 'deny' }]);

    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Enable Sandbox' }) as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    const second = lastSaved(onSave).credentials!;
    expect(second.allowPlaintextInject).toBe(true);
    expect(second.sigv4).toEqual({ sigv4a: 'passthrough' });
    expect(second.envVars).toEqual([MASKED_ENV]);
  });

  it('C9：儲存中 mode 選單、sigv4 選單、allowPlaintextInject 勾選框全部停用', async () => {
    const onSave = vi.fn().mockReturnValue(new Promise(() => {}));
    renderEditor({ enabled: false, credentials: { envVars: [MASKED_ENV] } } as Sandbox, 'user', onSave);
    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    // 儲存前皆可操作（避免「本來就停用」造成假綠）
    expect(modeSelect('KEY_A').disabled).toBe(false);
    expect(plaintext().disabled).toBe(false);
    expect(sigv4Select('streaming').disabled).toBe(false);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(modeSelect('KEY_A').disabled).toBe(true));
    expect(plaintext().disabled).toBe(true);
    expect(sigv4Select('streaming').disabled).toBe(true);
    expect(sigv4Select('presigned').disabled).toBe(true);
    expect(sigv4Select('sigv4a').disabled).toBe(true);
  });

  it('C10：同名重複筆折疊成一列顯示 deny；改 mask 後兩筆都是 mask，第一筆仍保留 extract', async () => {
    const { onSave } = renderEditor({
      credentials: {
        envVars: [
          { name: 'DUP_A', mode: 'mask', extract: 'E' },
          { name: 'DUP_A', mode: 'deny' },
        ],
      },
    } as Sandbox);
    await waitFor(() => modeSelect('DUP_A'));
    expect(screen.getAllByText('DUP_A')).toHaveLength(1);
    expect(document.querySelectorAll('.perm-rule-tag')).toHaveLength(1);
    expect(screen.queryAllByRole('combobox', { name: /mode.*DUP_A/i })).toHaveLength(1);
    expect(modeSelect('DUP_A').value).toBe('deny');

    fireEvent.change(modeSelect('DUP_A'), { target: { value: 'mask' } });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(lastSaved(onSave).credentials!.envVars).toEqual([
      { name: 'DUP_A', mode: 'mask', extract: 'E' },
      { name: 'DUP_A', mode: 'mask' },
    ]);
  });
});
