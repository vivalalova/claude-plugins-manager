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
  parentSettings?: Partial<Record<'user' | 'project' | 'local', Record<string, unknown>>>,
) =>
  renderWithI18n(
    <ToastProvider>
      <GeneralSection scope={scope} settings={settings as any} parentSettings={parentSettings as any} onSave={onSave} onDelete={onDelete} />
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
      expect(screen.getByText('(autoConnectIde: false)')).toBeTruthy();
      expect(screen.getByText('(autoInstallIdeExtension: true)')).toBeTruthy();
      // effortLevel：依 docs 只寫「unset」而非固定值，schema 拿掉 default（#25），
      // hint 因此不再帶預設值。
      expect(screen.getByText('(effortLevel)')).toBeTruthy();
      expect(screen.getByText('(language)')).toBeTruthy();
      expect(screen.getByText('(availableModels)')).toBeTruthy();
      expect(screen.getByText('(includeGitInstructions: true)')).toBeTruthy();
      expect(screen.getByText('(fastMode: false)')).toBeTruthy();
      expect(screen.getByText('(autoMemoryDirectory)')).toBeTruthy();
      expect(screen.getByText('(cleanupPeriodDays: 30)')).toBeTruthy();
      expect(screen.getByText('(autoUpdatesChannel: latest)')).toBeTruthy();
      expect(screen.getByText('(minimumVersion)')).toBeTruthy();
      expect(screen.getByText('(diffTool: auto)')).toBeTruthy();
      // workflowSizeGuideline：docs 預設依方案而變（Pro 為 small），schema 拿掉固定
      // default（#25 拍板 P3），hint 因此不再帶預設值。
      expect(screen.getByText('(workflowSizeGuideline)')).toBeTruthy();
      // alwaysThinkingEnabled：#25 拍板 P2 從 advanced 移回 general「Model & reasoning」，
      // docs：unset 時支援的模型預設就會思考，故 default 改為 true。
      expect(screen.getByText('(alwaysThinkingEnabled: true)')).toBeTruthy();
    });
  });

  it('顯示 Diff Tool、Dynamic Workflow Size 欄位', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText('Diff Tool')).toBeTruthy();
      expect(screen.getByText('Dynamic Workflow Size')).toBeTruthy();
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
      expect(screen.getByText('Auto-connect IDE')).toBeTruthy();
      expect(screen.getByText('Auto-install IDE Extension')).toBeTruthy();
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
      expect(screen.getByRole('checkbox', { name: 'Auto-connect IDE' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Auto-install IDE Extension' })).toBeTruthy();
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

  it('scope=project + user 層有 fastMode → 顯示「覆寫 使用者」badge', async () => {
    const { container } = renderSection(
      { fastMode: false },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      { user: { fastMode: true } },
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
      { user: { fastMode: false } },
    );
    await waitFor(() => {
      const badges = container.querySelectorAll('.settings-override-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('scope=project + 父層無對應 key → 該欄位無 override badge', async () => {
    const { container } = renderSection(
      { fastMode: true },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      { user: {} },
    );
    await waitFor(() => {
      // 父層為空，不應有任何 override badge
      expect(container.querySelector('.settings-override-badge')).toBeNull();
    });
  });

  it('scope=project 本層未設定該 key（無 Reset 鈕）但父層有 → 無 override badge', async () => {
    // 本層 settings 不含 fastMode → value === undefined → 沒有 Reset 鈕 = 沒設定，
    // 不算覆寫。override badge 必須與 Reset 鈕走同一個 value !== undefined 閘門。
    const { container } = renderSection(
      {},
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      { user: { fastMode: true } },
    );
    await waitFor(() => {
      // fastMode 欄位有渲染（section view 列出全部欄位）但本層未設定
      expect(screen.getByText('Fast Mode')).toBeTruthy();
    });
    // 本層未設定 → 不顯示 Reset 鈕，亦不該有 override badge（兩者口徑一致）
    expect(screen.queryByRole('button', { name: 'Reset Fast Mode' })).toBeNull();
    expect(container.querySelector('.settings-override-badge')).toBeNull();
  });

  // 跨層比對：local 蓋過最近父層 project（即使 user 也有，標最近的 project）
  it('scope=local + project 層有 fastMode（user 無）→ 顯示「覆寫 專案」badge', async () => {
    const { container } = renderSection(
      { fastMode: true },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'local',
      { project: { fastMode: false } },
    );
    await waitFor(() => {
      const badges = container.querySelectorAll('.settings-override-badge');
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].textContent).toContain('Project');
    });
  });

  it('scope=local + project 與 user 都有 → badge 標最近的「專案」非「使用者」', async () => {
    const { container } = renderSection(
      { fastMode: true },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'local',
      { project: { fastMode: false }, user: { fastMode: false } },
    );
    await waitFor(() => {
      const badges = container.querySelectorAll('.settings-override-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
    expect(container.querySelector('.settings-override-badge')!.textContent).toContain('Project');
    expect(container.querySelector('.settings-override-badge')!.textContent).not.toContain('User');
  });

  it('scope=local + 只有 user 有（project 無）→ 顯示「覆寫 使用者」badge', async () => {
    const { container } = renderSection(
      { fastMode: true },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'local',
      { project: {}, user: { fastMode: false } },
    );
    await waitFor(() => {
      const badge = container.querySelector('.settings-override-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toContain('User');
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

  it('autoConnectIde 未設定, toggle on → onSave("autoConnectIde", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto-connect IDE' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto-connect IDE' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoConnectIde', true);
    });
  });

  it('autoInstallIdeExtension 未設定, toggle off → onSave("autoInstallIdeExtension", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto-install IDE Extension' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto-install IDE Extension' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoInstallIdeExtension', false);
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
      const select = screen.getByRole('combobox', { name: 'Effort Level' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('effortLevel: "high" → select 顯示 high', async () => {
    renderSection({ effortLevel: 'high' });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Effort Level' }) as HTMLSelectElement;
      expect(select.value).toBe('high');
    });
  });

  it('選擇 effortLevel "medium" → 呼叫 onSave("effortLevel", "medium")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Effort Level' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Effort Level' }), { target: { value: 'medium' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('effortLevel', 'medium');
    });
  });

  it('選擇 effortLevel "" (notSet) → 呼叫 onDelete("effortLevel")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ effortLevel: 'high' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Effort Level' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Effort Level' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('effortLevel');
    });
  });

  it('選擇 effortLevel "high"（原本的預設值，#25 拿掉 default 後）→ 呼叫 onSave("effortLevel", "high")，不再走 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Effort Level' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Effort Level' }), { target: { value: 'high' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('effortLevel', 'high');
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // T-j：#27 拿掉 'max' 後，select 選項不再含它（schema 層另有 claude-settings-schema.test.ts 的斷言）。
  it('effortLevel select 選項不含 "max"', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Effort Level' }) as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'xhigh', 'high', 'medium', 'low']);
    });
  });

  it('未知 effortLevel → 顯示 __unknown__ disabled option（含 ⚠️）', async () => {
    renderSection({ effortLevel: 'ultra' as any });
    await waitFor(() => {
      expect(screen.getByText(/Current value: ultra/)).toBeTruthy();
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

  it('diffTool 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Diff Tool' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('選擇 diffTool "terminal" → 呼叫 onSave("diffTool", "terminal")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Diff Tool' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Diff Tool' }), { target: { value: 'terminal' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('diffTool', 'terminal');
    });
  });

  it('diffTool 選擇 auto（=default）→ onDelete("diffTool")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ diffTool: 'terminal' }, onSave, onDelete);
    await waitFor(() => screen.getByRole('combobox', { name: 'Diff Tool' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Diff Tool' }), { target: { value: 'auto' } });
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('diffTool');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('workflowSizeGuideline 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('選擇 workflowSizeGuideline "small" → 呼叫 onSave("workflowSizeGuideline", "small")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }), { target: { value: 'small' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('workflowSizeGuideline', 'small');
    });
  });

  it('workflowSizeGuideline 選擇 unrestricted（非 default）→ onSave 寫入 unrestricted', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ workflowSizeGuideline: 'small' }, onSave, onDelete);
    await waitFor(() => screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }), { target: { value: 'unrestricted' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('workflowSizeGuideline', 'unrestricted');
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('workflowSizeGuideline 選擇 medium（docs 預設依方案而變，#25 拿掉 schema 固定 default 後）→ onSave("workflowSizeGuideline", "medium")，不再走 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ workflowSizeGuideline: 'small' }, onSave, onDelete);
    await waitFor(() => screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Dynamic Workflow Size' }), { target: { value: 'medium' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('workflowSizeGuideline', 'medium');
      expect(onDelete).not.toHaveBeenCalled();
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

  it('cleanupPeriodDays 未設定, 輸入 0 並儲存 → onSave("cleanupPeriodDays", 0)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('30'));
    const cleanupField = screen.getByPlaceholderText('30').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '0' } });
    fireEvent.click(within(cleanupField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('cleanupPeriodDays', 0);
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

  it('選項依官方 docs 順序排列，含 manual、不含 delegate', async () => {
    renderSection();
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    const select = screen.getByRole('combobox', { name: 'Default Mode' }) as HTMLSelectElement;
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(['', 'default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions', 'manual']);
  });

  it('manual 選項顯示新 i18n key 的文字（非 raw key、非空字串）', async () => {
    renderSection();
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    const select = screen.getByRole('combobox', { name: 'Default Mode' }) as HTMLSelectElement;
    const manualOption = within(select).getAllByRole('option').find((o) => (o as HTMLOptionElement).value === 'manual') as HTMLOptionElement;
    expect(manualOption).toBeTruthy();
    expect(manualOption.textContent).not.toBe('');
    expect(manualOption.textContent).not.toBe('settings.general.defaultMode.manual');
    // 其餘選項標籤皆首字大寫（Default／Plan／Auto…）；缺 i18n key 時會 fallback 成原始值 'manual'（小寫）
    expect(manualOption.textContent).not.toBe('manual');
  });

  it('既有值為未知的 "delegate" → select 顯示 __unknown__ 警告，且不因 render 觸發 onSave／onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { defaultMode: 'delegate' } }, onSave, onDelete);
    await waitFor(() => screen.getByRole('combobox', { name: 'Default Mode' }));
    const select = screen.getByRole('combobox', { name: 'Default Mode' }) as HTMLSelectElement;
    expect(select.value).toBe('__unknown__');
    expect(screen.getByText('Current value: delegate ⚠️')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 批次 S：general 4 個新 key（先紅）
// ---------------------------------------------------------------------------

describe('GeneralSection — 批次 S 渲染（先紅）', () => {
  it('顯示既有欄位 Effort Level（harness 健在）', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Effort Level')).toBeTruthy());
  });

  it.each([
    ['advisorModel', 'Advisor Model'],
    ['fallbackModel', 'Fallback Model'],
    ['autoCompactEnabled', 'Auto-Compact'],
    ['fileCheckpointingEnabled', 'File Checkpointing'],
  ])('顯示 %s 欄位：label "%s"', async (_key, label) => {
    renderSection();
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
  });
});

describe('GeneralSection — 批次 S 互動（先紅）', () => {
  // autoCompactEnabled: default=true → unchecked click → onSave(key, false)
  it('autoCompactEnabled 未設定 → checkbox checked（default true）', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Auto-Compact' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('autoCompactEnabled 未設定, 點擊 → onSave("autoCompactEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto-Compact' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto-Compact' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoCompactEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // fileCheckpointingEnabled: default=true → toggle off → onSave(key, false)
  it('fileCheckpointingEnabled 未設定 → checkbox checked（default true）', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'File Checkpointing' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('fileCheckpointingEnabled 未設定, 點擊 → onSave("fileCheckpointingEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => screen.getByRole('checkbox', { name: 'File Checkpointing' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'File Checkpointing' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fileCheckpointingEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // advisorModel: string control, save via Save button
  it('advisorModel 未設定, 輸入值並儲存 → onSave("advisorModel", trimmed)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByText('Advisor Model'));
    const field = screen.getByText('Advisor Model').closest('.settings-field') as HTMLElement;
    fireEvent.change(within(field).getByRole('textbox'), { target: { value: 'opus' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('advisorModel', 'opus');
    });
  });

  // fallbackModel: must be arrayField (string[]) — discriminator is Add button, not textbox
  // P1 fix contract: change from unionValue(STRING_SCHEMA, STRING_ARRAY_SCHEMA)+controlTypeOverride:String
  //   → arrayField('fallbackModel', STRING_SCHEMA) so it renders same as availableModels (tag-list).
  it('fallbackModel 欄位渲染出 array 控件（有 Add 按鈕）', async () => {
    renderSection({});
    await waitFor(() => {
      const field = screen.getByText('Fallback Model').closest('.settings-field') as HTMLElement;
      expect(within(field).getByRole('button', { name: 'Add' })).toBeTruthy();
    });
  });

  it('fallbackModel 空值新增一個 model → onSave("fallbackModel", [value])', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => {
      const field = screen.getByText('Fallback Model').closest('.settings-field') as HTMLElement;
      expect(within(field).getByRole('button', { name: 'Add' })).toBeTruthy();
    });
    const field = screen.getByText('Fallback Model').closest('.settings-field') as HTMLElement;
    fireEvent.change(within(field).getByRole('textbox'), { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fallbackModel', ['claude-sonnet-4-6']);
    });
  });

  it('fallbackModel 已有一個 → 新增第二個 → onSave 帶兩元素陣列', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ fallbackModel: ['claude-opus-4-5'] }, onSave);
    await waitFor(() => {
      const field = screen.getByText('Fallback Model').closest('.settings-field') as HTMLElement;
      expect(within(field).getByRole('button', { name: 'Add' })).toBeTruthy();
    });
    const field = screen.getByText('Fallback Model').closest('.settings-field') as HTMLElement;
    fireEvent.change(within(field).getByRole('textbox'), { target: { value: 'claude-haiku-4-5' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('fallbackModel', ['claude-opus-4-5', 'claude-haiku-4-5']);
    });
  });
});

// ---------------------------------------------------------------------------
// storageFile=globalConfig 欄位在 project scope 完全不渲染（先紅）
// 這 4 個 key（autoConnectIde/autoInstallIdeExtension/diffTool/workflowSizeGuideline）
// 依官方文件只存在 ~/.claude.json（user 層級），project/local scope 不該顯示。
// ---------------------------------------------------------------------------

describe('GeneralSection — globalConfig 欄位 scope 隔離（先紅）', () => {
  it('scope=project → autoConnectIde/autoInstallIdeExtension/diffTool 完全不渲染', async () => {
    renderSection(
      { autoConnectIde: true, autoInstallIdeExtension: true, diffTool: 'terminal' },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
    );

    await waitFor(() => expect(screen.getByText('Effort Level')).toBeTruthy());

    expect(screen.queryByText('Auto-connect IDE')).toBeNull();
    expect(screen.queryByText('Auto-install IDE Extension')).toBeNull();
    expect(screen.queryByText('Diff Tool')).toBeNull();
    expect(screen.queryByText('(autoConnectIde: false)')).toBeNull();
    expect(screen.queryByText('(autoInstallIdeExtension: true)')).toBeNull();
    expect(screen.queryByText('(diffTool: auto)')).toBeNull();
  });

  // #25 P3：workflowSizeGuideline 改存 settings 檔（不再 storageFile: 'globalConfig'），
  // docs Scope 為 Any file，project/local scope 不該再被隱藏。
  it('scope=project → workflowSizeGuideline 仍渲染（不再是 globalConfig-only 欄位）', async () => {
    renderSection(
      { workflowSizeGuideline: 'small' },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
    );

    await waitFor(() => {
      expect(screen.getByText('Dynamic Workflow Size')).toBeTruthy();
      expect(screen.getByText('(workflowSizeGuideline)')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// alwaysThinkingEnabled（Extended Thinking）— #25 拍板 P2 從 AdvancedSection 移入
// ---------------------------------------------------------------------------
// docs：unset 時，對支援 extended thinking 的模型預設就會思考；關閉會停用「每個
// session」的 extended thinking，對本來就一直思考的模型無影響。default 因此改為
// true（而非舊的 false）。用 settingKey hint `(alwaysThinkingEnabled: true)` 定位，
// 不依賴確切標籤文案（新文案為 "Extended thinking" / 「延伸思考」）。
describe('GeneralSection — alwaysThinkingEnabled（Extended Thinking，#25）', () => {
  const getField = () =>
    screen.getByText('(alwaysThinkingEnabled: true)').closest('.settings-field') as HTMLElement;

  it('渲染 settingKey hint', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText('(alwaysThinkingEnabled: true)')).toBeTruthy();
    });
  });

  it('顯示標籤為 Title Case「Extended Thinking」', async () => {
    renderSection();
    await waitFor(() => {
      expect(within(getField()).getByText('Extended Thinking')).toBeTruthy();
    });
  });

  it('未設定 → checkbox checked（default true）', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = within(getField()).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('未設定, 點擊 → onSave("alwaysThinkingEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => getField());
    fireEvent.click(within(getField()).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('alwaysThinkingEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('值為 false, 點擊 → 值等於 default(true)，呼叫 onDelete("alwaysThinkingEnabled")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ alwaysThinkingEnabled: false }, onSave, onDelete);
    await waitFor(() => getField());
    fireEvent.click(within(getField()).getByRole('checkbox'));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('alwaysThinkingEnabled');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// #26 — 上層 scope 有設值時，選到「等於本層 default」的值不該被當成「沒設定」而
// 靜默刪除（R1/R2/R2b/R9）。
// ---------------------------------------------------------------------------

describe('GeneralSection — alwaysThinkingEnabled 繼承感知（#26 R1/R2/R2b）', () => {
  const getField = () =>
    screen.getByText('(alwaysThinkingEnabled: true)').closest('.settings-field') as HTMLElement;

  it('R1：project scope，own=false，父層(user)=false（非 default）→ 點擊 → onSave(key, true)（今日為 onDelete）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ alwaysThinkingEnabled: false }, onSave, onDelete, 'project', { user: { alwaysThinkingEnabled: false } });
    await waitFor(() => getField());
    fireEvent.click(within(getField()).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('alwaysThinkingEnabled', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('R2：同一父層資料，own 未設 → checkbox 顯示未勾選（繼承父層 false，今日顯示已勾）', async () => {
    renderSection({}, vi.fn(), vi.fn(), 'project', { user: { alwaysThinkingEnabled: false } });
    await waitFor(() => {
      const cb = within(getField()).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('R2b（rule C）：project scope，own=false，父層(user)=true（等於 default）→ 點擊 → onSave(key, true)（今日為 onDelete）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ alwaysThinkingEnabled: false }, onSave, onDelete, 'project', { user: { alwaysThinkingEnabled: true } });
    await waitFor(() => getField());
    fireEvent.click(within(getField()).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('alwaysThinkingEnabled', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

describe('GeneralSection — cleanupPeriodDays 繼承感知（#26 R9）', () => {
  it('project scope，own 未設，父層(user)=10（非 default 30）→ 輸入 30（=default）並儲存 → onSave("cleanupPeriodDays", 30)（今日為 onDelete）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete, 'project', { user: { cleanupPeriodDays: 10 } });

    await waitFor(() => screen.getByPlaceholderText('30'));
    const cleanupField = screen.getByPlaceholderText('30').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '30' } });
    fireEvent.click(within(cleanupField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('cleanupPeriodDays', 30);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

describe('GeneralSection — settings sync controls', () => {
  const MODEL_PICKER_PLACEHOLDER = 'e.g. {"options":[{"model":"sonnet"}]}';
  const MODEL_SETTINGS_PLACEHOLDER = 'e.g. {"sonnet":{"effortLevel":"high"}}';

  it('renders new scalar controls and both object editors', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('Auto-Continue At Usage Limit')).toBeTruthy();
      expect(screen.getByText('Desktop Session Cleanup Period')).toBeTruthy();
      expect(screen.getByText('Model Picker')).toBeTruthy();
      expect(screen.getByText('Model Settings')).toBeTruthy();
      expect(screen.getByText('Prompt Cache TTL')).toBeTruthy();
      expect(screen.getByText('Subagent Prompt Cache TTL')).toBeTruthy();
      expect(screen.getByPlaceholderText(MODEL_PICKER_PLACEHOLDER)).toBeTruthy();
      expect(screen.getByPlaceholderText(MODEL_SETTINGS_PLACEHOLDER)).toBeTruthy();
    });
  });

  it('new fixed defaults are applied, while object editors remain unset', async () => {
    renderSection();

    await waitFor(() => {
      expect((screen.getByRole('checkbox', { name: 'Auto-Continue At Usage Limit' }) as HTMLInputElement).checked).toBe(true);
      expect((screen.getByRole('spinbutton', { name: 'Desktop Session Cleanup Period' }) as HTMLInputElement).placeholder).toBe('0');
    });
  });

  it('modelPicker JSON save parses and saves the object', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const input = await screen.findByPlaceholderText(MODEL_PICKER_PLACEHOLDER);
    const field = input.closest('.settings-field') as HTMLElement;
    fireEvent.change(input, { target: { value: '{"options":[{"model":"sonnet","label":"Sonnet"}]}' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('modelPicker', { options: [{ model: 'sonnet', label: 'Sonnet' }] });
    });
  });

  it('modelPicker with a value can be reset through onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ modelPicker: { options: [{ model: 'sonnet' }] } }, vi.fn(), onDelete);

    const input = await screen.findByPlaceholderText(MODEL_PICKER_PLACEHOLDER);
    const field = input.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: /Reset/ }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('modelPicker'));
  });

  it('modelSettings JSON save parses and saves the record', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    const input = await screen.findByPlaceholderText(MODEL_SETTINGS_PLACEHOLDER);
    const field = input.closest('.settings-field') as HTMLElement;
    fireEvent.change(input, { target: { value: '{"sonnet":{"effortLevel":"xhigh"}}' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('modelSettings', { sonnet: { effortLevel: 'xhigh' } });
    });
  });

  it('modelSettings with a value can be reset through onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ modelSettings: { sonnet: { effortLevel: 'high' } } }, vi.fn(), onDelete);

    const input = await screen.findByPlaceholderText(MODEL_SETTINGS_PLACEHOLDER);
    const field = input.closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: /Reset/ }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('modelSettings'));
  });
});
