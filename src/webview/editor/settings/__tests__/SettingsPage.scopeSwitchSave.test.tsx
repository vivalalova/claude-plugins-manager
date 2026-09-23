/**
 * @vitest-environment jsdom
 *
 * #33 情況 1：存檔途中切 scope。寫入回應到達時，只在「畫面資料仍屬於發出寫入的 scope」
 * 才套樂觀更新（I4）；徽章數目前 scope 由畫面資料推導、其他情況用 counts（I5）。
 * fake backend 依檔案分 FIFO、可卡住逐筆放行；斷言看畫面與 fake 最終檔案內容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../../vscode', async () => (await import('../../../__test-utils__/fakeSettingsBackend')).fakeVscodeModule);

import { installFakeSettingsBackend, type FakeSettingsBackend } from '../../../__test-utils__/fakeSettingsBackend';
import {
  renderSettingsPage,
  waitInitialLoad,
  switchScope,
  clickScope,
  clickNav,
  flush,
  scopeBadge,
  saveText,
  selectByName,
  selectValue,
  clickCheckboxByHint,
  fieldOf,
} from '../../../__test-utils__/settingsPageHarness';

const LANGUAGE = 'e.g. zh-TW';
const languageValue = (): string => (screen.getByPlaceholderText(LANGUAGE) as HTMLInputElement).value;

let backend: FakeSettingsBackend;

const pendingOf = (lane: 'project' | 'local', type: string): number =>
  backend.pending(lane).filter((m) => m.type === type).length;

/** 進 project scope 後卡住 project 佇列（先讓初始讀取全部完成，避免卡住載入本身） */
async function enterProjectAndBlock(): Promise<void> {
  renderSettingsPage();
  await waitInitialLoad();
  await switchScope('Project');
  backend.block('project');
}

afterEach(() => {
  cleanup();
});

describe('#33 存檔途中切 scope：新 scope 畫面不出現舊 scope 的值（AC1、X11）', () => {
  beforeEach(() => {
    backend = installFakeSettingsBackend();
  });

  it('project 存 language 未回 → 切 local 並先載完 → 放行 → local 的 language 仍為空，已自訂分頁沒有該列', async () => {
    await enterProjectAndBlock();
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(1));

    await switchScope('Local');
    await act(async () => { await backend.unblock('project'); });
    await flush();

    expect(backend.file('project').language).toBe('ja');
    expect(backend.file('local')).not.toHaveProperty('language');
    expect(languageValue()).toBe('');

    clickNav('Customized');
    await waitFor(() => expect(screen.getByText('No customized settings in this scope.')).toBeTruthy());
    expect(screen.queryByPlaceholderText(LANGUAGE)).toBeNull();
  });

  it('巢狀版本：project 存 defaultMode 未回 → 切 local → 放行 → local 的 Default Mode 仍未設定', async () => {
    await enterProjectAndBlock();
    selectByName('Default Mode', 'plan');
    await waitFor(() => expect(backend.pending('project')).toHaveLength(1));

    await switchScope('Local');
    await act(async () => { await backend.unblock('project'); });
    await flush();

    expect(backend.file('project').permissions).toEqual({ defaultMode: 'plan' });
    expect(backend.file('local')).not.toHaveProperty('permissions');
    expect(selectValue('Default Mode')).toBe('');
  });

  it('X31：project 改 unknown key 未回 → 切 local → 放行 → local 的 Unrecognized Settings 不出現該 key', async () => {
    backend = installFakeSettingsBackend({ project: { myCustomKey: 'a' } });
    renderSettingsPage();
    await waitInitialLoad();
    clickNav('Advanced');
    await switchScope('Project');
    backend.block('project');

    const input = await screen.findByDisplayValue('"a"');
    fireEvent.change(input, { target: { value: '"b"' } });
    fireEvent.click(within(fieldOf(input)).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(1));

    await switchScope('Local');
    await act(async () => { await backend.unblock('project'); });
    await flush();

    expect(backend.file('project').myCustomKey).toBe('b');
    expect(screen.queryByText('myCustomKey')).toBeNull();
    expect(screen.queryByText('Unrecognized Settings')).toBeNull();
  });
});

