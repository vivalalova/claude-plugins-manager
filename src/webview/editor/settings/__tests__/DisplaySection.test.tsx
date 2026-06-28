/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { DisplaySection } from '../DisplaySection';
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
) =>
  renderWithI18n(
    <ToastProvider>
      <DisplaySection
        scope={scope}
        settings={settings as any}
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('DisplaySection — 渲染', () => {
  it('共用欄位與自寫 editor 顯示 key hint，只有可確認 defaultValue 的欄位顯示預設值', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('(teammateMode: auto)')).toBeTruthy();
      expect(screen.getByText('(teammateDefaultModel)')).toBeTruthy();
      expect(screen.getByText('(editorMode: normal)')).toBeTruthy();
      expect(screen.getByText('(externalEditorContext: false)')).toBeTruthy();
      expect(screen.getByText('(preferredNotifChannel: auto)')).toBeTruthy();
      expect(screen.getByText('(viewMode)')).toBeTruthy();
      expect(screen.getByText('(autoScrollEnabled: true)')).toBeTruthy();
      expect(screen.getByText('(awaySummaryEnabled: true)')).toBeTruthy();
      expect(screen.getByText('(showTurnDuration: true)')).toBeTruthy();
      expect(screen.getByText('(showThinkingSummaries: false)')).toBeTruthy();
      expect(screen.getByText('(showClearContextOnPlanAccept: false)')).toBeTruthy();
      expect(screen.getByText('(spinnerTipsEnabled: true)')).toBeTruthy();
      expect(screen.getByText('(terminalProgressBarEnabled: true)')).toBeTruthy();
      expect(screen.getByText('(prefersReducedMotion: false)')).toBeTruthy();
      expect(screen.getByText('(syntaxHighlightingDisabled: false)')).toBeTruthy();
      expect(screen.getByText('(voiceEnabled: false)')).toBeTruthy();
      expect(screen.getByText('(voice)').classList.contains('settings-key-hint')).toBe(true);
      expect(screen.getByText('(spinnerVerbs)').classList.contains('settings-key-hint')).toBe(true);
      expect(screen.getByText('(spinnerTipsOverride)').classList.contains('settings-key-hint')).toBe(true);
    });
  });

  it('顯示 18 個 checkbox（17 boolean toggle + excludeDefault；批次 S 加入 6 個 display boolean）', async () => {
    renderSection();
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(18);
    });
  });

  it('顯示 showTurnDuration toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Show Turn Duration')).toBeTruthy());
  });

  it('顯示 spinnerTipsEnabled toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Spinner Tips')).toBeTruthy());
  });

  it('顯示 terminalProgressBarEnabled toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Terminal Progress Bar')).toBeTruthy());
  });

  it('顯示 prefersReducedMotion toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Reduce Motion')).toBeTruthy());
  });

  it('顯示 View Mode dropdown', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText('View Mode')).toBeTruthy();
    });
  });

  it('顯示新增 display 欄位 label', async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText('Editor Mode')).toBeTruthy();
      expect(screen.getByText('Notifications')).toBeTruthy();
      expect(screen.getByText('Auto-scroll')).toBeTruthy();
      expect(screen.getByText('Session Recap')).toBeTruthy();
      expect(screen.getByText('External Editor Context')).toBeTruthy();
      expect(screen.getByText('Disable Syntax Highlighting')).toBeTruthy();
      expect(screen.getByText('Teammate Default Model')).toBeTruthy();
      expect(screen.getByText('Voice Settings')).toBeTruthy();
    });
  });

  it('欄位按 schema 陣列順序渲染', async () => {
    const { container } = renderSection();
    await waitFor(() => {
      const hints = container.querySelectorAll('.settings-key-hint');
      const keys = Array.from(hints).map((el) => {
        const match = el.textContent?.match(/^\((\w+)/);
        return match?.[1] ?? '';
      }).filter(Boolean);
      expect(keys).toEqual([...getSectionFieldOrder('display')]);
    });
  });
});

// ---------------------------------------------------------------------------
// 驗收條件
// ---------------------------------------------------------------------------

