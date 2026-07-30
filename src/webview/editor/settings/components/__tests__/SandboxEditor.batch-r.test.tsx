/**
 * @vitest-environment jsdom
 *
 * 批次 R SandboxEditor 先紅測試
 *
 * filesystem 區新增 disabled toggle、network 區新增 strictAllowlist toggle。
 * 斷言控件 render 出來、且 toggle 後以正確巢狀 shape save：
 *   onSave('sandbox', { filesystem: { disabled: true } })
 *   onSave('sandbox', { network: { strictAllowlist: true } })
 *
 * accessible name 不寫死文案：從 en locale 取值，i18n key 還不存在時用 sentinel
 * 兜住（getByRole name: undefined 會匹配到所有 checkbox，紅因會變成
 * "found multiple elements" 這種糊掉的訊息）。sentinel 讓紅因明確是
 * 「找不到名為 __MISSING_I18N__ 的 checkbox」。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { SandboxEditor } from '../SandboxEditor';
import type { ClaudeSettings } from '../../../../../shared/types';
import { en } from '../../../../i18n/locales/en';

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

const locale = en as Record<string, string>;
const MISSING = '__MISSING_I18N__';
const FS_DISABLED_LABEL = locale['settings.advanced.sandbox.filesystem.disabled'] ?? MISSING;
const NET_STRICT_LABEL = locale['settings.advanced.sandbox.network.strictAllowlist'] ?? MISSING;

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

// ---------------------------------------------------------------------------
// filesystem.disabled
// ---------------------------------------------------------------------------

describe('SandboxEditor — filesystem.disabled toggle（批次 R，先紅）', () => {
  it('render 出 filesystem disabled checkbox，未設定 → unchecked', async () => {
    renderEditor(undefined);
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: FS_DISABLED_LABEL }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('sandbox.filesystem.disabled=true → checkbox checked', async () => {
    renderEditor({ filesystem: { disabled: true } } as ClaudeSettings['sandbox']);
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: FS_DISABLED_LABEL }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('toggle on → onSave("sandbox", { filesystem: { disabled: true } })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: FS_DISABLED_LABEL }));
    fireEvent.click(screen.getByRole('checkbox', { name: FS_DISABLED_LABEL }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', { filesystem: { disabled: true } });
    });
  });

  it('既有 filesystem 欄位保留，不被 toggle 覆蓋', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ filesystem: { allowWrite: ['/tmp'] } }, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: FS_DISABLED_LABEL }));
    fireEvent.click(screen.getByRole('checkbox', { name: FS_DISABLED_LABEL }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', {
        filesystem: { allowWrite: ['/tmp'], disabled: true },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// network.strictAllowlist
// ---------------------------------------------------------------------------

describe('SandboxEditor — network.strictAllowlist toggle（批次 R，先紅）', () => {
  it('render 出 network strictAllowlist checkbox，未設定 → unchecked', async () => {
    renderEditor(undefined);
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: NET_STRICT_LABEL }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('sandbox.network.strictAllowlist=true → checkbox checked', async () => {
    renderEditor({ network: { strictAllowlist: true } } as ClaudeSettings['sandbox']);
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: NET_STRICT_LABEL }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('toggle on → onSave("sandbox", { network: { strictAllowlist: true } })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: NET_STRICT_LABEL }));
    fireEvent.click(screen.getByRole('checkbox', { name: NET_STRICT_LABEL }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', { network: { strictAllowlist: true } });
    });
  });

  it('既有 network 欄位保留，不被 toggle 覆蓋', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ network: { deniedDomains: ['internal.example.com'] } }, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: NET_STRICT_LABEL }));
    fireEvent.click(screen.getByRole('checkbox', { name: NET_STRICT_LABEL }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', {
        network: { deniedDomains: ['internal.example.com'], strictAllowlist: true },
      });
    });
  });
});
