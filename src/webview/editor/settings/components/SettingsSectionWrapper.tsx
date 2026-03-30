import React from 'react';

export function SettingsSectionWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="settings-section">{children}</div>;
}