describe('DisplaySection — 驗收條件', () => {
  it('showThinkingSummaries 未設定, 點擊 → onSave("showThinkingSummaries", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Show Thinking Summaries' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Thinking Summaries' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('showThinkingSummaries', true);
    });
  });

  it('showTurnDuration 未設定 → checkbox checked（反映預設值 true）', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Show Turn Duration' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('showTurnDuration 未設定, 點擊 → onSave("showTurnDuration", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Show Turn Duration' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Turn Duration' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('showTurnDuration', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('prefersReducedMotion=true → checkbox checked', async () => {
    renderSection({ prefersReducedMotion: true });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Reduce Motion' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('editorMode 未設定, 選擇 vim → onSave("editorMode", "vim")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Editor Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Editor Mode' }), { target: { value: 'vim' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('editorMode', 'vim');
    });
  });

  it('preferredNotifChannel 未設定, 選擇 terminal_bell → onSave("preferredNotifChannel", "terminal_bell")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Notifications' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Notifications' }), { target: { value: 'terminal_bell' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('preferredNotifChannel', 'terminal_bell');
    });
  });

  it('autoScrollEnabled 未設定, 點擊 → onSave("autoScrollEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Auto-scroll' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto-scroll' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoScrollEnabled', false);
    });
  });

  it('externalEditorContext 未設定, 點擊 → onSave("externalEditorContext", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'External Editor Context' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'External Editor Context' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('externalEditorContext', true);
    });
  });

  it('syntaxHighlightingDisabled 未設定, 點擊 → onSave("syntaxHighlightingDisabled", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Disable Syntax Highlighting' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Disable Syntax Highlighting' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('syntaxHighlightingDisabled', true);
    });
  });

  it('teammateDefaultModel 輸入 null 並儲存 → onSave("teammateDefaultModel", null)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. sonnet or null'));
    const field = screen.getByPlaceholderText('e.g. sonnet or null').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. sonnet or null'), { target: { value: 'null' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('teammateDefaultModel', null);
    });
  });

  it('voice 輸入 JSON 並儲存 → onSave("voice", parsedObject)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }'));
    const field = screen.getByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }').closest('.settings-field') as HTMLElement;
    fireEvent.change(screen.getByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }'), { target: { value: '{"enabled":true,"mode":"tap"}' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('voice', { enabled: true, mode: 'tap' });
    });
  });

  it('voice 有值, Reset → onDelete("voice")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ voice: { enabled: true, mode: 'tap' } }, vi.fn(), onDelete);

    await waitFor(() => screen.getByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }'));
    const field = screen.getByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: /Reset/ }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('voice');
    });
  });

  it('spinnerTipsEnabled 未設定 → checkbox checked（反映預設值 true）', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Spinner Tips' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('spinnerTipsEnabled 未設定, 點擊 → onSave("spinnerTipsEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Spinner Tips' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Spinner Tips' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerTipsEnabled', false);
    });
  });

  it('terminalProgressBarEnabled 未設定 → checkbox checked（反映預設值 true）', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Terminal Progress Bar' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('terminalProgressBarEnabled 未設定, 點擊 → onSave("terminalProgressBarEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Terminal Progress Bar' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Terminal Progress Bar' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('terminalProgressBarEnabled', false);
    });
  });

  it('prefersReducedMotion=true, 點擊 → 值等於 default，呼叫 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ prefersReducedMotion: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Reduce Motion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reduce Motion' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('prefersReducedMotion');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('prefersReducedMotion 未設定 → 無 Reset 按鈕', async () => {
    renderSection({});
    await waitFor(() => screen.getByRole('checkbox', { name: 'Reduce Motion' }));
    const field = screen.getByRole('checkbox', { name: 'Reduce Motion' }).closest('.settings-field') as HTMLElement;
    expect(within(field).queryByRole('button', { name: /Reset/ })).toBeNull();
  });

  it('prefersReducedMotion=true → Reset 按鈕顯示，點擊 → onDelete("prefersReducedMotion")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ prefersReducedMotion: true }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Reduce Motion' }));
    const field = screen.getByRole('checkbox', { name: 'Reduce Motion' }).closest('.settings-field') as HTMLElement;
    const resetBtn = within(field).getByRole('button', { name: /Reset/ });
    expect(resetBtn).toBeTruthy();
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('prefersReducedMotion');
    });
  });
});

