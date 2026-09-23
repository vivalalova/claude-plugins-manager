/**
 * #33 SettingsPage 整頁測試共用操作（搭配 fakeSettingsBackend）。
 * 呼叫端須先以 fakeVscodeModule mock 掉 src/webview/vscode。
 */
import React from 'react';
import { expect } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from './renderWithProviders';
import { ToastProvider } from '../components/Toast';
import { SettingsPage } from '../editor/settings/SettingsPage';

export type ScopeLabel = 'User' | 'Project' | 'Local';
const SCOPE_INDEX: Record<ScopeLabel, number> = { User: 0, Project: 1, Local: 2 };

export const renderSettingsPage = () => renderWithI18n(<ToastProvider><SettingsPage /></ToastProvider>);

const scopeTab = (label: ScopeLabel): HTMLButtonElement =>
  document.querySelectorAll('.settings-scope-tab')[SCOPE_INDEX[label]] as HTMLButtonElement;

/** scope tab 上的徽章數字；沒有徽章回 null */
export const scopeBadge = (label: ScopeLabel): string | null =>
  scopeTab(label)?.querySelector('.settings-scope-badge')?.textContent ?? null;

/** 讓已排入的 promise／effect 跑完 */
export const flush = async (): Promise<void> => {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

/** 等 tab 可點、切過去、等該 scope 載入完成（無 loading、無錯誤） */
export async function switchScope(label: ScopeLabel): Promise<void> {
  await waitFor(() => expect(scopeTab(label).disabled).toBe(false));
  fireEvent.click(scopeTab(label));
  await waitFor(() => {
    expect(scopeTab(label).className).toContain('settings-scope-tab--active');
    expect(document.querySelector('.settings-loading')).toBeNull();
  });
  await flush();
}

/** 只切 tab，不等載入（下一個 scope 的讀取可能被卡住） */
export function clickScope(label: ScopeLabel): void {
  fireEvent.click(scopeTab(label));
}

/** 等初次載入（user scope）完成且 project／local tab 可點 */
export async function waitInitialLoad(): Promise<void> {
  await waitFor(() => {
    expect(scopeTab('Project').disabled).toBe(false);
    expect(document.querySelector('.settings-loading')).toBeNull();
  });
  await flush();
}

export function clickNav(label: string): void {
  const nav = screen.getByRole('navigation');
  const btn = within(nav).getAllByRole('button').find((b) => b.textContent === label);
  if (!btn) throw new Error(`nav ${label} not found`);
  fireEvent.click(btn);
}

export function search(query: string): void {
  fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: query } });
}

export const fieldOf = (el: HTMLElement): HTMLElement => {
  const field = el.closest('.settings-field') as HTMLElement | null;
  if (!field) throw new Error('settings-field not found');
  return field;
};

/** TextSetting：以 placeholder 找輸入框，填值後按同欄位的 Save */
export function saveText(placeholder: string, value: string): void {
  const input = screen.getByPlaceholderText(placeholder);
  fireEvent.change(input, { target: { value } });
  fireEvent.click(within(fieldOf(input)).getByRole('button', { name: 'Save' }));
}

/** 以 key hint（如 "(fastMode: false)"）定位欄位內的 checkbox 並點擊 */
export function clickCheckboxByHint(hint: string): void {
  fireEvent.click(within(fieldOf(screen.getByText(hint))).getByRole('checkbox'));
}

export function selectByName(name: string, value: string): void {
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
}

export const selectValue = (name: string): string =>
  (screen.getByRole('combobox', { name }) as HTMLSelectElement).value;

/** env 布林列：label 文字為變數名、內含 checkbox */
export function envCheckbox(name: string): HTMLInputElement {
  const label = screen.getAllByText(name)
    .map((el) => el.closest('label'))
    .find((l) => l?.querySelector('input[type="checkbox"]'));
  if (!label) throw new Error(`checkbox for ${name} not found`);
  return label.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

/** 權限規則清單：填 rule 後按 Add Rule（畫面上只能有一個新增表單） */
export function addRule(rule: string): void {
  fireEvent.change(screen.getByPlaceholderText('e.g. WebFetch'), { target: { value: rule } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }));
}
