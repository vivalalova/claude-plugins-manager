import React from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  clearAriaLabel?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  children?: React.ReactNode;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder,
  ariaLabel,
  clearAriaLabel,
  inputRef,
  children,
}: SearchInputProps): React.ReactElement {
  const handleClear = onClear ?? (() => onChange(''));
  return (
    <div className="search-row">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          className="input search-bar"
          type="text"
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className="search-clear-btn"
            aria-label={clearAriaLabel ?? 'Clear search'}
            onClick={handleClear}
          >
            &#x2715;
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
