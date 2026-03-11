/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { AdvancedSection } from '../AdvancedSection';
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
      <AdvancedSection scope={scope} settings={settings as any} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('AdvancedSection — 渲染', () => {
  it.each([
    'Force Login Method',
    'Force Login Org UUID',
    'Plans Directory',
    'API Key Helper',
    'OTEL Headers Helper',
    'AWS Credential Export',
    'AWS Auth Refresh',
  ])('顯示 %s 欄位', (label) => {
    renderSection();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('apiKeyHelper 有值時顯示值於 input', () => {
    renderSection({ apiKeyHelper: './get-key.sh' });
    const input = screen.getByPlaceholderText('e.g. ./scripts/get-api-key.sh') as HTMLInputElement;
    expect(input.value).toBe('./get-key.sh');
  });

  it('未設定時 Clear 按鈕不顯示', () => {
    renderSection({});
    const field = screen.getByPlaceholderText('e.g. ./plans').closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EnumDropdown 互動 — forceLoginMethod
// ---------------------------------------------------------------------------

describe('AdvancedSection — forceLoginMethod EnumDropdown', () => {
  it('forceLoginMethod 未設定 → select value 為空', () => {
    renderSection({});
    const select = screen.getByRole('combobox', { name: 'Force Login Method' }) as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('forceLoginMethod 未設定, 選擇 claudeai → onSave("forceLoginMethod", "claudeai")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    fireEvent.change(screen.getByRole('combobox', { name: 'Force Login Method' }), { target: { value: 'claudeai' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('forceLoginMethod', 'claudeai');
    });
  });

  it('forceLoginMethod="console", 選擇空值 → onDelete("forceLoginMethod")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ forceLoginMethod: 'console' }, vi.fn(), onDelete);

    fireEvent.change(screen.getByRole('combobox', { name: 'Force Login Method' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('forceLoginMethod');
    });
  });

  it('forceLoginMethod="console" → select 顯示 console', () => {
    renderSection({ forceLoginMethod: 'console' });
    const select = screen.getByRole('combobox', { name: 'Force Login Method' }) as HTMLSelectElement;
    expect(select.value).toBe('console');
  });

  it('forceLoginMethod 為未知值 → select 選到 __unknown__ 且顯示警告文字', () => {
    renderSection({ forceLoginMethod: 'sso' as any });
    const select = screen.getByRole('combobox', { name: 'Force Login Method' }) as HTMLSelectElement;
    expect(select.value).toBe('__unknown__');
    expect(screen.getByText('Current value: sso ⚠️')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TextSetting 互動 — forceLoginOrgUUID
// ---------------------------------------------------------------------------

describe('AdvancedSection — forceLoginOrgUUID TextSetting', () => {
  it('forceLoginOrgUUID 未設定, 輸入 UUID 並儲存 → onSave("forceLoginOrgUUID", "uuid")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'));
    const field = screen.getByPlaceholderText('e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), { target: { value: 'abc-123' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('forceLoginOrgUUID', 'abc-123');
    });
  });

  it('forceLoginOrgUUID 有值, 清除 → onDelete("forceLoginOrgUUID")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ forceLoginOrgUUID: 'existing-uuid' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'));
    const field = screen.getByPlaceholderText('e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('forceLoginOrgUUID');
    });
  });
});

// ---------------------------------------------------------------------------
// TextSetting 互動
// ---------------------------------------------------------------------------

describe('AdvancedSection — TextSetting 互動', () => {
  it('plansDirectory 未設定, 輸入 ./plans 並儲存 → onSave("plansDirectory", "./plans")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText('e.g. ./plans').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. ./plans'), { target: { value: './plans' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('plansDirectory', './plans');
    });
  });

  it('apiKeyHelper 有值, 清除 → onDelete("apiKeyHelper")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ apiKeyHelper: './scripts/get-api-key.sh' }, vi.fn(), onDelete);

    const field = screen.getByPlaceholderText('e.g. ./scripts/get-api-key.sh').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('apiKeyHelper');
    });
  });

  it('otelHeadersHelper 未設定, 輸入路徑並儲存 → onSave("otelHeadersHelper", ...)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText('e.g. ./scripts/otel-headers.sh').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. ./scripts/otel-headers.sh'), { target: { value: './otel.sh' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('otelHeadersHelper', './otel.sh');
    });
  });

  it('awsCredentialExport 有值時顯示 Clear 按鈕', () => {
    renderSection({ awsCredentialExport: './aws-creds.sh' });
    const field = screen.getByPlaceholderText('e.g. ./scripts/aws-credentials.sh').closest('.settings-field') as HTMLElement;
    expect(within(field).getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('awsAuthRefresh 未設定, 輸入路徑並儲存 → onSave("awsAuthRefresh", ...)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText('e.g. ./scripts/aws-auth-refresh.sh').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. ./scripts/aws-auth-refresh.sh'), { target: { value: './refresh.sh' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('awsAuthRefresh', './refresh.sh');
    });
  });
});
