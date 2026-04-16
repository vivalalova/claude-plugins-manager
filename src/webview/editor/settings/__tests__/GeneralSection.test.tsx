/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { GeneralSection } from '../GeneralSection';
import { getSectionFieldOrder } from '../../../../shared/claude-settings-schema';
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
  userSettings?: Record<string, unknown>,
) =>
  renderWithI18n(
    <ToastProvider>
      <GeneralSection scope={scope} settings={settings as any} userSettings={userSettings as any} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

const getAvailableModelsField = () =>
  screen.getByText('Available Models Whitelist').closest('.settings-field') as HTMLElement;

const getAvailableModelsInput = () =>
  within(getAvailableModelsField()).getByPlaceholderText('e.g. claude-sonnet-4-6');

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

  it('共用設定欄位顯示 key hint，僅已提供 defaultValue 的欄位顯示預設值', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('(model)')).toBeTruthy();
      expect(screen.getByText('(agent)')).toBeTruthy();
      expect(screen.getByText('(effortLevel: high)')).toBeTruthy();
      expect(screen.getByText('(language)')).toBeTruthy();
      expect(screen.getByText('(availableModels)')).toBeTruthy();
      expect(screen.getByText('(includeGitInstructions: true)')).toBeTruthy();
      expect(screen.getByText('(fastMode: false)')).toBeTruthy();
      expect(screen.getByText('(autoMemoryDirectory)')).toBeTruthy();
      expect(screen.getByText('(cleanupPeriodDays: 30)')).toBeTruthy();
      expect(screen.getByText('(autoUpdatesChannel: latest)')).toBeTruthy();
      expect(screen.getByText('(minimumVersion)')).toBeTruthy();
    });
  });

  it('顯示 Language 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Language')).toBeTruthy());
  });

  it('顯示 Model 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Model')).toBeTruthy());
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

  it('顯示 Agent、Auto Memory Directory、Minimum Version 欄位', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText('Agent')).toBeTruthy();
      expect(screen.getByText('Auto Memory Directory')).toBeTruthy();
      expect(screen.getByText('Minimum Version')).toBeTruthy();
    });
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
      expect(screen.getByRole('checkbox', { name: 'Fast Mode' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Auto Memory' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' })).toBeTruthy();
    });
  });

  it('各欄位顯示 description 說明文字', async () => {
    renderSection();
    await waitFor(() => {
      // effortLevel description
      expect(screen.getByText(/Adaptive reasoning level/i)).toBeTruthy();
      // model description
      expect(screen.getByText(/Default model alias or full model ID/i)).toBeTruthy();
      // language description
      expect(screen.getByText(/language preference/i)).toBeTruthy();
      // availableModels description
      expect(screen.getByText(/Restrict available models/i)).toBeTruthy();
      // fastMode description
      expect(screen.getByText(/Faster output speed/i)).toBeTruthy();
      expect(screen.getByText(/named subagent/i)).toBeTruthy();
      expect(screen.getByText(/auto memory storage/i)).toBeTruthy();
      expect(screen.getByText(/downgrading below this version/i)).toBeTruthy();
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

  it('欄位按 schema 陣列順序渲染（含 defaultMode）', async () => {
    const { container } = renderSection();
    await waitFor(() => {
      const hints = container.querySelectorAll('.settings-key-hint');
      const keys = Array.from(hints).map((el) => {
        const match = el.textContent?.match(/^\((\w+)/);
        return match?.[1] ?? '';
      }).filter(Boolean);
      // defaultMode 已是 general section schema 第一個欄位之一，順序直接由 schema 決定
      expect(keys).toEqual(getSectionFieldOrder('general'));
    });
  });

  it('scope=project + userSettings 有 fastMode → 顯示 override badge', async () => {
    const { container } = renderSection(
      { fastMode: false },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      { fastMode: true },
    );
    await waitFor(() => {
      const badges = container.querySelectorAll('.settings-override-badge');
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].textContent).toContain('User');
    });
  });

  it('scope=user → 無 override badge', async () => {
    const { container } = renderSection(
      { fastMode: true },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'user',
    );
    await waitFor(() => {
      expect(container.querySelector('.settings-override-badge')).toBeNull();
    });
  });

  it('scope=project + 值相同但有明確設定 → 仍顯示 override badge', async () => {
    const { container } = renderSection(
      { fastMode: false },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      { fastMode: false },
    );
    await waitFor(() => {
      const badges = container.querySelectorAll('.settings-override-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('scope=project + userSettings 無對應 key → 該欄位無 override badge', async () => {
    const { container } = renderSection(
      { fastMode: true },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      {},
    );
    await waitFor(() => {
      // userSettings 為空，不應有任何 override badge
      expect(container.querySelector('.settings-override-badge')).toBeNull();
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

  it('toggle on→off → 值等於 default，呼叫 onDelete("fastMode")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fastMode: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fastMode');
      expect(onSave).not.toHaveBeenCalled();
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

  it('autoMemoryEnabled 未設定, toggle off 預設值 → onSave("autoMemoryEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto Memory' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto Memory' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoMemoryEnabled', false);
    });
  });

  it('fastModePerSessionOptIn=true, toggle off → 值等於 default，呼叫 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ fastModePerSessionOptIn: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fast Mode Per-Session Opt-In' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('fastModePerSessionOptIn');
      expect(onSave).not.toHaveBeenCalled();
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

  it('fastMode=false（等於 default）→ 有 Reset 按鈕（有值即顯示）', async () => {
    renderSection({ fastMode: false });
    await waitFor(() => screen.getByRole('checkbox', { name: 'Fast Mode' }));
    const field = screen.getByRole('checkbox', { name: 'Fast Mode' }).closest('.settings-field') as HTMLElement;
    expect(within(field).getByRole('button', { name: /Reset/ })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// EnumDropdown 互動
// ---------------------------------------------------------------------------

describe('GeneralSection — EnumDropdown 互動', () => {
  it('effortLevel 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      // selects[0] = defaultMode, selects[1] = effortLevel
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[1].value).toBe('');
    });
  });

  it('effortLevel: "high" → select 顯示 high', async () => {
    renderSection({ effortLevel: 'high' });
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[1].value).toBe('high');
    });
  });

  it('選擇 effortLevel "medium" → 呼叫 onSave("effortLevel", "medium")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'medium' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('effortLevel', 'medium');
    });
  });

  it('選擇 effortLevel "" (notSet) → 呼叫 onDelete("effortLevel")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ effortLevel: 'high' }, vi.fn(), onDelete);

    await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '' } });

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

  it('outputStyle: "Explanatory" → input 顯示值', async () => {
    renderSection({ outputStyle: 'Explanatory' });
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. Explanatory') as HTMLInputElement;
      expect(input.value).toBe('Explanatory');
    });
  });

  it('輸入 outputStyle 後點擊 Save → 呼叫 onSave("outputStyle", value)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Explanatory'));
    const field = screen.getByPlaceholderText('e.g. Explanatory').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. Explanatory'), { target: { value: 'Learning' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('outputStyle', 'Learning');
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

  it('autoUpdatesChannel 未設定, 選擇 latest（=default）→ onDelete("autoUpdatesChannel")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Auto Updates Channel' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Auto Updates Channel' }), { target: { value: 'latest' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('autoUpdatesChannel');
      expect(onSave).not.toHaveBeenCalled();
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

  it('language 已設定時顯示 Reset 按鈕', async () => {
    renderSection({ language: 'zh-TW' });
    await waitFor(() => {
      const langField = screen.getByPlaceholderText('e.g. zh-TW').closest('.settings-field') as HTMLElement;
      expect(within(langField).getByRole('button', { name: /Reset/ })).toBeTruthy();
    });
  });

  it('點擊 Reset → 呼叫 onDelete("language")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ language: 'zh-TW' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));
    const langField = screen.getByPlaceholderText('e.g. zh-TW').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(langField).getByRole('button', { name: /Reset/ }));

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

  it('agent 未設定, 輸入值後點擊 Save → 呼叫 onSave("agent", trimmed)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. code-reviewer'));
    const field = screen.getByPlaceholderText('e.g. code-reviewer').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. code-reviewer'), { target: { value: '  code-reviewer  ' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('agent', 'code-reviewer');
    });
  });

  it('autoMemoryDirectory 已設定時點擊 Reset → 呼叫 onDelete("autoMemoryDirectory")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoMemoryDirectory: '~/memory' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/my-memory-dir'));
    const field = screen.getByPlaceholderText('e.g. ~/my-memory-dir').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: /Reset/ }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('autoMemoryDirectory');
    });
  });

  it('minimumVersion 未設定, 輸入值後點擊 Save → 呼叫 onSave("minimumVersion", trimmed)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. 2.1.85'));
    const field = screen.getByPlaceholderText('e.g. 2.1.85').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. 2.1.85'), { target: { value: ' 2.1.85 ' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('minimumVersion', '2.1.85');
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

    await waitFor(() => getAvailableModelsInput());
    fireEvent.change(getAvailableModelsInput(), { target: { value: 'claude-opus-4-6' } });
    fireEvent.click(within(getAvailableModelsField()).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('availableModels', ['claude-opus-4-6']);
    });
  });

  it('已有 tags → 新增 tag → onSave 帶完整陣列', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ availableModels: ['claude-sonnet-4-6'] }, onSave);

    await waitFor(() => getAvailableModelsInput());
    fireEvent.change(getAvailableModelsInput(), { target: { value: 'claude-opus-4-6' } });
    fireEvent.click(within(getAvailableModelsField()).getByRole('button', { name: 'Add' }));

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

    await waitFor(() => getAvailableModelsInput());
    fireEvent.change(getAvailableModelsInput(), { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(within(getAvailableModelsField()).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Model already in list')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('scope 切換 → inputValue 和 error 清空', async () => {
    const { rerender } = renderSection({});

    await waitFor(() => getAvailableModelsInput());
    fireEvent.change(getAvailableModelsInput(), { target: { value: 'claude-opus-4-6' } });

    const input = getAvailableModelsInput() as HTMLInputElement;
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
      const resetInput = getAvailableModelsInput() as HTMLInputElement;
      expect(resetInput.value).toBe('');
    });
  });

  it('Enter 鍵新增 tag', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => getAvailableModelsInput());
    const input = getAvailableModelsInput();
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
    fireEvent.click(within(cleanupField).getByRole('button', { name: /Reset/ }));

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