// ---------------------------------------------------------------------------
// teammateMode EnumDropdown
// ---------------------------------------------------------------------------

describe('DisplaySection — teammateMode dropdown', () => {
  it('viewMode 未設定, 選擇 verbose → onSave("viewMode", "verbose")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'View Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'View Mode' }), { target: { value: 'verbose' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('viewMode', 'verbose');
    });
  });

  it('顯示 Teammate Mode dropdown', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Teammate Mode')).toBeTruthy());
  });

  it('teammateMode 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Teammate Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('teammateMode 未設定, 選擇 tmux → onSave("teammateMode", "tmux")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Teammate Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Teammate Mode' }), { target: { value: 'tmux' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('teammateMode', 'tmux');
    });
  });

  it('teammateMode="in-process", 選擇空值 → onDelete("teammateMode")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ teammateMode: 'in-process' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Teammate Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Teammate Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('teammateMode');
    });
  });

  it('teammateMode="in-process" → select 顯示 in-process', async () => {
    renderSection({ teammateMode: 'in-process' });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Teammate Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('in-process');
    });
  });
});

// ---------------------------------------------------------------------------
// SpinnerVerbs Editor
// ---------------------------------------------------------------------------

describe('DisplaySection — SpinnerVerbs 渲染', () => {
  it('顯示 Spinner Verbs section', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Spinner Verbs')).toBeTruthy());
  });

  it('spinnerVerbs 未設定 → 顯示 No custom verbs', async () => {
    renderSection({});
    await waitFor(() => expect(screen.getByText('No custom verbs')).toBeTruthy());
  });

  it('spinnerVerbs 未設定 → mode select 預設 append', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('append');
    });
  });

  it('spinnerVerbs.verbs=[Thinking] → 顯示 tag', async () => {
    renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking'] } });
    await waitFor(() => expect(screen.getByText('Thinking')).toBeTruthy());
  });

  it('spinnerVerbs.mode=replace → select 顯示 replace', async () => {
    renderSection({ spinnerVerbs: { mode: 'replace', verbs: [] } });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('replace');
    });
  });
});

