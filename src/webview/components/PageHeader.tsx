import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  titleAs?: 'div' | 'h1' | 'h2' | 'h3';
}

export function PageHeader({
  title,
  subtitle,
  actions,
  titleAs: TitleTag = 'div',
}: PageHeaderProps): React.ReactElement {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <TitleTag className="page-title">{title}</TitleTag>
        {subtitle !== undefined && (<>
          <span className="page-subtitle-sep" aria-hidden="true">/</span>
          <span className="page-subtitle">{subtitle}</span>
        </>)}
      </div>
      {actions !== undefined && (
        <div className="page-actions">{actions}</div>
      )}
    </div>
  );
}