describe('#33 徽章數與實際檔案內容一致（AC2）', () => {
  beforeEach(() => {
    backend = installFakeSettingsBackend();
  });

  it('X16：切走後 project 寫入回應到達，再於 local 存 language → local 徽章 = local 檔案的已自訂數（1）', async () => {
    await enterProjectAndBlock();
    selectByName('Default Mode', 'plan');
    await waitFor(() => expect(backend.pending('project')).toHaveLength(1));

    await switchScope('Local');
    await act(async () => { await backend.unblock('project'); });
    await flush();

    saveText(LANGUAGE, 'fr');
    await waitFor(() => expect(backend.file('local').language).toBe('fr'));
    await flush();

    // local 檔案只有 language 一項
    expect(backend.file('local')).toEqual({ language: 'fr' });
    await waitFor(() => expect(scopeBadge('Local')).toBe('1'));
    // project 檔案只有 permissions.defaultMode 一項
    await waitFor(() => expect(scopeBadge('Project')).toBe('1'));
  });

  // 守門：現況即綠。mutation「發出 scope ≠ 目前 scope 時漏呼叫 refreshCounts」→ project 徽章停在 0，必須轉紅。
  it('純情況 1：project 存檔未回 → 切 local → 放行 → project 徽章 1、local 無徽章', async () => {
    await enterProjectAndBlock();
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(1));

    await switchScope('Local');
    await act(async () => { await backend.unblock('project'); });
    await flush();

    await waitFor(() => expect(scopeBadge('Project')).toBe('1'));
    expect(scopeBadge('Local')).toBeNull();
  });

  it('X15：同一 scope 兩個布林並行存檔 → 放行後徽章 = 2（不因第二筆用舊快照而少算）', async () => {
    await enterProjectAndBlock();
    clickCheckboxByHint('(alwaysThinkingEnabled: true)');
    clickCheckboxByHint('(fastMode: false)');
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(2));

    await act(async () => { await backend.unblock('project'); });
    await flush();

    expect(backend.file('project')).toEqual({ alwaysThinkingEnabled: false, fastMode: true });
    await waitFor(() => expect(scopeBadge('Project')).toBe('2'));
  });

  // 守門（現況綠）：對照「照字面實作 F6a、沒有 X15b effect 補洞」→ counts.project 停在寫入前的 0，必須轉紅。
  it('X15b：project 存檔完成 → 切到 local → project 徽章仍反映寫入後內容（1）', async () => {
    renderSettingsPage();
    await waitInitialLoad();
    await switchScope('Project');
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(backend.file('project').language).toBe('ja'));
    await flush();

    await switchScope('Local');
    expect(scopeBadge('Project')).toBe('1');
  });

  // 守門（現況綠）：mutation「徽章推導條件拿掉 snap.forScope === scope」→ local 徽章會用 project 資料算出 1，必須轉紅。
  it('X24：project→local 而 local 載入失敗 → local 徽章不採用停留的 project 資料', async () => {
    backend = installFakeSettingsBackend({ project: { language: 'ja' } });
    renderSettingsPage();
    await waitInitialLoad();
    await switchScope('Project');
    await waitFor(() => expect(scopeBadge('Project')).toBe('1'));

    backend.failNext('local', 'settings.get');
    clickScope('Local');
    await waitFor(() => expect(screen.getByText(/Failed to load settings/)).toBeTruthy());
    await flush();

    expect(scopeBadge('Local')).toBeNull();
    expect(scopeBadge('Project')).toBe('1');
  });
});

describe('#33 A→B→A 與回應早到（X13、X13e、X14）', () => {
  // 守門（現況綠）：mutation「patch 不檢查 forScope 而改看目前 scope」在此情境下最終仍會被 load 覆寫；
  // 本條擋的是「切回原 scope 後寫入值不見」的回歸。
  it('X13：project 存檔（卡住）→ local → project → 放行 → project 畫面與徽章都含寫入值', async () => {
    backend = installFakeSettingsBackend();
    await enterProjectAndBlock();
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(1));

    await switchScope('Local');
    clickScope('Project');
    await waitFor(() => expect(pendingOf('project', 'settings.get')).toBeGreaterThanOrEqual(1));
    await act(async () => { await backend.unblock('project'); });
    await waitFor(() => expect(document.querySelector('.settings-loading')).toBeNull());
    await flush();

    expect(languageValue()).toBe('ja');
    await waitFor(() => expect(scopeBadge('Project')).toBe('1'));
  });

  // 守門（現況綠）：對照「以 scopeRef 判斷、把 patch 套到畫面上的 local 資料」→ 徽章 = local 兩項 + patch = 3，必須轉紅。
  it('X13e：同上但切回 project 的載入失敗 → project 徽章不等於「local 資料＋patch」', async () => {
    backend = installFakeSettingsBackend({
      project: { model: 'm' },
      local: { language: 'x', outputStyle: 'y' },
    });
    await enterProjectAndBlock();
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(1));

    await switchScope('Local');
    // project 佇列此時依序為：set、local 的父層讀取 get(project)；切回 project 後再排 settings get(project)
    backend.failNext('project', 'settings.get', { skip: pendingOf('project', 'settings.get') });
    clickScope('Project');
    await act(async () => { await backend.unblock('project'); });
    await waitFor(() => expect(screen.getByText(/Failed to load settings/)).toBeTruthy());
    await flush();

    expect(backend.file('project')).toEqual({ model: 'm', language: 'ja' });
    expect(scopeBadge('Project')).not.toBe('3');
  });

  // 守門（現況綠）：寫入回應比 local 載入先到 → patch 套在 project 資料上，之後 local 載入整份覆寫。
  it('X14：存檔回應早於 local 載入 → local 畫面正確、project 徽章 1', async () => {
    backend = installFakeSettingsBackend();
    await enterProjectAndBlock();
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(pendingOf('project', 'settings.set')).toBe(1));

    backend.block('local');
    clickScope('Local');
    await waitFor(() => expect(pendingOf('local', 'settings.get')).toBe(1));
    await act(async () => { await backend.release('project'); });
    await act(async () => { await backend.unblock('local'); });
    await act(async () => { await backend.unblock('project'); });
    await waitFor(() => expect(document.querySelector('.settings-loading')).toBeNull());
    await flush();

    expect(languageValue()).toBe('');
    await waitFor(() => expect(scopeBadge('Project')).toBe('1'));
  });
});
