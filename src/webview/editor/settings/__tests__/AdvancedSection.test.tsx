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

const COMMIT_PLACEHOLDER = 'e.g. Co-Authored-By: Claude <noreply@anthropic.com>';
const PR_PLACEHOLDER = 'e.g. 🤖 Generated with Claude';

describe('AdvancedSection — 渲染', () => {
  it.each([
    'Force Login Method',
    'Force Login Org UUID',
    'Skip WebFetch Preflight',
    'Attribution',
    'Status Line',
    'File Suggestion Command',
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
// BooleanToggle — skipWebFetchPreflight
// ---------------------------------------------------------------------------

describe('AdvancedSection — skipWebFetchPreflight toggle', () => {
  it('skipWebFetchPreflight 未設定 → checkbox 未勾選', () => {
    renderSection({});
    const field = screen.getByText('Skip WebFetch Preflight').closest('.settings-field') as HTMLElement;
    const checkbox = within(field).getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('skipWebFetchPreflight=false → checkbox 未勾選', () => {
    renderSection({ skipWebFetchPreflight: false });
    const field = screen.getByText('Skip WebFetch Preflight').closest('.settings-field') as HTMLElement;
    const checkbox = within(field).getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('skipWebFetchPreflight=true → checkbox 勾選', () => {
    renderSection({ skipWebFetchPreflight: true });
    const field = screen.getByText('Skip WebFetch Preflight').closest('.settings-field') as HTMLElement;
    const checkbox = within(field).getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('skipWebFetchPreflight 未設定, toggle on → onSave("skipWebFetchPreflight", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    const field = screen.getByText('Skip WebFetch Preflight').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('skipWebFetchPreflight', true);
    });
  });

  it('skipWebFetchPreflight=true, toggle off → onDelete("skipWebFetchPreflight"), onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ skipWebFetchPreflight: true }, onSave, onDelete);
    const field = screen.getByText('Skip WebFetch Preflight').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('skipWebFetchPreflight');
      expect(onSave).not.toHaveBeenCalled();
    });
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

// ---------------------------------------------------------------------------
// Attribution compound editor
// ---------------------------------------------------------------------------

describe('AdvancedSection — attribution 物件編輯器', () => {
  it('attribution 未設定 → commit/pr inputs 為空', () => {
    renderSection({});
    expect((screen.getByPlaceholderText(COMMIT_PLACEHOLDER) as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText(PR_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('attribution={commit: "Co-Authored-By: Claude"} → commit input 顯示值', () => {
    renderSection({ attribution: { commit: 'Co-Authored-By: Claude' } });
    expect((screen.getByPlaceholderText(COMMIT_PLACEHOLDER) as HTMLInputElement).value).toBe('Co-Authored-By: Claude');
    expect((screen.getByPlaceholderText(PR_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('輸入 commit 並儲存 → onSave("attribution", { commit })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const attrField = screen.getByPlaceholderText(COMMIT_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(COMMIT_PLACEHOLDER), { target: { value: 'Co-Authored-By: Claude' } });
    fireEvent.click(within(attrField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('attribution', { commit: 'Co-Authored-By: Claude' });
    });
  });

  it('attribution={commit: "x", pr: "y"} 清空 pr 並儲存 → onSave("attribution", { commit: "x" })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ attribution: { commit: 'x', pr: 'y' } }, onSave);

    const attrField = screen.getByPlaceholderText(COMMIT_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(PR_PLACEHOLDER), { target: { value: '' } });
    fireEvent.click(within(attrField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('attribution', { commit: 'x' });
    });
  });

  it('兩個欄位都清空並儲存 → onDelete("attribution")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ attribution: { commit: 'x', pr: 'y' } }, onSave, onDelete);

    const attrField = screen.getByPlaceholderText(COMMIT_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(COMMIT_PLACEHOLDER), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText(PR_PLACEHOLDER), { target: { value: '' } });
    fireEvent.click(within(attrField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('attribution');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// statusLine 物件編輯器
// ---------------------------------------------------------------------------

const CMD_PLACEHOLDER = 'e.g. date +%H:%M';
const PAD_PLACEHOLDER = 'e.g. 1';

describe('AdvancedSection — statusLine 物件編輯器', () => {
  it('statusLine 未設定 → command/padding inputs 為空', () => {
    renderSection({});
    expect((screen.getByPlaceholderText(CMD_PLACEHOLDER) as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText(PAD_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('statusLine={command:"date"} → command input 顯示值，padding 為空', () => {
    renderSection({ statusLine: { type: 'command', command: 'date' } });
    expect((screen.getByPlaceholderText(CMD_PLACEHOLDER) as HTMLInputElement).value).toBe('date');
    expect((screen.getByPlaceholderText(PAD_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('statusLine={command:"date", padding:2} → 兩個 input 都顯示值', () => {
    renderSection({ statusLine: { type: 'command', command: 'date', padding: 2 } });
    expect((screen.getByPlaceholderText(CMD_PLACEHOLDER) as HTMLInputElement).value).toBe('date');
    expect((screen.getByPlaceholderText(PAD_PLACEHOLDER) as HTMLInputElement).value).toBe('2');
  });

  it('未設定，只輸入 command 並 Save → onSave("statusLine", { type:"command", command:"date +%H:%M" }) 無 padding', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(CMD_PLACEHOLDER), { target: { value: 'date +%H:%M' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('statusLine', { type: 'command', command: 'date +%H:%M' });
      expect((onSave.mock.calls[0][1] as Record<string, unknown>)).not.toHaveProperty('padding');
    });
  });

  it('輸入 command + padding=2 並 Save → onSave("statusLine", { type:"command", command:"...", padding:2 })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(CMD_PLACEHOLDER), { target: { value: 'date +%H:%M' } });
    fireEvent.change(screen.getByPlaceholderText(PAD_PLACEHOLDER), { target: { value: '2' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('statusLine', { type: 'command', command: 'date +%H:%M', padding: 2 });
    });
  });

  it('statusLine 有值，點 Clear → onDelete("statusLine")，onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ statusLine: { type: 'command', command: 'date' } }, onSave, onDelete);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('statusLine');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('padding 清空後 Save → onSave value 無 padding key', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ statusLine: { type: 'command', command: 'date', padding: 3 } }, onSave);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(PAD_PLACEHOLDER), { target: { value: '' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('statusLine', { type: 'command', command: 'date' });
      expect((onSave.mock.calls[0][1] as Record<string, unknown>)).not.toHaveProperty('padding');
    });
  });

  it('statusLine 未設定時 Clear 按鈕不顯示', () => {
    renderSection({});
    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('padding=0 → onSave 含 padding: 0', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(CMD_PLACEHOLDER), { target: { value: 'date' } });
    fireEvent.change(screen.getByPlaceholderText(PAD_PLACEHOLDER), { target: { value: '0' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('statusLine', { type: 'command', command: 'date', padding: 0 });
    });
  });

  it('command 清空後按 Save → onDelete("statusLine")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ statusLine: { type: 'command', command: 'date' } }, onSave, onDelete);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(CMD_PLACEHOLDER), { target: { value: '' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('statusLine');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('command 只有空白字元 → onDelete("statusLine")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    const field = screen.getByPlaceholderText(CMD_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(CMD_PLACEHOLDER), { target: { value: '   ' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('statusLine');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('statusLine={command:"x", padding:0} → padding input 顯示 "0"', () => {
    renderSection({ statusLine: { type: 'command', command: 'x', padding: 0 } });
    expect((screen.getByPlaceholderText(PAD_PLACEHOLDER) as HTMLInputElement).value).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// fileSuggestion 物件編輯器
// ---------------------------------------------------------------------------

const FILE_SUG_PLACEHOLDER = 'e.g. bash ~/suggest.sh';

describe('AdvancedSection — fileSuggestion 物件編輯器', () => {
  it('fileSuggestion 未設定 → command input 為空', () => {
    renderSection({});
    expect((screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('fileSuggestion={type:"command", command:"bash ~/suggest.sh"} → input 顯示值', () => {
    renderSection({ fileSuggestion: { type: 'command', command: 'bash ~/suggest.sh' } });
    expect((screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER) as HTMLInputElement).value).toBe('bash ~/suggest.sh');
  });

  it('fileSuggestion 未設定 → Clear 按鈕不顯示', () => {
    renderSection({});
    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('fileSuggestion 有值 → Clear 按鈕顯示', () => {
    renderSection({ fileSuggestion: { type: 'command', command: 'bash ~/suggest.sh' } });
    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    expect(within(field).getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('未設定，輸入 command 並儲存 → onSave("fileSuggestion", { type:"command", command:"bash ~/suggest.sh" })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER), { target: { value: 'bash ~/suggest.sh' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fileSuggestion', { type: 'command', command: 'bash ~/suggest.sh' });
    });
  });

  it('有值時點 Clear → onDelete("fileSuggestion")，onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fileSuggestion: { type: 'command', command: 'bash ~/suggest.sh' } }, onSave, onDelete);

    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fileSuggestion');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('command 清空後按 Save → onDelete("fileSuggestion")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fileSuggestion: { type: 'command', command: 'bash ~/suggest.sh' } }, onSave, onDelete);

    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER), { target: { value: '' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fileSuggestion');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // 邊界測試
  it('command 只有空白字元 → onDelete("fileSuggestion")，onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER), { target: { value: '   \t\n  ' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fileSuggestion');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it("command 含單引號/雙引號/反斜線 → onSave 保留完整原始字串", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const rawCommand = `bash -c 'echo "hello"' \\ path/to/script`;
    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER), { target: { value: rawCommand } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fileSuggestion', { type: 'command', command: rawCommand });
    });
  });

  it('command 含 unicode 及 emoji → onSave 保留完整原始字串', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const unicodeCommand = '~/腳本/建議.sh 🚀 --flag=值';
    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER), { target: { value: unicodeCommand } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fileSuggestion', { type: 'command', command: unicodeCommand });
    });
  });

  it('command 超長字串（1000+ 字元）→ onSave 完整保留', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const longCommand = 'bash ' + 'a'.repeat(1000) + '.sh';
    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER), { target: { value: longCommand } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fileSuggestion', { type: 'command', command: longCommand });
    });
  });

  it('連續多次 change 後只按一次 Save → onSave 只呼叫一次，值為最後輸入', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const input = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER);
    const field = input.closest('.settings-field') as HTMLElement;

    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.change(input, { target: { value: 'second' } });
    fireEvent.change(input, { target: { value: 'bash ~/final.sh' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('fileSuggestion', { type: 'command', command: 'bash ~/final.sh' });
    });
  });

  it('有值時連續快速點兩次 Clear → onDelete 只呼叫一次（saving 防護）', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fileSuggestion: { type: 'command', command: 'bash ~/suggest.sh' } }, vi.fn(), onDelete);

    const field = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER).closest('.settings-field') as HTMLElement;
    const clearButton = within(field).getByRole('button', { name: 'Clear' });

    fireEvent.click(clearButton);
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith('fileSuggestion');
    });
  });

  it('fileSuggestion={type:"command", command:""} → input 為空，Clear 按鈕不顯示', () => {
    renderSection({ fileSuggestion: { type: 'command', command: '' } });
    const input = screen.getByPlaceholderText(FILE_SUG_PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('');
    const field = input.closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});
