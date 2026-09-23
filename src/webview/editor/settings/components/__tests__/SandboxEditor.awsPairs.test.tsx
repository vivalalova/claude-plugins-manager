/**
 * @vitest-environment jsdom
 *
 * sandbox.credentials.awsPairs 專用陣列 editor
 *
 * shape: { accessKeyIdVar: string; secretAccessKeyVar: string; sessionTokenVar?: string }[]
 *
 * 契約：
 *   - 逐 pair 三欄表單 + 新增／移除列
 *   - 交叉檢查警告（提示、不擋儲存）：
 *       a. 被指名的變數不是 credentials.envVars 裡的整值 mask entry
 *          （未登記／mode 非 mask／帶 extract 或 decode）
 *       b. 同一變數跨 pair／slot 重複出現
 *   - draft 保留：其他列存檔造成的 props 回灌不得抹掉半填的列
 *   - 內容等價（正規化後比較）時純 blur 不觸發存檔
 *   - 只有必填兩欄皆齊的 row 才寫入設定（schema 上兩者 required）
 *   - cleanSandbox：空 awsPairs 陣列要從 credentials 移除（與 files/envVars 一致）
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { I18nProvider } from '../../../../i18n/I18nContext';
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

const renderEditor = (
  sandbox: ClaudeSettings['sandbox'] = undefined,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <SandboxEditor sandbox={sandbox} scope={scope} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

const input = (row: number, slot: string): HTMLInputElement =>
  document.getElementById(`sandbox-awsPairs-${row}-${slot}`) as HTMLInputElement;

const addPair = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Add pair' }));
};

/** docs: awsPairs 指名的變數必須是整值 mask entry（無 extract／decode）。 */
const ENV_VARS: NonNullable<ClaudeSettings['sandbox']>['credentials'] = {
  envVars: [
    { name: 'MY_KEY_ID', mode: 'mask' },
    { name: 'MY_SECRET', mode: 'mask' },
    { name: 'MY_TOKEN', mode: 'mask' },
  ],
};

const alertTexts = (): string[] => screen.queryAllByRole('alert').map((a) => a.textContent ?? '');
const unregisteredAlertFor = (name: string): boolean =>
  alertTexts().some((tx) => /Not listed as credential env vars/.test(tx) && tx.includes(name));
const notMaskAlertFor = (name: string): boolean =>
  alertTexts().some((tx) => /Listed but not masked/.test(tx) && tx.includes(name));
const hasExtractOrDecodeAlertFor = (name: string): boolean =>
  alertTexts().some((tx) => /Masked but not whole-value/.test(tx) && tx.includes(name));

describe('SandboxEditor — credentials.awsPairs render / 新增 / 移除', () => {
  it('未設定 → 顯示 awsPairs 區塊與空狀態，沒有任何 pair 列', async () => {
    renderEditor(undefined);
    await waitFor(() => expect(screen.getByText('AWS Credential Pairs')).toBeTruthy());
    expect(screen.getByText('No AWS credential pairs')).toBeTruthy();
    expect(input(0, 'accessKeyIdVar')).toBeNull();
  });

  it('既有 pair 回填三欄', async () => {
    renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET', sessionTokenVar: 'MY_TOKEN' }],
      },
    } as ClaudeSettings['sandbox']);
    await waitFor(() => {
      expect(input(0, 'accessKeyIdVar').value).toBe('MY_KEY_ID');
      expect(input(0, 'secretAccessKeyVar').value).toBe('MY_SECRET');
      expect(input(0, 'sessionTokenVar').value).toBe('MY_TOKEN');
    });
  });

  it('新增列 → 出現空白三欄；未填完不觸發儲存', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ credentials: ENV_VARS } as ClaudeSettings['sandbox'], onSave);

    addPair();
    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    expect(input(0, 'accessKeyIdVar').value).toBe('');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('填妥必填兩欄（blur）→ onSave("sandbox", credentials.awsPairs 含該 pair)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ credentials: ENV_VARS } as ClaudeSettings['sandbox'], onSave);

    addPair();
    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.change(input(0, 'accessKeyIdVar'), { target: { value: 'MY_KEY_ID' } });
    fireEvent.change(input(0, 'secretAccessKeyVar'), { target: { value: 'MY_SECRET' } });
    fireEvent.blur(input(0, 'secretAccessKeyVar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', expect.objectContaining({
        credentials: expect.objectContaining({
          awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET' }],
        }),
      }));
    });
  });

  it('sessionTokenVar 選填：填了才寫入', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ credentials: ENV_VARS } as ClaudeSettings['sandbox'], onSave);

    addPair();
    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.change(input(0, 'accessKeyIdVar'), { target: { value: 'MY_KEY_ID' } });
    fireEvent.change(input(0, 'secretAccessKeyVar'), { target: { value: 'MY_SECRET' } });
    fireEvent.change(input(0, 'sessionTokenVar'), { target: { value: 'MY_TOKEN' } });
    fireEvent.blur(input(0, 'sessionTokenVar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', expect.objectContaining({
        credentials: expect.objectContaining({
          awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET', sessionTokenVar: 'MY_TOKEN' }],
        }),
      }));
    });
  });

  it('移除唯一一列 → awsPairs 變空陣列，cleanSandbox 剔除後 credentials 只剩 envVars', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET' }],
      },
    } as ClaudeSettings['sandbox'], onSave);

    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Remove pair 1' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      const saved = onSave.mock.calls[0][1] as Record<string, any>;
      expect(saved.credentials).not.toHaveProperty('awsPairs');
      expect(saved.credentials.envVars).toHaveLength(3);
    });
  });

  it('移除唯一一列且 sandbox 無其他欄位 → onDelete("sandbox")（不留空物件）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({
      credentials: { awsPairs: [{ accessKeyIdVar: 'A', secretAccessKeyVar: 'B' }] },
    } as ClaudeSettings['sandbox'], onSave, onDelete);

    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Remove pair 1' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

