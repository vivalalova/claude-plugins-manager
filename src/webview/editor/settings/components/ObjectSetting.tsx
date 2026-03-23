import React, { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { SettingLabelText } from './SettingControls';

interface ObjectSettingProps {
  label: string;
  description?: string;
  settingKey: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ObjectSetting({
  label,
  description,
  settingKey,
  children,
  actions,
}: ObjectSettingProps): React.ReactElement {
  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={label} settingKey={settingKey} />
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      {children}
      {actions && <div className="settings-actions">{actions}</div>}
    </div>
  );
}

export function useObjectEditorState<T>(
  createValue: () => T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => createValue());

  useEffect(() => {
    setValue(createValue());
  }, [createValue]);

  const resetValue = (): void => {
    setValue(createValue());
  };

  return [value, setValue, resetValue];
}
