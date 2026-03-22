import React from 'react';

export interface GridSectionHeaderProps {
  sectionId: string;
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}

export function GridSectionHeader({
  label,
  collapsed,
  onToggle,
}: GridSectionHeaderProps): React.ReactElement {
  return (
    <div
      className="sg-section-header"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span
        className={`sg-section-chevron${collapsed ? ' sg-section-chevron--collapsed' : ''}`}
        aria-hidden="true"
      >
        ▼
      </span>
      <span>{label}</span>
    </div>
  );
}
