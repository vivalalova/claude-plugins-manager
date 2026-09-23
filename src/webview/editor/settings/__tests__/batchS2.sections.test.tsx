/**
 * @vitest-environment jsdom
 *
 * 本批次新 scalar setting key 的 section 渲染 / save / delete 測試
 *
 * 涵蓋：
 *   - autoCompactWindow（general, number, min 100000 / max 1000000, 無 default）
 *   - dialogExpiry（general, enum 60s|5m|10m|never, default '5m'）
 *   - promptSuggestionEnabled（display, boolean, default true）
 *   - crossSessionInbound（display, enum accept|hold|refuse, 無 default）
 *   - keybindingFlavor（display, enum classic|readline, 無 default — #25 拿掉）
 *   - isolatePeerMachines（advanced, boolean, 無 default）
 *
 * 定位控件走 key hint 文字（`(key: default)`）而非 label 文案：文案由實作決定，
 * 這裡只鎖行為契約。禁用位置索引（section 重排即碎）。
 *
 * 開新檔而非併入既有 GeneralSection/DisplaySection/AdvancedSection 測試檔：
 * 三者皆已逼近／超過 800 行上限。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../components/Toast';
import { DisplaySection } from '../DisplaySection';
import { GeneralSection } from '../GeneralSection';
import { AdvancedSection } from '../AdvancedSection';

vi.mock('../../../vscode', () => ({
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

type SectionComponent = typeof DisplaySection;

const renderSection = (
  Section: SectionComponent,
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <Section scope="user" settings={settings as any} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

/** 由 key hint 文字回推該欄位的 .settings-field 容器 */
function fieldByKeyHint(hint: string): HTMLElement {
  return screen.getByText(hint).closest('.settings-field') as HTMLElement;
}

// ---------------------------------------------------------------------------
// autoCompactWindow — general / number / min 100000 max 1000000 / 無 default
// ---------------------------------------------------------------------------

