/**
 * @vitest-environment jsdom
 *
 * 批次 R 新 scalar setting key 的 section 渲染 / save / delete 先紅測試
 *
 * 涵蓋：
 *   - emojiCompletionEnabled（display, boolean, default true）
 *   - switchModelsOnFlag（general, boolean, default true）
 *   - defaultEnvironmentId（advanced, string, nestedUnder 'remote'）
 *
 * 定位控件走 key hint 文字（`(key: default)`）而非 label 文案：文案由執行者決定，
 * 這裡只鎖行為契約。key hint 缺失時紅因是「找不到 (key: …) 文字」，明確可讀。
 *
 * 開新檔而非併入既有 DisplaySection/AdvancedSection 測試檔：兩者已逼近／超過
 * 800 行上限。
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
// emojiCompletionEnabled — display / boolean / default true
// ---------------------------------------------------------------------------

describe('批次 R — emojiCompletionEnabled（display section，先紅）', () => {
  const HINT = '(emojiCompletionEnabled: true)';

  it('在 display section render 出控件，並顯示 default true 的 key hint', async () => {
    renderSection(DisplaySection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
  });

  it('未設定 → checkbox checked（反映 default true）', async () => {
    renderSection(DisplaySection);
    await waitFor(() => {
      const cb = within(fieldByKeyHint(HINT)).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('未設定, toggle off → onSave("emojiCompletionEnabled", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, {}, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('emojiCompletionEnabled', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('=false, toggle on → 值回到 default，呼叫 onDelete("emojiCompletionEnabled")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(DisplaySection, { emojiCompletionEnabled: false }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('emojiCompletionEnabled');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// switchModelsOnFlag — general / boolean / default true
// ---------------------------------------------------------------------------

describe('批次 R — switchModelsOnFlag（general section，先紅）', () => {
  const HINT = '(switchModelsOnFlag: true)';

  it('在 general section render 出控件，並顯示 default true 的 key hint', async () => {
    renderSection(GeneralSection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
  });

  it('未設定 → checkbox checked（反映 default true）', async () => {
    renderSection(GeneralSection);
    await waitFor(() => {
      const cb = within(fieldByKeyHint(HINT)).getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('未設定, toggle off → onSave("switchModelsOnFlag", false)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, {}, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('switchModelsOnFlag', false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('=false, toggle on → onDelete("switchModelsOnFlag")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(GeneralSection, { switchModelsOnFlag: false }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('checkbox'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('switchModelsOnFlag');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// defaultEnvironmentId — advanced / string / nestedUnder 'remote'
//
// nestedUnder 欄位的 binding 由 getSchemaFieldBindings 統一處理：寫入走
// onSave('remote', { ...既有 remote, defaultEnvironmentId: value })。
// 刪除分兩路（拍板契約）：
//   - 刪掉子 key 後父物件變空 → onDelete('remote')，不留殘留 "remote": {}
//   - 父物件還有其他 key → onSave('remote', 剩餘物件)
// 漏加 nestedUnder → 會寫成 onSave('defaultEnvironmentId', …) 頂層，CLI 讀不到。
// ---------------------------------------------------------------------------

describe('批次 R — defaultEnvironmentId（advanced section，nestedUnder remote，先紅）', () => {
  const HINT = '(defaultEnvironmentId)';

  it('在 advanced section render 出控件（無 default → key hint 不帶值）', async () => {
    renderSection(AdvancedSection);
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy());
  });

  it('settings.remote.defaultEnvironmentId="env-1" → input 顯示既有值', async () => {
    renderSection(AdvancedSection, { remote: { defaultEnvironmentId: 'env-1' } });
    await waitFor(() => {
      const input = within(fieldByKeyHint(HINT)).getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('env-1');
    });
  });

  it('未設定, 輸入並儲存 → onSave("remote", { defaultEnvironmentId: "env-1" })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection(AdvancedSection, {}, onSave);

    await waitFor(() => screen.getByText(HINT));
    const field = fieldByKeyHint(HINT);
    fireEvent.change(within(field).getByRole('textbox'), { target: { value: 'env-1' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('remote', { defaultEnvironmentId: 'env-1' });
    });
  });

  it('既有 remote 其他欄位保留（不被覆蓋）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection(AdvancedSection, { remote: { somethingElse: 'keep-me' } }, onSave);

    await waitFor(() => screen.getByText(HINT));
    const field = fieldByKeyHint(HINT);
    fireEvent.change(within(field).getByRole('textbox'), { target: { value: 'env-1' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('remote', { somethingElse: 'keep-me', defaultEnvironmentId: 'env-1' });
    });
  });

  it('已設定且是父物件唯一 key, Reset → onDelete("remote")（父物件變空 → 整個刪掉，不留 "remote": {}）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(AdvancedSection, { remote: { defaultEnvironmentId: 'env-1' } }, onSave, onDelete);

    await waitFor(() => screen.getByText(HINT));
    // 依 codebase 慣例用 /Reset/ regex：Reset 鈕 aria-label 帶欄位名
    //（如 "Reset Default Cloud Environment"），精確字串匹配抓不到。
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('button', { name: /Reset/ }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('remote');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('父物件還有其他 key 時 Reset → onSave("remote", 剩餘物件)（非空父物件行為不變）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection(
      AdvancedSection,
      { remote: { defaultEnvironmentId: 'env-1', somethingElse: 'keep-me' } },
      onSave,
      onDelete,
    );

    await waitFor(() => screen.getByText(HINT));
    fireEvent.click(within(fieldByKeyHint(HINT)).getByRole('button', { name: /Reset/ }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('remote', { somethingElse: 'keep-me' });
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
