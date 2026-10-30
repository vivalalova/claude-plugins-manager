/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../../../i18n/I18nContext';
import { TextSetting } from '../SettingControls';
import { ToastProvider } from '../../../../components/Toast';

vi.mock('../../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const tree = (value: string, scope: 'user' | 'project' = 'user') => (
  <I18nProvider locale="en">
    <ToastProvider>
      <TextSetting
        label="Language"
        value={value}
        placeholder="e.g. zh-TW"
        saveLabel="Save"
        settingKey="language"
        scope={scope}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />
    </ToastProvider>
  </I18nProvider>
);

const getInput = (): HTMLInputElement => screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement;

// #35 R35-guard：草稿只在 scope 或 value 相對上次 render 真的變動時才重設
describe('TextSetting 草稿重設時機（#35）', () => {
  afterEach(() => cleanup());

  it('(a) 同 scope 只改 value → 草稿被重設成新值', () => {
    const { rerender } = render(tree('en'));
    fireEvent.change(getInput(), { target: { value: 'draft' } });
    expect(getInput().value).toBe('draft');

    rerender(tree('ja'));
    expect(getInput().value).toBe('ja');
  });

  it('(b) 同 scope 同 value 重新 render → 草稿保留', () => {
    const { rerender } = render(tree('en'));
    fireEvent.change(getInput(), { target: { value: 'draft' } });

    rerender(tree('en'));
    expect(getInput().value).toBe('draft');
  });
});
