/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { GeneralSection } from '../GeneralSection';
import { ToastProvider } from '../../../components/Toast';
import { I18nProvider } from '../../../i18n/I18nContext';

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
      <GeneralSection scope={scope} settings={settings as any} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('GeneralSection — 渲染', () => {
  it('顯示 Effort Level 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Effort Level')).toBeTruthy());
  });

  it('顯示 Language 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Language')).toBeTruthy());
  });

  it('顯示 Available Models Whitelist 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Available Models Whitelist')).toBeTruthy());
  });

  it('顯示 Fast Mode toggle', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Fast Mode')).toBeTruthy());
  });

  it('顯示 Output Style 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Output Style')).toBeTruthy());
  });

  it('availableModels 為空 → 顯示 empty placeholder', async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByText('No whitelist set (all models allowed)')).toBeTruthy(),
    );
  });

  it('availableModels 有值 → 顯示 tag', async () => {
    renderSection({ availableModels: ['claude-sonnet-4-6'] });
    await waitFor(() => expect(screen.getByText('claude-sonnet-4-6')).toBeTruthy());
  });

  it('所有必要 boolean toggle 都有 checkbox（語義斷言）', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Enable All Project MCP Servers' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Fast Mode' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Always Thinking Enabled' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Auto Memory' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' })).toBeTruthy();
    });
  });

  it('各欄位顯示 description 說明文字', async () => {
    renderSection();
    await waitFor(() => {
      // effortLevel description
      expect(screen.getByText(/Adaptive reasoning level/i)).toBeTruthy();
      // language description
      expect(screen.getByText(/language preference/i)).toBeTruthy();
      // availableModels description
      expect(screen.getByText(/Restrict available models/i)).toBeTruthy();
      // fastMode description
      expect(screen.getByText(/Faster output speed/i)).toBeTruthy();
    });
  });

  it('description <p> 在 label 外部（不是 label 的子元素）', async () => {
    const { container } = renderSection({});
    await waitFor(() => screen.getAllByRole('checkbox'));
    const labels = container.querySelectorAll('label.hooks-toggle-label');
    labels.forEach((label) => {
      expect(label.querySelector('.settings-field-description')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// BooleanToggle 互動
// ---------------------------------------------------------------------------

describe('GeneralSection — BooleanToggle 互動', () => {
  it('fastMode 未設定 → checkbox unchecked', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Fast Mode' }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('fastMode: true → checkbox checked', async () => {
    renderSection({ fastMode: true });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Fast Mode' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('toggle off→on → 呼叫 onSave("fastMode", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fastMode', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('toggle on→off → 呼叫 onSave("fastMode", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fastMode: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fastMode', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('toggle 期間 checkbox disabled', async () => {
    let resolveToggle!: () => void;
    const onSave = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveToggle = r; }));
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode' }));

    await waitFor(() => {
      expect((screen.getByRole('checkbox', { name: 'Fast Mode' }) as HTMLInputElement).disabled).toBe(true);
    });

    resolveToggle();
  });

  it('alwaysThinkingEnabled toggle off→on → 呼叫 onSave("alwaysThinkingEnabled", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Always Thinking Enabled' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Always Thinking Enabled' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('alwaysThinkingEnabled', true);
    });
  });

  it('autoMemoryEnabled=true, toggle off → onSave("autoMemoryEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoMemoryEnabled: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto Memory' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto Memory' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoMemoryEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('fastModePerSessionOptIn 未設定, toggle on → onSave("fastModePerSessionOptIn", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fastModePerSessionOptIn', true);
    });
  });

  it('autoMemoryEnabled 未設定, toggle on → onSave("autoMemoryEnabled", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto Memory' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto Memory' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoMemoryEnabled', true);
    });
  });

  it('fastModePerSessionOptIn=true, toggle off → onSave("fastModePerSessionOptIn", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fastModePerSessionOptIn: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fastModePerSessionOptIn', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// BooleanToggle Reset 按鈕
// ---------------------------------------------------------------------------

describe('GeneralSection — BooleanToggle Reset 按鈕', () => {
  it('fastMode 未設定 → 無 Reset 按鈕', async () => {
    renderSection({});
    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    const field = screen.getByRole('checkbox', { name: 'Fast Mode' }).closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: /Reset/ })).toBeNull();
  });

  it('fastMode=true → Reset 按鈕顯示，點擊 → onDelete("fastMode")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fastMode: true }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    const field = screen.getByRole('checkbox', { name: 'Fast Mode' }).closest('.settings-field') as HTMLElement;
    const resetBtn = within(field).getByRole('button', { name: /Reset/ });
    expect(resetBtn).toBeTruthy();
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fastMode');
    });
  });

  it('fastMode=false → Reset 按鈕顯示，點擊 → onDelete("fastMode")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fastMode: false }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    const field = screen.getByRole('checkbox', { name: 'Fast Mode' }).closest('.settings-field') as HTMLElement;
    const resetBtn = within(field).getByRole('button', { name: /Reset/ });
    expect(resetBtn).toBeTruthy();
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fastMode');
    });
  });
});

