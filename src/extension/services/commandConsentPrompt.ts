import * as vscode from 'vscode';
import { createTranslator } from '../../webview/i18n/translate';
import type { ConfirmFn } from './commandConsent';

/** 以 VSCode 原生 modal 讓使用者過目 marketplace 宣告的命令；按下同意鈕才回 true */
export function createConfirm(locale: string): ConfirmFn {
  const t = createTranslator(locale);
  return async (shown, action) => {
    const lastAt = shown.pluginId.lastIndexOf('@');
    const name = lastAt > 0 ? shown.pluginId.slice(0, lastAt) : shown.pluginId;
    const marketplace = lastAt > 0 ? shown.pluginId.slice(lastAt + 1) : '';
    const acceptLabel = t(`plugin.commandConsent.${action}.accept`);
    const detail = [
      t('plugin.commandConsent.source', { marketplace }),
      t('plugin.commandConsent.command', { command: shown.command }),
      t('plugin.commandConsent.mode', {
        mode: shown.mode === 'link' ? t('plugin.commandConsent.mode.link') : shown.mode,
      }),
    ].join('\n');
    const choice = await vscode.window.showWarningMessage(
      t(`plugin.commandConsent.${action}.title`, { name }),
      { modal: true, detail },
      acceptLabel,
    );
    return choice === acceptLabel;
  };
}
