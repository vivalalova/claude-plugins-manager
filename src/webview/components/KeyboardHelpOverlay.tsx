import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useI18n } from '../i18n/I18nContext';

interface KeyboardHelpOverlayProps {
  /** 關閉 overlay 的 callback */
  onClose: () => void;
}

/**
 * 鍵盤快捷鍵說明 overlay。
 * 顯示所有支援的快捷鍵列表，Escape 或 Close 按鈕關閉。
 */
export function KeyboardHelpOverlay({ onClose }: KeyboardHelpOverlayProps): React.ReactElement {
  const { t } = useI18n();
  const trapRef = useFocusTrap(onClose);

  const shortcuts = [
    { key: '/', description: t('keyboard.focusSearch') },
    { key: 'Escape', description: t('keyboard.clearSearch') },
    { key: 'j', description: t('keyboard.nextCard') },
    { key: 'k', description: t('keyboard.prevCard') },
    { key: 'Enter', description: t('keyboard.expandCard') },
    { key: '?', description: t('keyboard.toggleHelp') },
  ];

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        ref={trapRef}
        className="confirm-dialog keyboard-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title" id="keyboard-help-title">{t('keyboard.title')}</div>
        <dl className="keyboard-help-list">
          {shortcuts.map(({ key, description }) => (
            <React.Fragment key={key}>
              <dt><kbd className="keyboard-help-key">{key}</kbd></dt>
              <dd className="keyboard-help-desc">{description}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="confirm-dialog-actions">
          <button className="btn btn-primary" onClick={onClose} type="button">{t('keyboard.close')}</button>
        </div>
      </div>
    </div>
  );
}
