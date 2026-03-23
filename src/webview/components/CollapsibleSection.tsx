import React from 'react';

export interface CollapsibleSectionProps {
  label: React.ReactNode;
  badge?: React.ReactNode;
  extra?: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function CollapsibleSection({
  label,
  badge,
  extra,
  isCollapsed,
  onToggle,
  headerActions,
  children,
  headerProps,
}: CollapsibleSectionProps): React.ReactElement {
  return (
    <div className="plugin-section">
      <div className="section-header" {...headerProps}>
        <button
          className={`section-toggle${isCollapsed ? ' section-toggle--collapsed' : ''}`}
          onClick={onToggle}
        >
          <span className={`section-chevron${isCollapsed ? ' section-chevron--collapsed' : ''}`}>
            &#9662;
          </span>
          <span className="section-toggle-label">{label}</span>
          {badge !== undefined && <span className="section-count">{badge}</span>}
          {extra}
        </button>
        {headerActions}
      </div>
      <div className={`section-body${isCollapsed ? ' section-body--collapsed' : ''}`}>
        <div className="section-body-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
