import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';
import type { SettingFieldSchema } from '../../../../shared/claude-settings-schema';
import { getSchemaDefault, getSchemaEnumOptions } from '../../../../shared/claude-settings-schema';
import { BooleanToggle, EnumDropdown, NumberSetting, TagInput, TextSetting } from './SettingControls';

export interface SchemaFieldRendererProps {
  settingKey: string;
  schema: SettingFieldSchema;
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
      if (schema.options) {
        const options = getSchemaEnumOptions(settingKey);
        const knownLabels: Record<string, string> = {};
        for (const opt of options) {
          knownLabels[opt] = tk(opt);
        }
        return (
          <EnumDropdown
            label={tk('label')}
            description={tk('description')}
            value={value as string | undefined}
            knownValues={options}
            knownLabels={knownLabels}
            notSetLabel={tk('notSet')}
            unknownTemplate={tk('unknown')}
            settingKey={settingKey}
            defaultValue={getSchemaDefault<string>(settingKey)}
            overriddenScope={overriddenScope}
            onSave={onSave}
            onDelete={onDelete}
          />
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

    case Number:
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
          min={schema.min}
          max={schema.max}
          step={schema.step}
          minError={schema.min !== undefined ? tc('minError', { min: schema.min }) : undefined}
          maxError={schema.max !== undefined ? tc('maxError', { max: schema.max }) : undefined}
          onSave={onSave}
          onDelete={onDelete}
        />
      );

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
