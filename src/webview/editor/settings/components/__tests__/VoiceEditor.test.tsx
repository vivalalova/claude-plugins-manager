/**
 * @vitest-environment jsdom
 *
 * voice（display, object）— #29 結構化編輯器
 *
 * shape: { enabled?: boolean; mode?: 'hold'|'tap'; autoSubmit?: boolean }
 *
 * 控件 id 比照 SpellcheckEditor：voice-enabled／voice-mode／voice-autoSubmit。
 * 全部經 ObjectFieldEditor dispatcher 渲染，順帶鎖住 dispatcher 的 voice case。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { I18nProvider } from '../../../../i18n/I18nContext';
import { ObjectFieldEditor } from '../ObjectFieldEditor';
import { en } from '../../../../i18n/locales/en';
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

const enText = en as unknown as Record<string, string | undefined>;

const tree = (
  settings: ClaudeSettings,
  onSave: (key: string, value: unknown) => Promise<void>,
  onDelete: (key: string) => Promise<void>,
  scope: Scope = 'user',
) => (
  <ToastProvider>
    <ObjectFieldEditor
      settingKey="voice"
      scope={scope}
      settings={settings}
      onSave={onSave}
      onDelete={onDelete}
    />
  </ToastProvider>
);

const renderVoice = (
  settings: ClaudeSettings,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: Scope = 'user',
) => {
  const result = renderWithI18n(tree(settings, onSave, onDelete, scope));
  const rerenderVoice = (next: ClaudeSettings, nextScope: Scope = scope) =>
    result.rerender(<I18nProvider locale="en">{tree(next, onSave, onDelete, nextScope)}</I18nProvider>);
  return { ...result, onSave, onDelete, rerenderVoice };
};

const enabledBox = () => document.getElementById('voice-enabled') as HTMLInputElement;
const modeSelect = () => document.getElementById('voice-mode') as HTMLSelectElement;
const autoSubmitBox = () => document.getElementById('voice-autoSubmit') as HTMLInputElement;
const clickSave = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('voice — 結構化控件', () => {
  it('渲染 enabled 核取方塊、mode 下拉、autoSubmit 核取方塊，不再有 JSON 文字框', () => {
    renderVoice({} as ClaudeSettings);
    expect(enabledBox()?.type).toBe('checkbox');
    expect(modeSelect()?.tagName).toBe('SELECT');
    expect(autoSubmitBox()?.type).toBe('checkbox');
    expect(screen.queryByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }')).toBeNull();
  });

  it('既有值回填到各控件', () => {
    renderVoice({ voice: { enabled: true, mode: 'tap', autoSubmit: true } } as ClaudeSettings);
    expect(enabledBox().checked).toBe(true);
    expect(modeSelect().value).toBe('tap');
    expect(autoSubmitBox().checked).toBe(true);
  });

  it('C5 mode 下拉：空值選項顯示 unset 文案（自動＝按住說話），hold／tap 顯示各自標籤', () => {
    renderVoice({} as ClaudeSettings);
    const options = Array.from(modeSelect().options);
    expect(options.map((o) => o.value)).toEqual(['', 'hold', 'tap']);
    const unsetText = enText['settings.display.voice.mode.unset'];
    expect(unsetText).toBeTruthy();
    expect(options[0].textContent).toBe(unsetText);
    expect(options[1].textContent).toBe(enText['settings.display.voice.mode.hold']);
    expect(options[2].textContent).toBe(enText['settings.display.voice.mode.tap']);
    expect(enText['settings.display.voice.mode.hold']).toBeTruthy();
    expect(enText['settings.display.voice.mode.tap']).toBeTruthy();
  });

  it('C6 mode 選 tap 時 autoSubmit 仍可勾（不連動禁用）', () => {
    renderVoice({ voice: { mode: 'tap' } } as ClaudeSettings);
    expect(autoSubmitBox().disabled).toBe(false);
    fireEvent.change(modeSelect(), { target: { value: 'hold' } });
    fireEvent.change(modeSelect(), { target: { value: 'tap' } });
    expect(autoSubmitBox().disabled).toBe(false);
  });
});

describe('voice — 存檔', () => {
  it('C2 從 {enabled:true} 取消勾選後 Save → onDelete("voice")，不寫空物件', async () => {
    const { onSave, onDelete } = renderVoice({ voice: { enabled: true } } as ClaudeSettings);
    fireEvent.click(enabledBox());
    clickSave();
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('voice'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('C3 只勾開啟、不選模式 → onSave("voice", {enabled:true})，不多寫 mode', async () => {
    const { onSave, onDelete } = renderVoice({} as ClaudeSettings);
    fireEvent.click(enabledBox());
    clickSave();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBe('voice');
    expect(onSave.mock.calls[0][1]).toStrictEqual({ enabled: true });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('C4 載入 {enabled:true, autoSubmit:false} → Save 時 false 視為未填而省略', async () => {
    const { onSave } = renderVoice({ voice: { enabled: true, autoSubmit: false } } as ClaudeSettings);
    clickSave();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1]).toStrictEqual({ enabled: true });
  });

  it('三欄都填 → onSave 帶完整物件', async () => {
    const { onSave } = renderVoice({} as ClaudeSettings);
    fireEvent.click(enabledBox());
    fireEvent.change(modeSelect(), { target: { value: 'tap' } });
    fireEvent.click(autoSubmitBox());
    clickSave();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1]).toStrictEqual({ enabled: true, mode: 'tap', autoSubmit: true });
  });
});

describe('voice — 草稿重置契約', () => {
  it('C7 同一實例改以另一個 scope rerender（settings 同為 {}）→ 未存的勾選被丟棄', () => {
    const { rerenderVoice } = renderVoice({} as ClaudeSettings, undefined, undefined, 'user');
    fireEvent.click(enabledBox());
    expect(enabledBox().checked).toBe(true);
    rerenderVoice({} as ClaudeSettings, 'project');
    expect(enabledBox().checked).toBe(false);
  });

  it('C8 自己存檔後回推等值的新 voice 物件 → 未存的 mode 修改保留', () => {
    const { rerenderVoice } = renderVoice({ voice: { enabled: true } } as ClaudeSettings);
    fireEvent.change(modeSelect(), { target: { value: 'tap' } });
    rerenderVoice({ voice: { enabled: true } } as ClaudeSettings);
    expect(modeSelect().value).toBe('tap');
    expect(enabledBox().checked).toBe(true);
  });

  it('C9 外部只改一個子欄位 → 整份草稿以新值重建，未存的 mode 修改丟棄', () => {
    const { rerenderVoice } = renderVoice({} as ClaudeSettings);
    fireEvent.change(modeSelect(), { target: { value: 'tap' } });
    rerenderVoice({ voice: { enabled: true } } as ClaudeSettings);
    expect(enabledBox().checked).toBe(true);
    expect(modeSelect().value).toBe('');
  });
});
