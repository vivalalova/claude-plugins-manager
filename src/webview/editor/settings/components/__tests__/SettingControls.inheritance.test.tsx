/**
 * @vitest-environment jsdom
 */
// #26 — 上層 scope 有設值時，選到「等於本層 schema default」的值不該被當成「沒設定」而
// 靜默刪除：resolveInherited/shouldDeleteOnChoose 是這個判斷的唯一來源（R7/R10）。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import {
  BooleanToggle,
  EnumDropdown,
  TextSetting,
  NumberSetting,
  resolveInherited,
  shouldDeleteOnChoose,
} from '../SettingControls';

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

// ---------------------------------------------------------------------------
// R7 — resolveInherited 單元測試
// ---------------------------------------------------------------------------

describe('resolveInherited — R7', () => {
  it('nearest parent wins：local 視角 project 與 user 都有值 → 回報最近的 project', () => {
    const result = resolveInherited(
      'local',
      { project: { fastMode: false }, user: { fastMode: true } },
      'fastMode',
    );
    expect(result).toEqual({ kind: 'known', scope: 'project', value: false });
  });

  it('useAutoModeDuringPlan（user+local 生效）：local 視角跳過不生效的 project，回報 user', () => {
    const result = resolveInherited(
      'local',
      { project: { useAutoModeDuringPlan: false }, user: { useAutoModeDuringPlan: true } },
      'useAutoModeDuringPlan',
    );
    expect(result).toEqual({ kind: 'known', scope: 'user', value: true });
  });

  it('parents undefined（project scope）→ unknown', () => {
    const result = resolveInherited('project', undefined, 'fastMode');
    expect(result).toEqual({ kind: 'unknown' });
  });

  it('user scope（無父層）：parents undefined 仍回報 none（I3，讀取前即成立）', () => {
    const result = resolveInherited('user', undefined, 'fastMode');
    expect(result).toEqual({ kind: 'none' });
  });

  it('父層值為非物件（如 "x"）→ 跳過該層、不拋錯', () => {
    expect(() => resolveInherited('project', { user: 'x' as unknown as Record<string, unknown> }, 'fastMode'))
      .not.toThrow();
    const result = resolveInherited('project', { user: 'x' as unknown as Record<string, unknown> }, 'fastMode');
    expect(result).toEqual({ kind: 'none' });
  });

  it('父層值為 null（key 存在但值是 null）→ known', () => {
    const result = resolveInherited('project', { user: { fastMode: null } }, 'fastMode');
    expect(result).toEqual({ kind: 'known', scope: 'user', value: null });
  });
});

