import React from 'react';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';
import { ObjectFieldEditor, OBJECT_EDITOR_KEYS } from './components/ObjectFieldEditor';

export function AdvancedSection(props: SectionProps): React.ReactElement {
  return (
    <SchemaSection
      section="advanced"
      renderCustom={(key, ctx) =>
        OBJECT_EDITOR_KEYS.has(key) ? <ObjectFieldEditor settingKey={key} {...ctx} /> : null
      }
      {...props}
    />
  );
}