// ---------------------------------------------------------------------------
// defaultMode（nested under permissions）互動
// ---------------------------------------------------------------------------

describe('GeneralSection — defaultMode（nested under permissions）', () => {
  it('顯示 Default Mode 欄位', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Default Mode')).toBeTruthy());
  });

  it('settings.permissions.defaultMode = "plan" → select 顯示 plan', async () => {
    renderSection({ permissions: { defaultMode: 'plan' } });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Default Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('plan');
    });
  });

  it('選 "auto" → onSave("permissions", { defaultMode: "auto" })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'auto' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', { defaultMode: 'auto' });
    });
  });

  it('現有 permissions 有 allow → 選 "plan" → merge 不破壞其他欄位', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { allow: ['Bash'], defaultMode: 'default' } }, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'plan' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', { allow: ['Bash'], defaultMode: 'plan' });
    });
  });

  it('選 "not set"（""）→ onSave("permissions", { ...perms, 不含 defaultMode })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { defaultMode: 'plan', allow: ['Bash'] } }, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: '' } });
    await waitFor(() => {
      const [key, value] = onSave.mock.calls[0] as [string, Record<string, unknown>];
      expect(key).toBe('permissions');
      expect(value).not.toHaveProperty('defaultMode');
      expect(value).toHaveProperty('allow', ['Bash']);
    });
  });

  it('選 bypassPermissions → 顯示 ConfirmDialog，取消不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'bypassPermissions' } });
    await waitFor(() => screen.getByText('Bypass Permissions'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
  });

  it('選 bypassPermissions → 確認後 onSave("permissions", { defaultMode: "bypassPermissions" })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'bypassPermissions' } });
    await waitFor(() => screen.getByText('Bypass Permissions'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', { defaultMode: 'bypassPermissions' });
    });
  });
});