describe('autoCompactWindow（general section）', () => {
  const HINT = '(autoCompactWindow)';

  it('在 general section render 出 number 控件（無 default → key hint 不帶值）', async () => {
    renderSection(GeneralSection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
    const input = within(fieldByKeyHint(HINT)).getByRole('spinbutton') as HTMLInputElement;
    expect(input.min).toBe('100000');
    expect(input.max).toBe('1000000');
  });

  it('已設定 → input 顯示既有值', async () => {
    renderSection(GeneralSection, { autoCompactWindow: 250000 });
    await waitFor(() => {
      const input = within(fieldByKeyHint(HINT)).getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('250000');
    });
  });

  it('輸入合法值並儲存 → onSave("autoCompactWindow", 500000)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, {}, onSave);

    await waitFor(() => screen.getByText(HINT));
    const field = fieldByKeyHint(HINT);
    fireEvent.change(within(field).getByRole('spinbutton'), { target: { value: '500000' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('autoCompactWindow', 500000));
  });

  it('低於 min → 顯示錯誤且不儲存', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, {}, onSave);

    await waitFor(() => screen.getByText(HINT));
    const field = fieldByKeyHint(HINT);
    fireEvent.change(within(field).getByRole('spinbutton'), { target: { value: '50000' } });

    await waitFor(() => expect(within(field).getByRole('alert')).toBeTruthy());
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('已設定, Reset → onDelete("autoCompactWindow")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, { autoCompactWindow: 250000 }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('button', { name: /Reset/ }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('autoCompactWindow');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// dialogExpiry — general / enum / default '5m'
// ---------------------------------------------------------------------------

describe('dialogExpiry（general section）', () => {
  const HINT = '(dialogExpiry: 5m)';

  it('在 general section render 出 enum 控件，選項為 60s/5m/10m/never', async () => {
    renderSection(GeneralSection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
    const select = within(fieldByKeyHint(HINT)).getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['60s', '5m', '10m', 'never']));
  });

  it('選非 default 值 → onSave("dialogExpiry", "never")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, {}, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.change(within(fieldByKeyHint(HINT)).getByRole('combobox'), { target: { value: 'never' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('dialogExpiry', 'never');
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('選回 default 值 → onDelete("dialogExpiry")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, { dialogExpiry: 'never' }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.change(within(fieldByKeyHint(HINT)).getByRole('combobox'), { target: { value: '5m' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('dialogExpiry');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// promptSuggestionEnabled — display / boolean / default true
// ---------------------------------------------------------------------------

describe('promptSuggestionEnabled（display section）', () => {
  const HINT = '(promptSuggestionEnabled: true)';

  it('未設定 → checkbox checked（反映 default true）', async () => {
    renderSection(DisplaySection);
    await waitFor(() => {
      const cb = within(fieldByKeyHint(HINT)).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('未設定, toggle off → onSave("promptSuggestionEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, {}, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('promptSuggestionEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('=false, toggle on → onDelete("promptSuggestionEnabled")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, { promptSuggestionEnabled: false }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('promptSuggestionEnabled');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// crossSessionInbound — display / enum / 無 default（docs 無 **Default**:；未設時由 runtime 逐訊息決定）
// ---------------------------------------------------------------------------

describe('crossSessionInbound（display section）', () => {
  const HINT = '(crossSessionInbound)';

  it('render 出 enum 控件，選項為 accept/hold/refuse', async () => {
    renderSection(DisplaySection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
    const select = within(fieldByKeyHint(HINT)).getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['accept', 'hold', 'refuse']));
  });

  it('選非 default 值 → onSave("crossSessionInbound", "refuse")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, {}, onSave);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.change(within(fieldByKeyHint(HINT)).getByRole('combobox'), { target: { value: 'refuse' } });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('crossSessionInbound', 'refuse'));
  });

  it('選 hold → 真正寫入 onSave("crossSessionInbound", "hold")（無 default，不得被當成刪 key）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, { crossSessionInbound: 'accept' }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.change(within(fieldByKeyHint(HINT)).getByRole('combobox'), { target: { value: 'hold' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('crossSessionInbound', 'hold');
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// keybindingFlavor — display / enum classic|readline / no fixed default
// ---------------------------------------------------------------------------

// #25：docs 只寫「unset」而非固定值，schema 拿掉 keybindingFlavor 的 default——
// hint 因此不再帶預設值，選回 'classic'（舊 default）不再走 onDelete。
describe('keybindingFlavor（display section，#25 無 fixed default）', () => {
  const HINT = '(keybindingFlavor)';

  it('render 出 enum 控件，選項為 classic/readline', async () => {
    renderSection(DisplaySection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
    const select = within(fieldByKeyHint(HINT)).getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['classic', 'readline']));
  });

  it('選 readline → onSave("keybindingFlavor", "readline")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, {}, onSave);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.change(within(fieldByKeyHint(HINT)).getByRole('combobox'), { target: { value: 'readline' } });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('keybindingFlavor', 'readline'));
  });

  it('選 classic（舊 default，現無 default 可比對）→ onSave("keybindingFlavor", "classic")，不再走 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, { keybindingFlavor: 'readline' }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.change(within(fieldByKeyHint(HINT)).getByRole('combobox'), { target: { value: 'classic' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('keybindingFlavor', 'classic');
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// isolatePeerMachines — advanced / boolean / 無 default（docs 無 **Default**:；opt-in，未設不攔）
// ---------------------------------------------------------------------------

describe('isolatePeerMachines（advanced section）', () => {
  const HINT = '(isolatePeerMachines)';

  it('未設定 → checkbox unchecked（無 default，不得謊報保護已開啟）', async () => {
    renderSection(AdvancedSection);
    await waitFor(() => {
      const cb = within(fieldByKeyHint(HINT)).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('未設定, toggle on → 真正寫入 onSave("isolatePeerMachines", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(AdvancedSection, {}, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('isolatePeerMachines', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('=true, toggle off → onSave("isolatePeerMachines", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(AdvancedSection, { isolatePeerMachines: true }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('isolatePeerMachines', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
