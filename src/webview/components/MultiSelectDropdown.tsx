import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: ReadonlyArray<MultiSelectOption>;
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
}: MultiSelectDropdownProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const getPanelStyle = useCallback((): React.CSSProperties => {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return { top: rect.bottom + 4, left: rect.left };
  }, []);

  const count = selected.size;
  const triggerLabel = count > 0 ? `${label} (${count})` : label;

  return (
    <div className="multi-select-dropdown">
      <button
        ref={btnRef}
        className={`multi-select-dropdown-trigger${count > 0 ? ' filter-chip--active' : ''}`}
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {triggerLabel}
        <span className="multi-select-dropdown-trigger-chevron" aria-hidden="true">▾</span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="multi-select-dropdown-panel"
          style={getPanelStyle()}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
        >
          {options.map(({ value, label: optLabel }) => {
            const active = selected.has(value);
            return (
              <button
                key={value}
                className="multi-select-dropdown-option"
                role="option"
                aria-selected={active}
                onClick={() => onToggle(value)}
              >
                <input
                  type="checkbox"
                  checked={active}
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                />
                {optLabel}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
