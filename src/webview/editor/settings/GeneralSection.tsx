import React from 'react';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';

export function GeneralSection(props: SectionProps): React.ReactElement {
  return (
    <SchemaSection
      section="general"
      {...props}
    />
  );
}
