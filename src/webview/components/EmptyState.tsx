import React from 'react';

interface EmptyStateProps {
  /** SVG icon element */
  icon: React.ReactNode;
  /** Primary message */
  title: string;
  /** Optional secondary description */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Shared empty-state component.
 * Displays icon + title + optional description + optional action button.
 * Colors adapt to VSCode theme via CSS variables.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): React.ReactElement {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-description">{description}</div>}
      {action && (
        <button type="button" className="btn btn-primary empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Package/plugin icon — box with arrow */
export function PluginIcon(): React.ReactElement {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="14" width="32" height="26" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 20h32" stroke="currentColor" strokeWidth="2" />
      <path d="M20 8v6M28 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 26v8M20 30l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Store/marketplace icon — storefront */
export function MarketplaceIcon(): React.ReactElement {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 18l4-10h28l4 10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 18c0 3 2.5 5 5 5s5-2 5-5c0 3 2.5 5 5 5s5-2 5-5c0 3 2.5 5 5 5s5-2 5-5c0 3 2.5 5 5 5s5-2 5-5" stroke="currentColor" strokeWidth="2" />
      <path d="M10 23v17h28V23" stroke="currentColor" strokeWidth="2" />
      <rect x="18" y="30" width="12" height="10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Server/connection icon — server stack */
export function ServerIcon(): React.ReactElement {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="6" width="32" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="22" width="32" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="12" r="2" fill="currentColor" />
      <circle cx="14" cy="28" r="2" fill="currentColor" />
      <path d="M24 34v6M18 42h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Filter/search icon — magnifying glass with X */
export function NoResultsIcon(): React.ReactElement {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2" />
      <path d="M30 30l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 16l8 8M24 16l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