describe('DisplaySection — SpinnerVerbs 驗收', () => {
  it('scope 切換時會丟棄未儲存輸入並同步新的 mode/verbs', () => {
    const { rerender } = renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking'] } });

    fireEvent.change(screen.getByPlaceholderText('e.g. Thinking'), { target: { value: 'Unsaved' } });
    expect((screen.getByPlaceholderText('e.g. Thinking') as HTMLInputElement).value).toBe('Unsaved');

    rerender(
      <I18nProvider locale="en">
        <ToastProvider>
          <DisplaySection
            scope="project"
            settings={{ spinnerVerbs: { mode: 'replace', verbs: ['Working'] } } as any}
            onSave={vi.fn().mockResolvedValue(undefined)}
            onDelete={vi.fn().mockResolvedValue(undefined)}
          />
        </ToastProvider>
      </I18nProvider>,
    );

    expect((screen.getByPlaceholderText('e.g. Thinking') as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('combobox', { name: 'Mode' }) as HTMLSelectElement).value).toBe('replace');
    expect(screen.getByText('Working')).toBeTruthy();
    expect(screen.queryByText('Thinking')).toBeNull();
  });

  it('新增 verb → onSave("spinnerVerbs", { mode, verbs })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Thinking'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Thinking'), { target: { value: 'Processing' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerVerbs', { mode: 'append', verbs: ['Processing'] });
    });
  });

  it('已有 verbs, 刪除 verb → onSave with filtered array', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking', 'Working'] } }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove Thinking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Thinking' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerVerbs', { mode: 'append', verbs: ['Working'] });
    });
  });

  it('刪除既有 verb 時保留未送出的草稿輸入', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking', 'Working'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Thinking'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Thinking'), { target: { value: 'Draft verb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Thinking' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerVerbs', { mode: 'append', verbs: ['Working'] });
    });
    expect((screen.getByPlaceholderText('e.g. Thinking') as HTMLInputElement).value).toBe('Draft verb');
  });

  it('新增重複 verb → 顯示錯誤, onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Thinking'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Thinking'), { target: { value: 'Thinking' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);

    await waitFor(() => expect(screen.getByText('Already in list')).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('切換 mode → onSave("spinnerVerbs", { mode: "replace", verbs })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking'] } }, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Mode' }), { target: { value: 'replace' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerVerbs', { mode: 'replace', verbs: ['Thinking'] });
    });
  });

  it('Clear All → onDelete("spinnerVerbs")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerVerbs: { mode: 'append', verbs: ['Thinking'] } }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('button', { name: 'Clear All' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear All' })[0]);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('spinnerVerbs');
    });
  });

  it('非法輸入（空值）新增 → onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Thinking'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Thinking'), { target: { value: '   ' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);

    expect(onSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SpinnerTipsOverride Editor
// ---------------------------------------------------------------------------

describe('DisplaySection — SpinnerTipsOverride 渲染', () => {
  it('顯示 Spinner Tips Override section', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Spinner Tips Override')).toBeTruthy());
  });

  it('spinnerTipsOverride 未設定 → 顯示 No custom tips', async () => {
    renderSection({});
    await waitFor(() => expect(screen.getByText('No custom tips')).toBeTruthy());
  });

  it('spinnerTipsOverride.tips=["tip"] → 顯示 tag', async () => {
    renderSection({ spinnerTipsOverride: { tips: ['Stay hydrated!'] } });
    await waitFor(() => expect(screen.getByText('Stay hydrated!')).toBeTruthy());
  });

  it('spinnerTipsOverride.excludeDefault=true → checkbox checked', async () => {
    renderSection({ spinnerTipsOverride: { tips: [], excludeDefault: true } });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Exclude default tips' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('excludeDefault 未設定 → checkbox unchecked', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Exclude default tips' }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });
});

describe('DisplaySection — SpinnerTipsOverride 驗收', () => {
  it('新增 tip → onSave("spinnerTipsOverride", { tips: [tip] })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Stay hydrated!'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Stay hydrated!'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1]);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerTipsOverride', { tips: ['Hello'], excludeDefault: false });
    });
  });

  it('新增重複 tip → 顯示錯誤, onSave 不呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerTipsOverride: { tips: ['Hello'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Stay hydrated!'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Stay hydrated!'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1]);

    await waitFor(() => expect(screen.getAllByText('Already in list').length).toBeGreaterThan(0));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('已有 tips, 刪除 tip → onSave with filtered array', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerTipsOverride: { tips: ['Hello', 'World'] } }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove Hello' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hello' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerTipsOverride', { tips: ['World'], excludeDefault: false });
    });
  });

  it('刪除既有 tip 時保留未送出的草稿輸入', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerTipsOverride: { tips: ['Hello', 'World'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. Stay hydrated!'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Stay hydrated!'), { target: { value: 'Draft tip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hello' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerTipsOverride', { tips: ['World'], excludeDefault: false });
    });
    expect((screen.getByPlaceholderText('e.g. Stay hydrated!') as HTMLInputElement).value).toBe('Draft tip');
  });

  it('excludeDefault toggle → onSave with excludeDefault=true', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerTipsOverride: { tips: ['Hello'] } }, onSave);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Exclude default tips' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exclude default tips' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spinnerTipsOverride', { tips: ['Hello'], excludeDefault: true });
    });
  });

  it('Clear All → onDelete("spinnerTipsOverride")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ spinnerTipsOverride: { tips: ['Hello'] } }, vi.fn(), onDelete);

    await waitFor(() => screen.getAllByRole('button', { name: 'Clear All' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear All' })[0]);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('spinnerTipsOverride');
    });
  });
});

// ---------------------------------------------------------------------------
// 批次 S：display 7 個新 key（先紅）
// ---------------------------------------------------------------------------

