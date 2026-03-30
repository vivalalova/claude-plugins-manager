import React from 'react';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';

export function GeneralSection(props: SectionProps): React.ReactElement {
  return (
    <SchemaSection
      titleKey="settings.nav.general"
      section="general"
      {...props}
    />
  );
}
