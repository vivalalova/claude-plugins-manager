import React from 'react';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';
import { ObjectFieldEditor, OBJECT_EDITOR_KEYS } from './components/ObjectFieldEditor';

export function DisplaySection(props: SectionProps): React.ReactElement {
  return (
    <SchemaSection
      section="display"
      renderCustom={(key, ctx) => {
        if (OBJECT_EDITOR_KEYS.has(key)) {
          return <ObjectFieldEditor settingKey={key} {...ctx} />;
        }
        return null;
      }}
      {...props}
    />
  );
}