// ---------------------------------------------------------------------------
// EnumDropdown 互動
// ---------------------------------------------------------------------------

describe('GeneralSection — EnumDropdown 互動', () => {
  it('effortLevel 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[0].value).toBe('');
    });
  });

  it('effortLevel: "high" → select 顯示 high', async () => {
    renderSection({ effortLevel: 'high' });
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[0].value).toBe('high');
    });
  });

  it('選擇 effortLevel "medium" → 呼叫 onSave("effortLevel", "medium")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'medium' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('effortLevel', 'medium');
    });
  });

  it('選擇 effortLevel "" (notSet) → 呼叫 onDelete("effortLevel")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ effortLevel: 'high' }, vi.fn(), onDelete);

    await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('effortLevel');
    });
  });

  it('未知 effortLevel → 顯示 __unknown__ disabled option（含 ⚠️）', async () => {
    renderSection({ effortLevel: 'max' as any });
    await waitFor(() => {
      expect(screen.getByText(/Current value: max/)).toBeTruthy();
    });
  });

  it('outputStyle: "auto" → 第二個 select 顯示 auto', async () => {
    renderSection({ outputStyle: 'auto' });
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[1].value).toBe('auto');
    });
  });

  it('選擇 outputStyle "stream-json" → 呼叫 onSave("outputStyle", "stream-json")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'stream-json' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('outputStyle', 'stream-json');
    });
  });

  it('顯示 Auto Updates Channel dropdown', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Auto Updates Channel')).toBeTruthy());
  });

  it('autoUpdatesChannel 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Auto Updates Channel' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('autoUpdatesChannel 未設定, 選擇 stable → onSave("autoUpdatesChannel", "stable")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Auto Updates Channel' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Auto Updates Channel' }), { target: { value: 'stable' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoUpdatesChannel', 'stable');
    });
  });

  it('autoUpdatesChannel="latest", 選空值 → onDelete("autoUpdatesChannel")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoUpdatesChannel: 'latest' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Auto Updates Channel' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Auto Updates Channel' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('autoUpdatesChannel');
    });
  });

  it('autoUpdatesChannel="stable" → select 顯示 stable', async () => {
    renderSection({ autoUpdatesChannel: 'stable' });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Auto Updates Channel' }) as HTMLSelectElement;
      expect(select.value).toBe('stable');
    });
  });

  it('autoUpdatesChannel 未設定, 選擇 latest → onSave("autoUpdatesChannel", "latest")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Auto Updates Channel' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Auto Updates Channel' }), { target: { value: 'latest' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoUpdatesChannel', 'latest');
    });
  });

  it('未知 autoUpdatesChannel → 顯示 ⚠️ option', async () => {
    renderSection({ autoUpdatesChannel: 'beta' as any });
    await waitFor(() => {
      expect(screen.getByText(/Current value: beta/)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// TextSetting 互動
// ---------------------------------------------------------------------------

describe('GeneralSection — TextSetting 互動', () => {
  it('language 未設定 → input 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  it('language 已設定 → input 顯示值', async () => {
    renderSection({ language: 'zh-TW' });
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement;
      expect(input.value).toBe('zh-TW');
    });
  });

  it('輸入值後點擊 Save → 呼叫 onSave("language", trimmed)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));
    const langField = screen.getByPlaceholderText('e.g. zh-TW').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. zh-TW'), { target: { value: '台灣繁體中文' } });
    fireEvent.click(within(langField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('language', '台灣繁體中文');
    });
  });

  it('language 已設定時顯示 Clear 按鈕', async () => {
    renderSection({ language: 'zh-TW' });
    await waitFor(() => {
      const langField = screen.getByPlaceholderText('e.g. zh-TW').closest('.settings-field') as HTMLElement;
      expect(within(langField).getByRole('button', { name: 'Clear' })).toBeTruthy();
    });
  });

  it('點擊 Clear → 呼叫 onDelete("language")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ language: 'zh-TW' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));
    const langField = screen.getByPlaceholderText('e.g. zh-TW').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(langField).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('language');
    });
  });

  it('輸入空字串後點擊 Save → 呼叫 onDelete("language")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ language: 'zh-TW' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));
    const langField = screen.getByPlaceholderText('e.g. zh-TW').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. zh-TW'), { target: { value: '' } });
    fireEvent.click(within(langField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('language');
    });
  });

  it('scope 切換 → input 重設為新 settings 的值', async () => {
    const { rerender } = renderSection({ language: 'en' });

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement;
      expect(input.value).toBe('en');
    });

    rerender(
      <I18nProvider locale="en">
        <ToastProvider>
          <GeneralSection
            scope="project"
            settings={{ language: 'ja' } as any}
            onSave={vi.fn()}
            onDelete={vi.fn()}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement;
      expect(input.value).toBe('ja');
    });
  });
});