describe('shouldDeleteOnChoose — R7', () => {
  it('inherited=none 且選到 default → 刪除', () => {
    expect(shouldDeleteOnChoose(30, 30, { kind: 'none' })).toBe(true);
  });

  it('inherited=unknown 且選到 default → 不刪除（寫入）', () => {
    expect(shouldDeleteOnChoose(30, 30, { kind: 'unknown' })).toBe(false);
  });

  it('inherited=known 且選到 default → 不刪除（寫入，即便父層同值）', () => {
    expect(shouldDeleteOnChoose(30, 30, { kind: 'known', scope: 'user', value: 30 })).toBe(false);
  });

  it('選到的值不等於 default → 不刪除，與 inherited 無關', () => {
    expect(shouldDeleteOnChoose(60, 30, { kind: 'none' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R10（I4）— Reset / Clear / 空值 一律刪除，不受 inherited=known 影響
// ---------------------------------------------------------------------------

describe('R10（I4）— 父層 known 時 Reset/Clear 仍走 onDelete', () => {
  it('BooleanToggle：父層 known，點 Reset → 仍 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <BooleanToggle
          label="Fast Mode"
          value={true}
          settingKey="fastMode"
          defaultValue={false}
          inherited={{ kind: 'known', scope: 'user', value: true }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByRole('button', { name: /Reset/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('fastMode'));
  });

  it('EnumDropdown：父層 known，選「not set」→ 仍 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <EnumDropdown
          label="Effort Level"
          value="low"
          knownValues={['high', 'medium', 'low']}
          knownLabels={{}}
          notSetLabel="— not set —"
          unknownTemplate="Current value: {value}"
          settingKey="effortLevel"
          defaultValue="high"
          inherited={{ kind: 'known', scope: 'user', value: 'medium' }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('effortLevel'));
  });

  it('TextSetting：父層 known，點 Clear → 仍 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <TextSetting
          label="Language"
          value="zh-TW"
          placeholder="e.g. zh-TW"
          saveLabel="Save"
          clearLabel="Clear"
          settingKey="language"
          scope="project"
          inherited={{ kind: 'known', scope: 'user', value: 'ja' }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByRole('button', { name: /Reset/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('language'));
  });

  it('NumberSetting：父層 known，清空輸入並 Save → 仍 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <NumberSetting
          label="Cleanup Period"
          value={30}
          placeholder="e.g. 30"
          saveLabel="Save"
          clearLabel="Clear"
          settingKey="cleanupPeriodDays"
          scope="project"
          defaultValue={30}
          inherited={{ kind: 'known', scope: 'user', value: 60 }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('cleanupPeriodDays'));
  });

  it('TextSetting：父層 known，清空輸入後點 Save（非 Reset 鈕）→ 仍 onDelete，onSave 未呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <TextSetting
          label="Language"
          value="zh-TW"
          placeholder="e.g. zh-TW"
          saveLabel="Save"
          clearLabel="Clear"
          settingKey="language"
          scope="project"
          inherited={{ kind: 'known', scope: 'user', value: 'ja' }}
          onSave={onSave}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));
    fireEvent.change(screen.getByPlaceholderText('e.g. zh-TW'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('language');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('NumberSetting：父層 known，點 Reset/Clear 鈕 → 仍 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <NumberSetting
          label="Cleanup Period"
          value={30}
          placeholder="e.g. 30"
          saveLabel="Save"
          clearLabel="Clear"
          settingKey="cleanupPeriodDays"
          scope="project"
          defaultValue={30}
          inherited={{ kind: 'known', scope: 'user', value: 60 }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByRole('button', { name: /Reset/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('cleanupPeriodDays'));
  });
});

// ---------------------------------------------------------------------------
// EnumDropdown — inheritedFrom 標籤查表的 prototype 陷阱
// knownLabels 是一般 object literal：knownLabels['constructor'] 沿原型鏈會拿到
// Object 建構子本身（非 undefined），若查表用 `knownLabels[v] ?? String(v)`，`??`
// 對非 nullish 的建構子函式不會 fallback，顯示出來的就是函式而非父層真正的值字串。
// ---------------------------------------------------------------------------

describe('EnumDropdown — inheritedFrom 標籤查表不受 Object.prototype 汙染', () => {
  it('父層值為字面剛好等於 "constructor" → 標籤顯示 "Inherited from User: constructor"（非函式字串）', async () => {
    renderWithI18n(
      <ToastProvider>
        <EnumDropdown
          label="Teammate Mode"
          value={undefined}
          knownValues={['auto', 'tmux', 'in-process', 'constructor']}
          knownLabels={{}}
          notSetLabel="— not set —"
          unknownTemplate="Current value: {value}"
          settingKey="teammateMode"
          inherited={{ kind: 'known', scope: 'user', value: 'constructor' }}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByRole('combobox'));
    const notSetOption = screen.getByRole('combobox').querySelector('option[value=""]') as HTMLOptionElement;
    expect(notSetOption.textContent).toBe('Inherited from User: constructor');
  });
});

// ---------------------------------------------------------------------------
// R2b（rule C）— BooleanToggle：選到的值等於 default，但父層 known → 寫入而非刪除
// ---------------------------------------------------------------------------

describe('BooleanToggle — rule C（父層 known，選到 default 仍寫入）', () => {
  it('own=false, 父層(user)=true（known）, defaultValue=true, 點擊 → onSave(key, true) 非 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <ToastProvider>
        <BooleanToggle
          label="Always Thinking"
          value={false}
          settingKey="alwaysThinkingEnabled"
          defaultValue={true}
          inherited={{ kind: 'known', scope: 'user', value: true }}
          onSave={onSave}
          onDelete={onDelete}
        />
      </ToastProvider>,
    );
    await waitFor(() => screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('alwaysThinkingEnabled', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
