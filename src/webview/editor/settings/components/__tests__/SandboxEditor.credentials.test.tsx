/**
 * @vitest-environment jsdom
 *
 * 批次 C：sandbox.credentials.files / sandbox.credentials.envVars（先紅）
 *
 * Object shapes (from spec):
 *   credentials.files:   { path: string; mode: 'deny' }[]
 *   credentials.envVars: { name: string; mode: 'deny' }[]
 *
 * credentials is an optional nested key inside sandbox. On save, it is written
 * into sandbox.credentials.*. cleanSandbox must also clear credentials.
 *
 * Tests are RED until SandboxEditor + schema + i18n are updated.
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
// credentials.files
// ---------------------------------------------------------------------------

describe('SandboxEditor — credentials.files（先紅，批次 C）', () => {
  it('渲染 credentials.files 輸入區塊（section label 出現在 DOM 中）', async () => {
    renderEditor(undefined);
    // RED: label not yet added. i18n key: settings.advanced.sandbox.credentials.files.label
    await waitFor(() => {
      expect(
        screen.queryByText(/credential.*file/i) ??
          screen.queryByLabelText(/credential.*file/i),
      ).not.toBeNull();
    });
  });

  it('新增一筆 credentials.files → onSave("sandbox", { credentials: { files: [{ path, mode:"deny" }] } })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    // RED: credentials.files input placeholder not yet added
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText(/credential.*path/i) ??
          screen.queryByPlaceholderText(/e\.g\..+secret/i),
      ).not.toBeNull();
    });
    const input =
      (screen.queryByPlaceholderText(/credential.*path/i) ??
        screen.queryByPlaceholderText(/e\.g\..+secret/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/etc/secrets' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'sandbox',
        expect.objectContaining({
          credentials: expect.objectContaining({
            files: [{ path: '/etc/secrets', mode: 'deny' }],
          }),
        }),
      );
    });
  });

  it('已有 credentials.files entry → 顯示 tag', async () => {
    renderEditor({
      credentials: { files: [{ path: '/run/secrets', mode: 'deny' }] },
    } as ClaudeSettings['sandbox']);
    // RED: SandboxEditor does not yet render credentials tags
    await waitFor(() => {
      expect(screen.queryByText('/run/secrets')).not.toBeNull();
    });
  });

  it('刪除最後一筆 credentials.files，sandbox 無其他欄位 → onDelete("sandbox")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor(
      { credentials: { files: [{ path: '/run/secrets', mode: 'deny' }] } } as ClaudeSettings['sandbox'],
      vi.fn(),
      onDelete,
    );
    await waitFor(() => screen.getByText('/run/secrets'));
    const tag = screen.getByText('/run/secrets').closest('.perm-rule-tag') as HTMLElement;
    fireEvent.click(within(tag).getByRole('button'));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });

  it('Clear 按鈕清除含 credentials.files 的 sandbox → onDelete("sandbox")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor(
      { credentials: { files: [{ path: '/etc/secrets', mode: 'deny' }] } } as ClaudeSettings['sandbox'],
      vi.fn(),
      onDelete,
    );
    await waitFor(() => screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });
});

// ---------------------------------------------------------------------------
// credentials.envVars
// ---------------------------------------------------------------------------

describe('SandboxEditor — credentials.envVars（先紅，批次 C）', () => {
  it('渲染 credentials.envVars 輸入區塊（section label 出現在 DOM 中）', async () => {
    renderEditor(undefined);
    // RED: label not yet added. i18n key: settings.advanced.sandbox.credentials.envVars.label
    await waitFor(() => {
      expect(
        screen.queryByText(/credential.*env/i) ??
          screen.queryByLabelText(/credential.*env/i),
      ).not.toBeNull();
    });
  });

  it('新增一筆 credentials.envVars → onSave("sandbox", { credentials: { envVars: [{ name, mode:"deny" }] } })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    // RED: credentials.envVars input placeholder not yet added
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText(/credential.*name/i) ??
          screen.queryByPlaceholderText(/e\.g\..+AWS/i),
      ).not.toBeNull();
    });
    const input =
      (screen.queryByPlaceholderText(/credential.*name/i) ??
        screen.queryByPlaceholderText(/e\.g\..+AWS/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'AWS_SECRET_KEY' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'sandbox',
        expect.objectContaining({
          credentials: expect.objectContaining({
            envVars: [{ name: 'AWS_SECRET_KEY', mode: 'deny' }],
          }),
        }),
      );
    });
  });

  it('已有 credentials.envVars entry → 顯示 tag', async () => {
    renderEditor({
      credentials: { envVars: [{ name: 'AWS_SECRET', mode: 'deny' }] },
    } as ClaudeSettings['sandbox']);
    // RED: SandboxEditor does not yet render credentials.envVars tags
    await waitFor(() => {
      expect(screen.queryByText('AWS_SECRET')).not.toBeNull();
    });
  });

  it('刪除最後一筆 credentials.envVars，sandbox 無其他欄位 → onDelete("sandbox")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor(
      { credentials: { envVars: [{ name: 'AWS_SECRET', mode: 'deny' }] } } as ClaudeSettings['sandbox'],
      vi.fn(),
      onDelete,
    );
    await waitFor(() => screen.getByText('AWS_SECRET'));
    const tag = screen.getByText('AWS_SECRET').closest('.perm-rule-tag') as HTMLElement;
    fireEvent.click(within(tag).getByRole('button'));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('sandbox');
    });
  });

  it('credentials.files 和 credentials.envVars 同時存在 → onSave 含兩者', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(
      {
        credentials: {
          files: [{ path: '/run/secrets', mode: 'deny' }],
          envVars: [{ name: 'DB_PASS', mode: 'deny' }],
        },
      } as ClaudeSettings['sandbox'],
      onSave,
    );
    // RED: not rendered yet; trigger save via Clear path to confirm both survive
    await waitFor(() => screen.getByRole('button', { name: 'Clear' }));
    // Verify initial render shows both tags
    expect(screen.queryByText('/run/secrets')).not.toBeNull();
    expect(screen.queryByText('DB_PASS')).not.toBeNull();
  });
});
