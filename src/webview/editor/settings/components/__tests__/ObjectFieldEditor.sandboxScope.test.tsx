/**
 * @vitest-environment jsdom
 *
 * sandbox editor 的 draft 必須隨 scope 重置（複審輪 P3-1／P3-3 迴歸守門）：
 *   - props 帶著半填的 awsPairs 列時不得複製成兩列
 *   - 切 scope 後半填的列不得殘留（否則在新 scope 補完最後一欄就寫進錯誤 scope）
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { I18nProvider } from '../../../../i18n/I18nContext';
import { ObjectFieldEditor } from '../ObjectFieldEditor';
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

const halfFilled: ClaudeSettings = {
  sandbox: { credentials: { awsPairs: [{ accessKeyIdVar: 'A', secretAccessKeyVar: '' }] } },
};

const render = (settings: ClaudeSettings, scope: 'user' | 'project') =>
  renderWithI18n(
    <ToastProvider>
      <ObjectFieldEditor
        settingKey="sandbox"
        scope={scope}
        settings={settings}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />
    </ToastProvider>,
  );

const rowCount = (): number =>
  document.querySelectorAll('[id^="sandbox-awsPairs-"][id$="-accessKeyIdVar"]').length;

const input = (row: number, slot: string): HTMLInputElement =>
  document.getElementById(`sandbox-awsPairs-${row}-${slot}`) as HTMLInputElement;

describe('sandbox editor draft × scope', () => {
  it('props 帶半填的 awsPairs 列時只渲染一列', () => {
    render(halfFilled, 'user');
    expect(rowCount()).toBe(1);
    expect(input(0, 'accessKeyIdVar').value).toBe('A');
  });

  // 原本用 awsPairs rowCount 驗證切 scope 後 draft 不殘留；#24 後 awsPairs 編輯器在
  // project scope 因 effectiveScopes 直接隱藏，rowCount() 在 project 恆為 0——
  // 若用它斷言會「不論有沒有真的 reset 都通過」，測不出東西。改用 JSON 模式的
  // 未存檔草稿驗證同一個「scope 換了必須整個重置」的機制（ObjectFieldEditor 對
  // sandbox 傳 key={scope} 強制 remount）。
  it('切 scope 後 JSON 模式未存檔草稿不殘留到新 scope', () => {
    const { rerender } = render({ sandbox: { enabled: true } }, 'user');
    // 切到 JSON 模式並鍵入未存檔的草稿
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    const jsonTextarea = document.getElementById('sandbox-json') as HTMLTextAreaElement;
    fireEvent.change(jsonTextarea, { target: { value: '{"enabled":false,"__UNSAVED_DRAFT__":true}' } });
    expect(jsonTextarea.value).toContain('__UNSAVED_DRAFT__');

    rerender(
      <I18nProvider locale="en">
      <ToastProvider>
        <ObjectFieldEditor
          settingKey="sandbox"
          scope="project"
          settings={{}}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>
      </I18nProvider>,
    );

    // 新 scope 重新掛載：回到 Structured 模式（未保留 JSON 模式與未存檔草稿）
    expect(document.getElementById('sandbox-json')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Enable Sandbox' })).toBeTruthy();
  });

  // ObjectFieldEditor 把 scope prop 原樣傳給 SandboxEditor；#24 gated 控件
  // （user-only）須隨 scope 顯隱，錨在 ObjectFieldEditor 這層而非只在 SandboxEditor。
  it('scope prop 原樣傳遞：user 顯示 gated 控件，project 隱藏', () => {
    const { rerender } = render({ sandbox: { enabled: true } }, 'user');
    expect(screen.getByRole('checkbox', { name: 'Allow Apple Events (macOS)' })).toBeTruthy();

    rerender(
      <I18nProvider locale="en">
      <ToastProvider>
        <ObjectFieldEditor
          settingKey="sandbox"
          scope="project"
          settings={{ sandbox: { enabled: true } }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>
      </I18nProvider>,
    );

    expect(screen.queryByRole('checkbox', { name: 'Allow Apple Events (macOS)' })).toBeNull();
  });
});
