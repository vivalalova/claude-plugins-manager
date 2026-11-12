import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { createConfirm } from '../commandConsentPrompt';
import type { ShownCommand } from '../commandConsent';
import { en } from '../../../webview/i18n/locales/en';
import { zhTW } from '../../../webview/i18n/locales/zh-TW';
import { ja } from '../../../webview/i18n/locales/ja';

const SHOWN: ShownCommand = {
  pluginId: 'xcode@claude-plugins-official',
  kind: 'command_source',
  command: 'xcrun agent plugin path --plugin-format claude',
  mode: 'link',
  sha256: 'c932dd31f67e4b6d7ea984434bb2d27943212b36a0d35e469b5ba66af6da6035',
};

const showWarning = vi.mocked(vscode.window.showWarningMessage) as unknown as ReturnType<typeof vi.fn>;

function lookup(dict: unknown, key: string): string | undefined {
  return (dict as Record<string, string | undefined>)[key];
}

function lastCall(): { title: string; options: { modal: boolean; detail: string }; labels: string[] } {
  const [title, options, ...labels] = showWarning.mock.calls[showWarning.mock.calls.length - 1];
  return { title, options, labels };
}

describe('createConfirm（command-source 同意對話框）', () => {
  beforeEach(() => {
    showWarning.mockReset();
  });

  describe('zh-TW', () => {
    it('install：modal 警告框，標題、同意鈕與三行 detail 完全符合規格', async () => {
      showWarning.mockResolvedValue('同意並安裝');

      const ok = await createConfirm('zh-TW')(SHOWN, 'install');

      expect(ok).toBe(true);
      expect(showWarning).toHaveBeenCalledTimes(1);
      const { title, options, labels } = lastCall();
      expect(title).toBe('安裝 xcode 需要在這台機器執行命令');
      expect(options.modal).toBe(true);
      expect(labels).toEqual(['同意並安裝']);
      expect(options.detail).toContain('來源：claude-plugins-official');
      expect(options.detail).toContain('命令：xcrun agent plugin path --plugin-format claude');
      expect(options.detail).toContain('模式：link（直接使用輸出目錄，不複製）');
    });

    it('update：標題與同意鈕改為更新用語', async () => {
      showWarning.mockResolvedValue('同意並更新');

      const ok = await createConfirm('zh-TW')(SHOWN, 'update');

      expect(ok).toBe(true);
      const { title, labels } = lastCall();
      expect(title).toBe('更新 xcode 需要在這台機器執行命令');
      expect(labels).toEqual(['同意並更新']);
    });

    it('mode 不是 link → 該行顯示「模式：<原值>」且不含 link 的說明文字', async () => {
      showWarning.mockResolvedValue('同意並安裝');

      await createConfirm('zh-TW')({ ...SHOWN, mode: 'copy' }, 'install');

      const { options } = lastCall();
      expect(options.detail).toContain('模式：copy');
      expect(options.detail).not.toContain('直接使用輸出目錄');
    });

    it('使用者關閉對話框（回傳 undefined）→ false', async () => {
      showWarning.mockResolvedValue(undefined);
      expect(await createConfirm('zh-TW')(SHOWN, 'install')).toBe(false);
    });

    it('回傳值不是同意鈕文字 → false', async () => {
      showWarning.mockResolvedValue('取消');
      expect(await createConfirm('zh-TW')(SHOWN, 'install')).toBe(false);
    });

    it('install 的同意鈕文字對 update 對話框無效（按鈕對應動作）', async () => {
      showWarning.mockResolvedValue('同意並安裝');
      expect(await createConfirm('zh-TW')(SHOWN, 'update')).toBe(false);
    });
  });

  describe('en', () => {
    it('install：標題含外掛名、同意鈕取自 en locale、detail 含來源／命令／link 模式說明', async () => {
      const accept = lookup(en, 'plugin.commandConsent.install.accept');
      expect(accept).toBeTruthy();
      showWarning.mockResolvedValue(accept);

      const ok = await createConfirm('en')(SHOWN, 'install');

      expect(ok).toBe(true);
      const { title, options, labels } = lastCall();
      expect(title).toContain('xcode');
      expect(title).not.toContain('claude-plugins-official');
      expect(options.modal).toBe(true);
      expect(labels).toEqual([accept]);
      expect(options.detail).toContain('claude-plugins-official');
      expect(options.detail).toContain(SHOWN.command);
      expect(options.detail).toContain(lookup(en, 'plugin.commandConsent.mode.link') as string);
    });

    it('update：同意鈕與標題取自 update 的 en 字串（與 install 不同）', async () => {
      const installAccept = lookup(en, 'plugin.commandConsent.install.accept');
      const updateAccept = lookup(en, 'plugin.commandConsent.update.accept');
      expect(updateAccept).toBeTruthy();
      expect(updateAccept).not.toBe(installAccept);
      showWarning.mockResolvedValue(updateAccept);

      const ok = await createConfirm('en')(SHOWN, 'update');

      expect(ok).toBe(true);
      expect(lastCall().labels).toEqual([updateAccept]);
      expect(lastCall().title).toContain('xcode');
    });

    it('mode 不是 link → detail 含原值、不含 link 說明文字', async () => {
      showWarning.mockResolvedValue(undefined);

      await createConfirm('en')({ ...SHOWN, mode: 'copy' }, 'install');

      const { options } = lastCall();
      expect(options.detail).toContain('copy');
      expect(options.detail).not.toContain(lookup(en, 'plugin.commandConsent.mode.link') as string);
    });

    it('使用者關閉對話框（回傳 undefined）→ false', async () => {
      showWarning.mockResolvedValue(undefined);
      expect(await createConfirm('en')(SHOWN, 'install')).toBe(false);
    });
  });

  describe('locale 對應（沿用 webview LOCALE_MAP）', () => {
    it('未知語系退回 en 字串', async () => {
      showWarning.mockResolvedValue(undefined);

      await createConfirm('fr')(SHOWN, 'install');

      expect(lastCall().labels).toEqual([lookup(en, 'plugin.commandConsent.install.accept')]);
    });

    it('zh（無地區）與 zh-tw 同樣對應 zh-TW', async () => {
      for (const locale of ['zh', 'zh-tw']) {
        showWarning.mockReset();
        showWarning.mockResolvedValue(undefined);
        await createConfirm(locale)(SHOWN, 'install');
        expect(lastCall().labels).toEqual(['同意並安裝']);
      }
    });

    it('ja 對應 ja locale 的同意鈕', async () => {
      showWarning.mockResolvedValue(undefined);

      await createConfirm('ja')(SHOWN, 'install');

      expect(lastCall().labels).toEqual([lookup(ja, 'plugin.commandConsent.install.accept')]);
    });
  });

  describe('i18n key 完整性', () => {
    const KEYS = [
      'plugin.commandConsent.install.title',
      'plugin.commandConsent.update.title',
      'plugin.commandConsent.install.accept',
      'plugin.commandConsent.update.accept',
      'plugin.commandConsent.source',
      'plugin.commandConsent.command',
      'plugin.commandConsent.mode',
      'plugin.commandConsent.mode.link',
    ];

    it.each(KEYS)('%s 在 en／zh-TW／ja 三個 locale 都有字串', (key) => {
      expect(lookup(en, key)).toBeTruthy();
      expect(lookup(zhTW, key)).toBeTruthy();
      expect(lookup(ja, key)).toBeTruthy();
    });
  });
});
