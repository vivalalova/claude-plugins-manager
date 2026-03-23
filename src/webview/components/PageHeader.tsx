import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  titleAs?: 'div' | 'h1' | 'h2' | 'h3';
}

export function PageHeader({
  title,
  actions,
  titleAs: TitleTag = 'div',
}: PageHeaderProps): React.ReactElement {
  return (
    <div className="page-header">
      <TitleTag className="page-title">{title}</TitleTag>
      {actions !== undefined && (
        <div className="page-actions">{actions}</div>
      )}
    </div>
  );
}