describe('SandboxEditor — credentials.awsPairs 交叉檢查警告', () => {
  it('指名的變數未登記在 credentials.envVars → 顯示警告並列出變數名', async () => {
    renderEditor({
      credentials: {
        envVars: [{ name: 'MY_KEY_ID', mode: 'mask' }],
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'NOT_MASKED' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => expect(unregisteredAlertFor('NOT_MASKED')).toBe(true));
    expect(unregisteredAlertFor('MY_KEY_ID')).toBe(false);
  });

  it('全部變數都是整值 mask entry → 無資格警告', async () => {
    renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    expect(alertTexts().some((tx) => /whole-value/.test(tx))).toBe(false);
  });

  it('已登記但 mode 為 deny → 顯示未遮罩警告（docs 要求整值 mask）', async () => {
    renderEditor({
      credentials: {
        envVars: [{ name: 'MY_KEY_ID', mode: 'mask' }, { name: 'DENIED_VAR', mode: 'deny' }],
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'DENIED_VAR' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => expect(notMaskAlertFor('DENIED_VAR')).toBe(true));
    expect(notMaskAlertFor('MY_KEY_ID')).toBe(false);
  });

  it('mask 但帶 extract → 非整值，顯示 extract／decode 警告', async () => {
    renderEditor({
      credentials: {
        envVars: [{ name: 'MY_KEY_ID', mode: 'mask' }, { name: 'EXTRACTED_VAR', mode: 'mask', extract: 'key=(.*)' }],
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'EXTRACTED_VAR' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => expect(hasExtractOrDecodeAlertFor('EXTRACTED_VAR')).toBe(true));
    expect(hasExtractOrDecodeAlertFor('MY_KEY_ID')).toBe(false);
  });

  it('mask 但帶 decode → 非整值，顯示 extract／decode 警告', async () => {
    renderEditor({
      credentials: {
        envVars: [{ name: 'MY_KEY_ID', mode: 'mask' }, { name: 'JWT_VAR', mode: 'mask', decode: 'jwt' }],
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'JWT_VAR' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => expect(hasExtractOrDecodeAlertFor('JWT_VAR')).toBe(true));
    expect(hasExtractOrDecodeAlertFor('MY_KEY_ID')).toBe(false);
  });

  it('mask 帶 injectHosts／maskClaims 仍算整值 → 無資格警告', async () => {
    renderEditor({
      credentials: {
        envVars: [
          { name: 'MY_KEY_ID', mode: 'mask', injectHosts: ['example.com'] },
          { name: 'MY_SECRET', mode: 'mask', maskClaims: ['sub'] },
        ],
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    expect(alertTexts().some((tx) => /whole-value/.test(tx))).toBe(false);
  });

  it('同一變數跨 pair 重複出現 → 顯示重複警告', async () => {
    renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [
          { accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET' },
          { accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_TOKEN' },
        ],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert').map((a) => a.textContent ?? '');
      expect(alerts.some((tx) => /more than one slot/.test(tx) && tx.includes('MY_KEY_ID'))).toBe(true);
    });
  });

  it('同一變數在同一 pair 的兩個 slot 重複 → 也顯示重複警告', async () => {
    renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_KEY_ID' }],
      },
    } as ClaudeSettings['sandbox']);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert').map((a) => a.textContent ?? '');
      expect(alerts.some((tx) => /more than one slot/.test(tx) && tx.includes('MY_KEY_ID'))).toBe(true);
    });
  });

  it('警告不擋儲存：有 unregistered 警告時仍會寫入設定', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ credentials: ENV_VARS } as ClaudeSettings['sandbox'], onSave);

    addPair();
    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.change(input(0, 'accessKeyIdVar'), { target: { value: 'NOT_MASKED' } });
    fireEvent.change(input(0, 'secretAccessKeyVar'), { target: { value: 'ALSO_NOT_MASKED' } });
    fireEvent.blur(input(0, 'secretAccessKeyVar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', expect.objectContaining({
        credentials: expect.objectContaining({
          awsPairs: [{ accessKeyIdVar: 'NOT_MASKED', secretAccessKeyVar: 'ALSO_NOT_MASKED' }],
        }),
      }));
      expect(unregisteredAlertFor('NOT_MASKED')).toBe(true);
    });
  });

  it('半填的列顯示 incomplete 警告，且不寫入設定', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ credentials: ENV_VARS } as ClaudeSettings['sandbox'], onSave);

    addPair();
    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.change(input(0, 'accessKeyIdVar'), { target: { value: 'MY_KEY_ID' } });
    fireEvent.blur(input(0, 'accessKeyIdVar'));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert').map((a) => a.textContent ?? '');
      expect(alerts.some((tx) => /not saved/.test(tx))).toBe(true);
    });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('SandboxEditor — credentials.awsPairs draft 保留 / 無意義存檔', () => {
  it('存檔後 props 回灌不抹掉其他列尚未填完的輸入', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET' }],
      },
    } as ClaudeSettings['sandbox'], onSave);

    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    // 半填的第二列
    addPair();
    await waitFor(() => expect(input(1, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.change(input(1, 'accessKeyIdVar'), { target: { value: 'HALF_FILLED' } });

    // 改第一列並 blur → 觸發存檔
    fireEvent.change(input(0, 'sessionTokenVar'), { target: { value: 'MY_TOKEN' } });
    fireEvent.blur(input(0, 'sessionTokenVar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    // props 回灌新的 awsPairs
    rerender(
      <I18nProvider locale="en">
      <ToastProvider>
        <SandboxEditor
          sandbox={{
            credentials: {
              ...ENV_VARS,
              awsPairs: [{ accessKeyIdVar: 'MY_KEY_ID', secretAccessKeyVar: 'MY_SECRET', sessionTokenVar: 'MY_TOKEN' }],
            },
          } as ClaudeSettings['sandbox']}
          scope="user"
          onSave={onSave}
          onDelete={vi.fn()}
        />
      </ToastProvider>
      </I18nProvider>,
    );

    await waitFor(() => expect(input(0, 'sessionTokenVar').value).toBe('MY_TOKEN'));
    expect(input(1, 'accessKeyIdVar')).not.toBeNull();
    expect(input(1, 'accessKeyIdVar').value).toBe('HALF_FILLED');
  });

  it('sessionTokenVar 為空字串的既有 pair：純 focus→blur 不觸發存檔', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({
      credentials: {
        ...ENV_VARS,
        awsPairs: [
          { sessionTokenVar: '', secretAccessKeyVar: 'MY_SECRET', accessKeyIdVar: 'MY_KEY_ID' } as any,
        ],
      },
    } as ClaudeSettings['sandbox'], onSave);

    await waitFor(() => expect(input(0, 'accessKeyIdVar')).not.toBeNull());
    fireEvent.blur(input(0, 'accessKeyIdVar'));
    fireEvent.blur(input(0, 'sessionTokenVar'));
    await new Promise((r) => setTimeout(r, 20));
    expect(onSave).not.toHaveBeenCalled();
  });
});