describe('DisplaySection — 批次 S 渲染（先紅）', () => {
  it('顯示既有欄位 Show Turn Duration（harness 健在）', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Show Turn Duration')).toBeTruthy());
  });

  it.each([
    ['theme', 'Theme'],
    ['verbose', 'Verbose Output'],
    ['axScreenReader', 'Screen Reader Mode'],
    ['wheelScrollAccelerationEnabled', 'Wheel Scroll Acceleration'],
    ['respondToBashCommands', 'Respond to Shell Commands'],
    ['agentPushNotifEnabled', 'Push When Claude Decides'],
    ['inputNeededNotifEnabled', 'Push When Action Required'],
  ])('顯示 %s 欄位：label "%s"', async (_key, label) => {
    renderSection();
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
  });
});

describe('DisplaySection — 批次 S 互動（先紅）', () => {
  // theme: enum with default='dark'
  // unset → select value '' (not set); select 'light' → onSave('theme','light')
  // select 'dark' (=default) → onDelete('theme')
  it('theme 未設定 → combobox value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Theme' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('theme 未設定, 選擇 light → onSave("theme", "light")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByRole('combobox', { name: 'Theme' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), { target: { value: 'light' } });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('theme', 'light');
    });
  });

  it('theme 未設定, 選擇 dark（= default）→ onDelete("theme")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => screen.getByRole('combobox', { name: 'Theme' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), { target: { value: 'dark' } });
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('theme');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('theme="auto" → combobox 顯示 auto', async () => {
    renderSection({ theme: 'auto' });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Theme' }) as HTMLSelectElement;
      expect(select.value).toBe('auto');
    });
  });

  // verbose: default=false → unset→unchecked; click→onSave(key, true)
  it('verbose 未設定 → checkbox 未勾選（default false）', async () => {
    renderSection({});
    await waitFor(() => {
      const field = screen.getByText('Verbose Output').closest('.settings-field') as HTMLElement;
      const cb = within(field).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('verbose 未設定, toggle on → onSave("verbose", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => screen.getByText('Verbose Output'));
    const field = screen.getByText('Verbose Output').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('verbose', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // wheelScrollAccelerationEnabled: default=true → unset→checked; click→onSave(key, false)
  it('wheelScrollAccelerationEnabled 未設定 → checkbox checked（default true）', async () => {
    renderSection({});
    await waitFor(() => {
      const field = screen.getByText('Wheel Scroll Acceleration').closest('.settings-field') as HTMLElement;
      const cb = within(field).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('wheelScrollAccelerationEnabled 未設定, 點擊 → onSave("wheelScrollAccelerationEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => screen.getByText('Wheel Scroll Acceleration'));
    const field = screen.getByText('Wheel Scroll Acceleration').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('wheelScrollAccelerationEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // respondToBashCommands: default=true → click→onSave(key, false)
  it('respondToBashCommands 未設定, 點擊 → onSave("respondToBashCommands", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);
    await waitFor(() => screen.getByText('Respond to Shell Commands'));
    const field = screen.getByText('Respond to Shell Commands').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('respondToBashCommands', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // agentPushNotifEnabled: default=false → click→onSave(key, true)
  it('agentPushNotifEnabled 未設定, toggle on → onSave("agentPushNotifEnabled", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByText('Push When Claude Decides'));
    const field = screen.getByText('Push When Claude Decides').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('agentPushNotifEnabled', true);
    });
  });

  // inputNeededNotifEnabled: default=false → click→onSave(key, true)
  it('inputNeededNotifEnabled 未設定, toggle on → onSave("inputNeededNotifEnabled", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByText('Push When Action Required'));
    const field = screen.getByText('Push When Action Required').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('inputNeededNotifEnabled', true);
    });
  });

  // axScreenReader: default=false → click→onSave(key, true)
  it('axScreenReader 未設定, toggle on → onSave("axScreenReader", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);
    await waitFor(() => screen.getByText('Screen Reader Mode'));
    const field = screen.getByText('Screen Reader Mode').closest('.settings-field') as HTMLElement;
    fireEvent.click(within(field).getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('axScreenReader', true);
    });
  });
});
