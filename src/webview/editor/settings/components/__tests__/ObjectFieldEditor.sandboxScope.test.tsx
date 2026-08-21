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

  it('切 scope 後半填的 draft 列不殘留到新 scope', () => {
    const { rerender } = render({}, 'user');
    fireEvent.click(screen.getByRole('button', { name: 'Add pair' }));
    fireEvent.change(input(0, 'accessKeyIdVar'), { target: { value: 'HALF' } });
    expect(rowCount()).toBe(1);

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
    expect(rowCount()).toBe(0);
  });
});
