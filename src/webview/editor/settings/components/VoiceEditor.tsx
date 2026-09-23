import React, { useCallback } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { VOICE_MODE_OPTIONS } from '../../../../shared/claude-settings-schema';
import { useSettingSave } from '../hooks/useSettingSave';
import { ObjectSetting, useObjectEditorState } from './ObjectSetting';

type VoiceValue = NonNullable<ClaudeSettings['voice']>;
type VoiceMode = NonNullable<VoiceValue['mode']>;

interface VoiceEditorProps {
  voice: ClaudeSettings['voice'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  overriddenScope?: PluginScope;
}

export function VoiceEditor({ voice, onSave, onDelete, overriddenScope }: VoiceEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const tk = useCallback(
    (suffix: string) => t(`settings.display.voice.${suffix}` as Parameters<typeof t>[0]),
    [t],
  );

  // 依賴只放三個原始值：自己存檔後回推的等值新物件不會重置草稿；外部改任一子欄位則整份重建
  const createDraft = useCallback(() => ({
    enabled: voice?.enabled ?? false,
    mode: (voice?.mode ?? '') as VoiceMode | '',
    autoSubmit: voice?.autoSubmit ?? false,
  }), [voice?.enabled, voice?.mode, voice?.autoSubmit]);
  const [draft, setDraft] = useObjectEditorState(createDraft);
  // 檔案內值不在選項內時比照 EnumDropdown 顯示「目前值」，避免誤顯示為「自動」
  const isUnknownMode = draft.mode !== '' && !(VOICE_MODE_OPTIONS as readonly string[]).includes(draft.mode);

  const handleSave = (): void => {
    void withSave(async () => {
      // false 視為未填：只寫已勾／已選的欄位，全空時刪整個 key
      const obj: VoiceValue = {};
      if (draft.enabled) obj.enabled = true;
      if (draft.mode) obj.mode = draft.mode;
      if (draft.autoSubmit) obj.autoSubmit = true;

      if (Object.keys(obj).length === 0) {
        await onDelete('voice');
      } else {
        await onSave('voice', obj);
      }
    });
  };

  const handleClear = (): void => {
    void withSave(() => onDelete('voice'));
  };

  return (
    <ObjectSetting
      label={tk('label')}
      description={tk('description')}
      settingKey="voice"
      overriddenScope={overriddenScope}
      actions={(
        <>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} type="button">
            {t('settings.common.save')}
          </button>
          {voice && (
            <button className="btn btn-secondary" onClick={handleClear} disabled={saving} type="button">
              {t('settings.common.clear')}
            </button>
          )}
        </>
      )}
    >
      <div className="settings-subfield">
        <label className="hooks-toggle-label" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input
            id="voice-enabled"
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
            disabled={saving}
            aria-label={tk('enabled.label')}
          />
          {tk('enabled.label')}
        </label>
      </div>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="voice-mode">
          {tk('mode.label')}
        </label>
        <select
          id="voice-mode"
          className="select"
          value={draft.mode}
          onChange={(e) => setDraft((prev) => ({ ...prev, mode: e.target.value as VoiceMode | '' }))}
          disabled={saving}
        >
          <option value="">{tk('mode.unset')}</option>
          {isUnknownMode && (
            <option value={draft.mode} disabled>
              {tk('mode.unknown').replace('{value}', draft.mode)}
            </option>
          )}
          {VOICE_MODE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{tk(`mode.${opt}`)}</option>
          ))}
        </select>
      </div>
      <div className="settings-subfield">
        {/* tap 模式下 autoSubmit 無效，但依拍板不做連動禁用 */}
        <label className="hooks-toggle-label" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input
            id="voice-autoSubmit"
            type="checkbox"
            checked={draft.autoSubmit}
            onChange={(e) => setDraft((prev) => ({ ...prev, autoSubmit: e.target.checked }))}
            disabled={saving}
            aria-label={tk('autoSubmit.label')}
          />
          {tk('autoSubmit.label')}
        </label>
      </div>
    </ObjectSetting>
  );
}