// ---------------------------------------------------------------------------
// TagInput 互動
// ---------------------------------------------------------------------------

describe('GeneralSection — TagInput 互動', () => {
  it('availableModels 空 → 顯示 empty placeholder', async () => {
    renderSection({});
    await waitFor(() =>
      expect(screen.getByText('No whitelist set (all models allowed)')).toBeTruthy(),
    );
  });

  it('新增 tag → 呼叫 onSave("availableModels", [newTag])', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. claude-sonnet-4-6'));
    fireEvent.change(screen.getByPlaceholderText('e.g. claude-sonnet-4-6'), { target: { value: 'claude-opus-4-6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('availableModels', ['claude-opus-4-6']);
    });
  });

  it('已有 tags → 新增 tag → onSave 帶完整陣列', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ availableModels: ['claude-sonnet-4-6'] }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. claude-sonnet-4-6'));
    fireEvent.change(screen.getByPlaceholderText('e.g. claude-sonnet-4-6'), { target: { value: 'claude-opus-4-6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('availableModels', ['claude-sonnet-4-6', 'claude-opus-4-6']);
    });
  });

  it('刪除 tag → 呼叫 onSave("availableModels", filtered)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ availableModels: ['claude-sonnet-4-6', 'claude-opus-4-6'] }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove claude-sonnet-4-6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove claude-sonnet-4-6' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('availableModels', ['claude-opus-4-6']);
    });
  });

  it('刪除最後一個 tag → onSave 帶空陣列 []（不是 onDelete）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ availableModels: ['claude-sonnet-4-6'] }, onSave, onDelete);

    await waitFor(() => screen.getByRole('button', { name: 'Remove claude-sonnet-4-6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove claude-sonnet-4-6' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('availableModels', []);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('重複 tag → 顯示 duplicate error，不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ availableModels: ['claude-sonnet-4-6'] }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. claude-sonnet-4-6'));
    fireEvent.change(screen.getByPlaceholderText('e.g. claude-sonnet-4-6'), { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Model already in list')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('scope 切換 → inputValue 和 error 清空', async () => {
    const { rerender } = renderSection({});

    await waitFor(() => screen.getByPlaceholderText('e.g. claude-sonnet-4-6'));
    fireEvent.change(screen.getByPlaceholderText('e.g. claude-sonnet-4-6'), { target: { value: 'claude-opus-4-6' } });

    const input = screen.getByPlaceholderText('e.g. claude-sonnet-4-6') as HTMLInputElement;
    expect(input.value).toBe('claude-opus-4-6');

    rerender(
      <I18nProvider locale="en">
        <ToastProvider>
          <GeneralSection
            scope="project"
            settings={{} as any}
            onSave={vi.fn()}
            onDelete={vi.fn()}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      const resetInput = screen.getByPlaceholderText('e.g. claude-sonnet-4-6') as HTMLInputElement;
      expect(resetInput.value).toBe('');
    });
  });

  it('Enter 鍵新增 tag', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. claude-sonnet-4-6'));
    const input = screen.getByPlaceholderText('e.g. claude-sonnet-4-6');
    fireEvent.change(input, { target: { value: 'claude-haiku-4-5-20251001' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('availableModels', ['claude-haiku-4-5-20251001']);
    });
  });
});

// ---------------------------------------------------------------------------
// NumberSetting 互動
// ---------------------------------------------------------------------------

describe('GeneralSection — NumberSetting 互動', () => {
  it('顯示 Cleanup Period Days 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Cleanup Period Days')).toBeTruthy());
  });

  it('cleanupPeriodDays 未設定 → input 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const input = screen.getByPlaceholderText('30') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  it('cleanupPeriodDays 未設定, 輸入 60 並儲存 → onSave("cleanupPeriodDays", 60)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('30'));
    const cleanupField = screen.getByPlaceholderText('30').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '60' } });
    fireEvent.click(within(cleanupField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('cleanupPeriodDays', 60);
    });
  });

  it('cleanupPeriodDays=30, 清除 → onDelete("cleanupPeriodDays")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ cleanupPeriodDays: 30 }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('30'));
    const cleanupField = screen.getByPlaceholderText('30').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(cleanupField).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('cleanupPeriodDays');
    });
  });

  it('cleanupPeriodDays < 0 → save 按鈕 disabled', async () => {
    renderSection({});

    await waitFor(() => screen.getByPlaceholderText('30'));
    const cleanupField = screen.getByPlaceholderText('30').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '-1' } });

    await waitFor(() => {
      expect((within(cleanupField).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('cleanupPeriodDays=0（停用清理）→ input 顯示 0，onSave("cleanupPeriodDays", 0)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ cleanupPeriodDays: 0 }, onSave);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('30') as HTMLInputElement;
      expect(input.value).toBe('0');
    });

    const cleanupField = screen.getByPlaceholderText('30').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(cleanupField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('cleanupPeriodDays', 0);
    });
  });
});
