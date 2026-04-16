import React, { useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';
import type { FlatFieldSchema } from '../../../../shared/claude-settings-schema';
import { getSchemaDefault, getSchemaEnumOptions, getValueSchemaEnumOptions, getValueSchemaNumberMeta } from '../../../../shared/claude-settings-schema';
import { BooleanToggle, EnumDropdown, NumberSetting, TagInput, TextSetting } from './SettingControls';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

export interface SchemaFieldRendererProps {
  settingKey: string;
  schema: FlatFieldSchema;
  value: unknown;
  scope: PluginScope;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function SchemaFieldRenderer({ settingKey, schema, value, scope, overriddenScope, onSave, onDelete }: SchemaFieldRendererProps): React.ReactElement | null {
  const { t } = useI18n();
  const tk = (suffix: string): string =>
    t(`settings.${schema.section}.${settingKey}.${suffix}` as Parameters<typeof t>[0]);
  const tc = (suffix: string, vars?: Record<string, string | number>): string =>
    t(`settings.common.${suffix}` as Parameters<typeof t>[0], vars);

  const [pendingDangerValue, setPendingDangerValue] = useState<string | null>(null);

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
          onSave={onSave}
          onDelete={onDelete}
        />
      );

    case String: {
      if (getValueSchemaEnumOptions(schema.valueSchema)) {
        const options = getSchemaEnumOptions(settingKey);
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
                  void onSave(settingKey, val);
                }}
                onCancel={() => setPendingDangerValue(null)}
              />
            )}
            <EnumDropdown
              label={tk('label')}
              description={tk('description')}
              value={value as string | undefined}
              knownValues={options}
              knownLabels={{}}
              notSetLabel={tk('notSet')}
              unknownTemplate={tk('unknown')}
              settingKey={settingKey}
              defaultValue={getSchemaDefault<string>(settingKey)}
              overriddenScope={overriddenScope}
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
