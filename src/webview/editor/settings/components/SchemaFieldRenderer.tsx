import React, { useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';
import type { FlatFieldSchema } from '../../../../shared/claude-settings-schema';
import { getSchemaDefault, getSchemaEnumOptions, getValueSchemaEnumOptions, getValueSchemaNumberMeta } from '../../../../shared/claude-settings-schema';
import { BooleanToggle, EnumDropdown, NumberSetting, TagInput, TextSetting, type Inherited } from './SettingControls';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useSettingSave } from '../hooks/useSettingSave';
import { useGlobalConfigFallback } from './globalConfigFallback';

export interface SchemaFieldRendererProps {
  settingKey: string;
  schema: FlatFieldSchema;
  value: unknown;
  scope: PluginScope;
  overriddenScope?: PluginScope;
  inherited: Inherited;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function SchemaFieldRenderer({ settingKey, schema, value, scope, overriddenScope, inherited, onSave, onDelete }: SchemaFieldRendererProps): React.ReactElement | null {
  const { t } = useI18n();
  const { withSave } = useSettingSave();
  const tk = (suffix: string): string =>
    t(`settings.${schema.section}.${settingKey}.${suffix}` as Parameters<typeof t>[0]);
  const tc = (suffix: string, vars?: Record<string, string | number>): string =>
    t(`settings.common.${suffix}` as Parameters<typeof t>[0], vars);

  const [pendingDangerValue, setPendingDangerValue] = useState<string | null>(null);

  // ~/.claude.json 備援（#31）：旗標是靜態的，一律傳給控制項決定「選預設值寫入不刪」；
  // 備援值只在本層未設、所有生效上層都沒設（none）、快照就緒時取出，合法性再依控制項型別過濾。
  const globalConfigFallback = schema.globalConfigFallback === true;
  const fallbackSnapshot = useGlobalConfigFallback();
  const rawFallback = globalConfigFallback && value === undefined && inherited.kind === 'none' && fallbackSnapshot.kind === 'ready'
    ? fallbackSnapshot.values[settingKey]
    : undefined;

  switch (schema.controlType) {
    case Boolean:
      return (
        <BooleanToggle
          label={tk('label')}
          description={tk('description')}
          value={value as boolean | undefined}
          settingKey={settingKey}
          defaultValue={getSchemaDefault<boolean>(settingKey)}
          overriddenScope={overriddenScope}
          inherited={inherited}
          globalConfigFallback={globalConfigFallback}
          fallbackValue={typeof rawFallback === 'boolean' ? rawFallback : undefined}
          onSave={onSave}
          onDelete={onDelete}
        />
      );

    case String: {
      if (getValueSchemaEnumOptions(schema.valueSchema)) {
        const options = getSchemaEnumOptions(settingKey);
        const optionLabels: Record<string, string> = {};
        for (const option of options) {
          // t() returns undefined for keys absent from the locale table; skip so
          // EnumDropdown falls back to the raw enum value instead of rendering "undefined".
          const optionLabel = tk(option) as string | undefined;
          if (optionLabel) optionLabels[option] = optionLabel;
        }
        const hasDangerValues = schema.dangerValues && schema.dangerValues.length > 0;
        const enumOnSave = hasDangerValues
          ? async (k: string, val: unknown) => {
              if (schema.dangerValues!.includes(val as string)) {
                setPendingDangerValue(val as string);
              } else {
                await onSave(k, val);
              }
            }
          : onSave;
        return (
          <>
            {pendingDangerValue && (
              <ConfirmDialog
                title={tk('dangerConfirm.title')}
                message={tk('dangerConfirm.message')}
                danger
                onConfirm={() => {
                  const val = pendingDangerValue;
                  setPendingDangerValue(null);
                  void withSave(() => onSave(settingKey, val));
                }}
                onCancel={() => setPendingDangerValue(null)}
              />
            )}
            <EnumDropdown
              label={tk('label')}
              description={tk('description')}
              value={value as string | undefined}
              knownValues={options}
              knownLabels={optionLabels}
              notSetLabel={tk('notSet')}
              unknownTemplate={tk('unknown')}
              settingKey={settingKey}
              defaultValue={getSchemaDefault<string>(settingKey)}
              overriddenScope={overriddenScope}
              inherited={inherited}
              globalConfigFallback={globalConfigFallback}
              fallbackValue={typeof rawFallback === 'string' && options.includes(rawFallback) ? rawFallback : undefined}
              onSave={enumOnSave}
              onDelete={onDelete}
            />
          </>
        );
      }
      return (
        <TextSetting
          label={tk('label')}
          description={tk('description')}
          value={value as string | undefined}
          placeholder={tk('placeholder')}
          saveLabel={tc('save')}
          clearLabel={tc('clear')}
          settingKey={settingKey}
          defaultValue={getSchemaDefault<string>(settingKey)}
          overriddenScope={overriddenScope}
          inherited={inherited}
          scope={scope}
          onSave={onSave}
          onDelete={onDelete}
        />
      );
    }

    case Number: {
      const numberMeta = getValueSchemaNumberMeta(schema.valueSchema);
      return (
        <NumberSetting
          label={tk('label')}
          description={tk('description')}
          value={value as number | undefined}
          placeholder={tk('placeholder')}
          saveLabel={tc('save')}
          clearLabel={tc('clear')}
          settingKey={settingKey}
          defaultValue={getSchemaDefault<number>(settingKey)}
          overriddenScope={overriddenScope}
          inherited={inherited}
          scope={scope}
          min={numberMeta?.min}
          max={numberMeta?.max}
          step={numberMeta?.step}
          minError={numberMeta?.min !== undefined ? tc('minError', { min: numberMeta.min }) : undefined}
          maxError={numberMeta?.max !== undefined ? tc('maxError', { max: numberMeta.max }) : undefined}
          onSave={onSave}
          onDelete={onDelete}
        />
      );
    }

    case Array:
      return (
        <TagInput
          label={tk('label')}
          description={tk('description')}
          scope={scope}
          tags={(value as string[] | undefined) ?? []}
          emptyPlaceholder={tk('empty')}
          inputPlaceholder={tk('placeholder')}
          addLabel={tk('add')}
          duplicateError={tk('duplicate')}
          settingKey={settingKey}
          overriddenScope={overriddenScope}
          onSave={onSave}
        />
      );

    case Object:
      return null;

    default:
      throw new Error(`Unexpected controlType: ${schema.controlType}`);
  }
}
