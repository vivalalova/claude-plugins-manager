import React, { useId } from 'react';
import { TRANSLATE_LANGS } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface TranslateDialogProps {
  trapRef: React.RefObject<HTMLDivElement | null>;
  titleId: string;
  emailId: string;
  langId: string;
  draftEmail: string;
  draftLang: string;
  onEmailChange: (email: string) => void;
  onLangChange: (lang: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 翻譯設定 dialog（email + 語言選擇）。
 * PluginPage 負責條件渲染（dialogOpen && ...）。
 */
export function TranslateDialog({
  trapRef,
  titleId,
  emailId,
  langId,
  draftEmail,
  draftLang,
  onEmailChange,
  onLangChange,
  onCancel,
  onConfirm,
}: TranslateDialogProps): React.ReactElement {
  const { t } = useI18n();
  const emailHintId = useId();
  const handleOverlayDismiss = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.target !== e.currentTarget) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if ('preventDefault' in e) e.preventDefault();
    onCancel();
  };

  return (
    <div
      className="confirm-overlay"
      onClick={handleOverlayDismiss}
      onKeyDown={handleOverlayDismiss}
      tabIndex={0}
    >
      <div
        ref={trapRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="confirm-dialog-title" id={titleId}>{t('translate.title')}</div>
        <div className="form-row">
          <label className="form-label" htmlFor={emailId}>{t('translate.emailLabel')}</label>
          <input
            id={emailId}
            className="input"
            type="email"
            value={draftEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('translate.emailPlaceholder')}
            aria-describedby={emailHintId}
          />
          <span id={emailHintId} className="form-hint">
            {t('translate.emailHint')}
          </span>
        </div>
        <div className="form-row">
          <label className="form-label" htmlFor={langId}>{t('translate.languageLabel')}</label>
          <select
            id={langId}
            className="input"
            value={draftLang}
            onChange={(e) => onLangChange(e.target.value)}
          >
            <option value="">{t('translate.noTranslation')}</option>
            {Object.entries(TRANSLATE_LANGS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
        <div className="confirm-dialog-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onCancel}>{t('translate.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={!draftEmail}
          >{t('translate.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
