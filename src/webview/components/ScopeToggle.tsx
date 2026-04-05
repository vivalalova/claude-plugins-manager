import React from 'react';

interface ScopeToggleProps {
  label: string;
  scope: string;
  enabled: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: (enable: boolean) => void;
}

/** Scope checkbox：勾 = enabled，沒勾 = disabled 或未安裝。loading 時顯示 spinner 取代 checkbox。 */
export function ScopeToggle({
  label,
  scope,
  enabled,
  loading,
  disabled,
  onToggle,
}: ScopeToggleProps): React.ReactElement {
  return (
    <label className={`scope-chip-toggle${disabled ? ' scope-chip-toggle--disabled' : ''}`}>
      {loading
        ? <span className="scope-spinner" />
        : (
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={() => onToggle(!enabled)}
          />
        )}
      <span className={`scope-badge scope-badge--${scope}`}>
        {label}
      </span>
    </label>
  );
}
